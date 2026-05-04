let capture;
let facemesh;
let predictions = []; // 用於儲存臉部辨識結果


async function setup() { // 將 setup 函式標記為 async
  // 建立一個填滿整個視窗的畫布
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機
  capture = createCapture(VIDEO);
  // 隱藏原始的攝影機影像 DOM 元素，因為我們將在畫布上手動繪製它
  capture.hide();

  // 當攝影機影像的元數據（如寬高）載入完成後，才初始化 facemesh 模型
  // 這有助於確保 capture 物件在 ml5.facemesh 呼叫時已完全準備好
  capture.elt.onloadedmetadata = async function() {
    // 載入 faceMesh 模型
    facemesh = await ml5.faceMesh();
    console.log("Facemesh model ready!");

    // 開始監聽預測
    facemesh.listen(capture, results => {
      predictions = results;
    });
  };
}

function draw() {
  // 設定畫布背景顏色
  background('#e7c6ff');

  // 計算影像要顯示的寬度和高度 (全螢幕的 50%)
  const videoWidth = width * 0.5;
  const videoHeight = height * 0.5;

  // 計算影像的 x 和 y 座標，使其置中
  const x = (width - videoWidth) / 2;
  const y = (height - videoHeight) / 2;

  // --- 繪製左右顛倒的影像 ---
  // push() 和 pop() 用於確保接下來的變形(translate, scale)不會影響到其他繪圖元素
  push();

  // 1. 將畫布的原點(0,0)移動到影像要繪製區域的右上角
  translate(x + videoWidth, y);

  // 2. 將 X 軸進行-1倍的縮放，達成水平翻轉(左右顛倒)的效果
  scale(-1, 1);

  // 3. 從新的原點(0,0)開始繪製影像。
  //    因為 X 軸是反的，影像會從右向左繪製回來，看起來就像是鏡像。
  image(capture, 0, 0, videoWidth, videoHeight);

  // --- 繪製臉部輪廓線 ---
  drawKeypoints(videoWidth, videoHeight);

  // 還原畫布的原始狀態
  pop();
}

// 繪製臉部特徵點的函式
function drawKeypoints(w, h) {
  // 您指定的臉部輪廓點編號
  const jawlineIndices = [409, 270, 269, 267, 0, 37, 39, 40, 185, 61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];

  // 遍歷所有偵測到的臉部
  for (let i = 0; i < predictions.length; i += 1) {
    const keypoints = predictions[i].scaledMesh;

    // 設定線條樣式
    stroke(255, 0, 0); // 紅色
    strokeWeight(1);   // 粗細為 1
    noFill();          // 不填充顏色

    // 計算縮放比例，將特徵點座標從原始影像尺寸對應到畫布上的顯示尺寸
    const scaleX = w / capture.width;
    const scaleY = h / capture.height;

    beginShape();
    for (let j = 0; j < jawlineIndices.length; j++) {
      const index = jawlineIndices[j];
      const [x, y] = keypoints[index];
      vertex(x * scaleX, y * scaleY); // 繪製縮放後的頂點
    }
    endShape();
  }
}

// 當瀏覽器視窗大小改變時，自動調整畫布大小
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
