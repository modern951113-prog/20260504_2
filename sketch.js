// 為了使用 facemesh，您需要在 HTML 檔案中引入 ml5.js 函式庫，例如：
// <script src="https://unpkg.com/ml5@latest/dist/ml5.min.js"></script>

let capture;
let facemesh;
let pg; // 用於繪製攝影機影像的 p5.Graphics 物件
let maskGraphics; // 用於繪製遮罩的 p5.Graphics 物件
let predictions = []; // 儲存臉部偵測結果的陣列

// 新增：儲存星星的陣列
let stars = [];
const numStars = 200; // 星星的數量

// 根據要求，定義要連接的臉部關鍵點索引
// 臉部最外層輪廓 (使用 MediaPipe 官方的 Face Oval 索引)
const faceOuterContourIndices = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

function setup() {
  // 建立一個全螢幕的畫布
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機擷取影像
  capture = createCapture(VIDEO, videoReady);
  // 隱藏原始的 HTML 影像元素，因為我們將在畫布上手動繪製它
  capture.hide();

  // 新增：生成星星
  generateStars();
}

// 新增：生成星星的函數
function generateStars() {
  for (let i = 0; i < numStars; i++) {
    // 星星的 x, y 座標隨機分佈在畫布範圍內，半徑在 1 到 3 之間
    stars.push({ x: random(width), y: random(height), r: random(1, 3) });
  }
}

// 當視窗大小改變時，重新創建 p5.Graphics 物件
// 否則，如果只在 setup() 中創建，當視窗大小改變時，它們的大小不會更新
windowResized(); 

function videoReady() {
  // 當攝影機準備好後，載入 facemesh 模型
  facemesh = ml5.faceMesh(capture, modelReady);
}

function modelReady() {
  console.log("FaceMesh Model ready!");
  if (facemesh) { // 確保 facemesh 物件已成功載入
    // 設定一個監聽器，當偵測到臉部時，會執行回呼函式
    facemesh.on("face", results => {
      // 將偵測結果儲存到 predictions 陣列
      predictions = results;
    });
  } else {
    console.error("ml5.faceMesh 模型載入失敗。這可能是因為您的裝置或瀏覽器不支援 WebGL/WebGPU。");
    console.error("請確保您的瀏覽器是最新版本，並且您的裝置支援 WebGL (例如：Chrome, Firefox, Edge)。");
  }
}

