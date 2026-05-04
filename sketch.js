let facemesh;
let video;
let predictions = [];
let stars = [];


// FaceMesh 點位編號定義
const silhouette = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];


function setup() {
  createCanvas(windowWidth, windowHeight);
 
  // 初始化攝影機
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();


  // 初始化 FaceMesh
  facemesh = ml5.facemesh(video, () => console.log("Model Ready!"));
  facemesh.on("predict", results => {
    predictions = results;
  });


  // 初始化星星
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      brightness: random(100, 255)
    });
  }
}


function draw() {
  background('#e7c6ff');


  // 計算顯示影像的寬高 (全螢幕的 50%)
  let displayW = width * 0.5;
  let displayH = height * 0.5;
  let xOffset = (width - displayW) / 2;
  let yOffset = (height - displayH) / 2;


  // 1. 繪製外太空黑色背景區域
  fill(0);
  noStroke();
  rect(xOffset, yOffset, displayW, displayH);


  // 繪製隨機星星
  drawStars(xOffset, yOffset, displayW, displayH);


  if (predictions.length > 0) {
    let points = predictions[0].scaledMesh;


    // 2. 只有臉部區域顯示影像 (使用 Masking 概念)
    push();
    drawingContext.save();
   
    // 定義裁切區域 (臉部輪廓)
    beginShape();
    for (let i of silhouette) {
      let p = points[i];
      let sx = map(p[0], 0, video.width, xOffset + displayW, xOffset); // 鏡像處理
      let sy = map(p[1], 0, video.height, yOffset, yOffset + displayH);
      vertex(sx, sy);
    }
    endShape(CLOSE);
    drawingContext.clip();


    // 繪製鏡像影像
    translate(xOffset + displayW, yOffset);
    scale(-1, 1);
    image(video, 0, 0, displayW, displayH);
    drawingContext.restore();
    pop();


    // 3. 繪製小丑面具
    drawClownMask(points, xOffset, yOffset, displayW, displayH);
  }
}


function drawStars(ox, oy, w, h) {
  push();
  for (let s of stars) {
    let sx = (s.x % w) + ox;
    let sy = (s.y % h) + oy;
    fill(255, s.brightness);
    noStroke();
    circle(sx, sy, s.size);
  }
  pop();
}


function drawClownMask(points, ox, oy, dw, dh) {
  // 輔助函式，用於映射座標（包含鏡像效果）
  const mapPoint = (p) => {
    return {
      x: map(p[0], 0, video.width, ox + dw, ox), // 左右顛倒
      y: map(p[1], 0, video.height, oy, oy + dh) // 正常
    };
  };

  push();

  // --- 臉部外圈 (白色底妝) ---
  fill(255, 255, 255, 220); // 帶點透明的白色
  noStroke();
  beginShape();
  for (let i of silhouette) { // silhouette 是全域變數
    const p = mapPoint(points[i]);
    vertex(p.x, p.y);
  }
  endShape(CLOSE);

  // --- 耳朵 (紅色圓球) ---
  fill(255, 0, 0);
  const leftEar = mapPoint(points[234]);
  const rightEar = mapPoint(points[454]);
  circle(leftEar.x, leftEar.y, 40);
  circle(rightEar.x, rightEar.y, 40);

  // --- 鼻子 (紅色圓圈) ---
  const noseTip = mapPoint(points[1]);
  fill(255, 0, 0);
  circle(noseTip.x, noseTip.y, 30);

  // --- 嘴巴 (誇張的微笑) ---
  const mouthLeft = mapPoint(points[61]);
  const mouthRight = mapPoint(points[291]);
  const mouthBottom = mapPoint(points[17]);
  noFill();
  stroke(255, 0, 0);
  strokeWeight(4);
  beginShape();
  vertex(mouthLeft.x, mouthLeft.y);
  // 畫一個向下彎的誇張微笑
  quadraticVertex((mouthLeft.x + mouthRight.x) / 2, mouthBottom.y + 50, mouthRight.x, mouthRight.y);
  endShape();

  // --- 眼睛 (藍色菱形) ---
  fill(0, 100, 255);
  noStroke();

  // 右眼 (觀眾視角的左邊)
  const reTop = mapPoint(points[159]);
  const reBottom = mapPoint(points[145]);
  const reOuter = mapPoint(points[33]);
  const reInner = mapPoint(points[133]);
  quad(reTop.x, reTop.y, reOuter.x, reOuter.y, reBottom.x, reBottom.y, reInner.x, reInner.y);

  // 左眼 (觀眾視角的右邊)
  const leTop = mapPoint(points[386]);
  const leBottom = mapPoint(points[374]);
  const leOuter = mapPoint(points[263]);
  const leInner = mapPoint(points[362]);
  quad(leTop.x, leTop.y, leOuter.x, leOuter.y, leBottom.x, leBottom.y, leInner.x, leInner.y);

  pop();
}

// 處理手機旋轉與視窗調整
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
 
  // 重新分布星星
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(1, 3),
      brightness: random(100, 255)
    });
  }
}