function draw() {
  // 設定畫布背景顏色
  background(0); // 將背景設定為黑色

  // 新增：在背景上繪製星星
  noStroke();
  fill(255); // 白色星星
  for (let i = 0; i < stars.length; i++) {
    let star = stars[i];
    ellipse(star.x, star.y, star.r * 2, star.r * 2); // 繪製圓形星星
  }

  // 在攝影機準備好之前，先不要執行後續的繪圖程式碼
  if (!capture || !capture.elt || capture.elt.videoWidth === 0 || capture.elt.videoHeight === 0) {
    return;
  }

  // 計算影像要顯示的寬度和高度 (全螢幕的 50%)
  const videoWidth = width * 0.5;
  const videoHeight = height * 0.5;

  // 計算影像的 x 和 y 座標，使其置中
  const x = (width - videoWidth) / 2;
  const y = (height - videoHeight) / 2;

  // 獲取攝影機的原始 (intrinsic) 影像尺寸
  const nativeVideoWidth = capture.elt.videoWidth;
  const nativeVideoHeight = capture.elt.videoHeight;

  let isVideoEffectivelyRotated = false;
  let rotationAngleDegrees = 0; // 0, 90, 180, 270

  // 獲取螢幕方向角度 (0, 90, 180, 270)
  // 0: 直向 (primary), 90: 橫向 (primary), 180: 直向 (secondary), 270: 橫向 (secondary)
  const currentScreenOrientation = screen.orientation.angle || window.orientation || 0;

  // 判斷影像是否因為裝置方向而「看起來」被旋轉了
  // 假設大多數網路攝影機提供的是橫向 (width > height) 的原始影像
  // 如果原始影像是橫向，但裝置處於直向模式 (90 或 270 度)，則影像在螢幕上會被旋轉
  if (nativeVideoWidth > nativeVideoHeight && (currentScreenOrientation === 90 || currentScreenOrientation === 270)) {
    isVideoEffectivelyRotated = true;
    rotationAngleDegrees = currentScreenOrientation;
  }
  // 如果原始影像是直向，但裝置處於橫向模式 (0 或 180 度)，則影像在螢幕上會被旋轉
  else if (nativeVideoHeight > nativeVideoWidth && (currentScreenOrientation === 0 || currentScreenOrientation === 180)) {
    isVideoEffectivelyRotated = true;
    rotationAngleDegrees = currentScreenOrientation;
  }

  // 確保 pg 和 maskGraphics 的大小與縮放後的影像一致
  if (pg.width !== videoWidth || pg.height !== videoHeight) {
    pg = createGraphics(videoWidth, videoHeight);
    maskGraphics = createGraphics(videoWidth, videoHeight);
  }

  // 1. 在 pg 上繪製左右顛倒的攝影機影像
  pg.clear();
  pg.push();
  pg.translate(videoWidth, 0); // 移動原點到右側
  pg.scale(-1, 1); // 左右翻轉
  pg.image(capture, 0, 0, videoWidth, videoHeight);
  pg.pop();

  // 根據影像是否旋轉，計算正確的縮放比例
  let scaleFactorX, scaleFactorY;
  if (isVideoEffectivelyRotated) {
    // 如果影像被旋轉了，來源的寬高要對調來計算縮放比例
    scaleFactorX = videoWidth / nativeVideoHeight;
    scaleFactorY = videoHeight / nativeVideoWidth;
  } else {
    // 如果影像沒有旋轉，正常計算縮放比例
    scaleFactorX = videoWidth / nativeVideoWidth;
    scaleFactorY = videoHeight / nativeVideoHeight;
  }

  // 2. 在 maskGraphics 上繪製臉部輪廓作為遮罩
  maskGraphics.clear();
  maskGraphics.fill(255); // 遮罩內部為白色 (可見)
  maskGraphics.noStroke();
  drawFaceContourToMask(maskGraphics, videoWidth, videoHeight, scaleFactorX, scaleFactorY, isVideoEffectivelyRotated, rotationAngleDegrees, nativeVideoWidth, nativeVideoHeight);

  // 3. 將遮罩應用到 pg 上
  pg.mask(maskGraphics);

  // 4. 將處理後的 pg 繪製到主畫布上，使其置中
  // 由於 pg 已經包含了旋轉和鏡像後的影像，我們直接繪製即可
  // 如果需要整個畫布旋轉，可以在這裡對主畫布的 context 進行操作，但通常不建議這樣做，會影響所有繪圖
  image(pg, x, y);

  // 5. 在臉部外層輪廓上繪製光暈效果
  push();
  translate(x, y); // 將繪圖原點移動到影像顯示的左上角
  drawGlowingFaceContour(videoWidth, videoHeight, scaleFactorX, scaleFactorY, isVideoEffectivelyRotated, rotationAngleDegrees, nativeVideoWidth, nativeVideoHeight);
  pop();
}

function drawFaceContourToMask(targetGraphics, vWidth, vHeight, scaleFactorX, scaleFactorY, isVideoEffectivelyRotated, rotationAngleDegrees, nativeVideoWidth, nativeVideoHeight) {
  // 保護措施：確保在攝影機準備好（寬度不為0）且有偵測到臉部時才進行繪製
  if (predictions.length === 0 || capture.width === 0) {
    return;
  }

  // 遍歷所有偵測到的臉部 (通常只有一個)
  for (let i = 0; i < predictions.length; i++) {
    const keypoints = predictions[i].scaledMesh; // 獲取臉部關鍵點，這些點已縮放至 capture.width/height
    
    // 繪製臉部最外層輪廓到遮罩畫布
    targetGraphics.beginShape();
    for (let j = 0; j < faceOuterContourIndices.length; j++) {
      const index = faceOuterContourIndices[j];
      let [px, py] = keypoints[index];
      
      // 如果影像在螢幕上被旋轉了，則先對關鍵點座標進行旋轉變換
      if (isVideoEffectivelyRotated) {
        let tempPx = px;
        if (rotationAngleDegrees === 90) { // 順時針 90 度 (例如：橫向影片在直向裝置上)
          px = py;
          py = nativeVideoWidth - tempPx;
        } else if (rotationAngleDegrees === 270) { // 逆時針 90 度
          px = nativeVideoHeight - py;
          py = tempPx;
        }
        // 如果有 180 度旋轉，可以添加相應的邏輯：
        // else if (rotationAngleDegrees === 180) {
        //   px = nativeVideoWidth - tempPx;
        //   py = nativeVideoHeight - py;
        // }
      }

      // 將關鍵點從攝影機原始尺寸縮放到 pg 的顯示尺寸
      px *= scaleFactorX;
      py *= scaleFactorY;

      // 由於 pg 已經進行了左右顛倒 (pg.scale(-1, 1))，
      // 這裡繪製到 maskGraphics 的座標也需要進行相同的鏡像處理，以匹配 pg 上的影像
      px = vWidth - px;
      
      targetGraphics.vertex(px, py);
    }
    targetGraphics.endShape(CLOSE); // 閉合輪廓以形成實心遮罩
  }
}

// 新增：繪製帶有光暈效果的臉部輪廓
function drawGlowingFaceContour(vWidth, vHeight, scaleFactorX, scaleFactorY, isVideoEffectivelyRotated, rotationAngleDegrees, nativeVideoWidth, nativeVideoHeight) {
  // 保護措施：確保在攝影機準備好（寬度不為0）且有偵測到臉部時才進行繪製
  if (predictions.length === 0 || capture.width === 0) {
    return;
  }

  // 遍歷所有偵測到的臉部 (通常只有一個)
  for (let i = 0; i < predictions.length; i++) {
    const keypoints = predictions[i].scaledMesh; // 獲取臉部關鍵點，這些點已縮放至 capture.width/height

    // 光暈效果直接繪製在主畫布上，所以不需要 pg 的 translate/scale
    noFill(); // 只繪製線條，不填滿

    // 定義光暈的顏色和粗細層次
    const glowColors = [
      [255, 0, 0, 200], // 最亮的紅色，較不透明
      [255, 50, 50, 150], // 稍淺的紅色，透明度增加
      [255, 100, 100, 100], // 更淺的紅色，更透明
      [255, 150, 150, 50],  // 淺紅色，非常透明
      [255, 200, 200, 20]   // 最淺的紅色，幾乎透明
    ];
    const glowWeights = [1, 3, 5, 7, 9]; // 逐漸增加線條粗細

    for (let g = 0; g < glowColors.length; g++) {
      stroke(glowColors[g][0], glowColors[g][1], glowColors[g][2], glowColors[g][3]);
      strokeWeight(glowWeights[g]);

      for (let j = 0; j < faceOuterContourIndices.length; j++) {
        const index1 = faceOuterContourIndices[j];
        const index2 = faceOuterContourIndices[(j + 1) % faceOuterContourIndices.length]; // 連接最後一個點到第一個點
        let [px1, py1] = keypoints[index1];
        let [px2, py2] = keypoints[index2];

        // 如果影像在螢幕上被旋轉了，則先對關鍵點座標進行旋轉變換
        if (isVideoEffectivelyRotated) {
          let tempPx1 = px1;
          let tempPx2 = px2;
          if (rotationAngleDegrees === 90) { // 順時針 90 度
            px1 = py1; py1 = nativeVideoWidth - tempPx1;
            px2 = py2; py2 = nativeVideoWidth - tempPx2;
          } else if (rotationAngleDegrees === 270) { // 逆時針 90 度
            px1 = nativeVideoHeight - py1; py1 = tempPx1;
            px2 = nativeVideoHeight - py2; py2 = tempPx2;
          }
        }

        // 將關鍵點從攝影機原始尺寸縮放到 pg 的顯示尺寸
        px1 *= scaleFactorX; py1 *= scaleFactorY;
        px2 *= scaleFactorX; py2 *= scaleFactorY;

        // 由於主畫布已經 translate(x, y) 到影像位置，這裡的座標是相對於影像左上角的
        // 並且需要進行鏡像處理，以匹配 pg 上的影像
        line(vWidth - px1, py1, vWidth - px2, py2);
      }
    }
  }
}

// 當瀏覽器視窗大小改變時，自動調整畫布大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 重新創建 p5.Graphics 物件以匹配新的視窗大小
  // 這裡只是初始化，實際大小會在 draw() 中根據 videoWidth/videoHeight 調整
  pg = createGraphics(1, 1); 
  maskGraphics = createGraphics(1, 1); 
  // 如果希望星星也隨視窗大小重新分佈，可以在這裡重新呼叫 generateStars()
  // stars = []; // 清空舊的星星
  // generateStars(); // 生成新的星星
}
