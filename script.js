// Prototype MediaPipe Hands + heuristics simple pour reconnaître open palm / fist / thumb up
const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const detectedDiv = document.getElementById('detectedGesture');
const translationDiv = document.getElementById('translationText');

let camera = null;
let hands = null;

function resizeCanvas() {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
}
function landmarksToArray(landmarks) {
  return landmarks.map(l => ({x:l.x, y:l.y, z:l.z}));
}

// Simple helper : distance between two normalized landmarks
function dist(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

// Count extended fingers (rough) using angle between tip, pip, mcp along y distance
function countExtendedFingers(landmarks){
  // landmarks: MediaPipe 21 points
  // For each finger, compare tip to pip & mcp — approximate by distance to wrist
  const wrist = landmarks[0];
  const tipsIdx = [4,8,12,16,20]; // thumb, index, middle, ring, pinky
  let extended = 0;
  for(let i=0;i<tipsIdx.length;i++){ 
    const tip = landmarks[tipsIdx[i]];
    const pip = landmarks[tipsIdx[i]-2] || landmarks[tipsIdx[i]];
    // if tip is farther from wrist than pip => extended
    if(dist(tip,wrist) > dist(pip,wrist)) extended++;
  }
  return extended;
}

// Heuristic for thumb-up: thumb tip above other fingers and hand mostly closed
function isThumbUp(landmarks){
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  // ensure thumb tip is to the left/right and above wrist relative to index base
  // Use simple check: thumb tip y less than index mcp y (higher on screen => smaller y)
  if (thumbTip.y < indexMcp.y - 0.03) {
    // Check other fingers mostly not extended
    const extended = countExtendedFingers(landmarks);
    return (extended <= 2); // mostly closed except thumb
  }
  return false;
}

function interpretGesture(landmarks){
  if(!landmarks || landmarks.length===0) return {name:'aucun', text:'—'};
  const arr = landmarksToArray(landmarks);
  const extended = countExtendedFingers(arr);
  if(isThumbUp(arr)) return {name:'thumb_up', text:'Oui 👍'};
  if(extended >= 4) return {name:'open_palm', text:'Bonjour 👋'};
  if(extended <= 1) return {name:'fist', text:'Non 👎'};
  return {name:'unknown', text:'Non reconnu'};
}

async function onResults(results){
  if(!results.multiHandLandmarks || results.multiHandLandmarks.length===0){
    canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
    detectedDiv.textContent = 'Aucun geste détecté';
    translationDiv.textContent = 'Traduction : —';
    return;
  }
  canvasCtx.save();
  canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
  // draw landmarks and connections
  for (const landmarks of results.multiHandLandmarks) {
    window.drawConnectors(canvasCtx, landmarks, window.HAND_CONNECTIONS,
      {color: '#00FF00', lineWidth: 2});
    window.drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1});
    // interpret
    const g = interpretGesture(landmarks);
    detectedDiv.textContent = `Geste: ${g.name}`;
    translationDiv.textContent = `Traduction : ${g.text}`;
  }
  canvasCtx.restore();
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  // init MediaPipe Hands
  hands = new Hands({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });
  hands.onResults(onResults);

  // camera utils
  camera = new Camera(videoElement, {
    onFrame: async () => {
      resizeCanvas();
      await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
  });
  await camera.start();
});

stopBtn.addEventListener('click', () => {
  startBtn.disabled = false;
  if(camera) camera.stop();
  if(hands) hands.close();
  canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);
  detectedDiv.textContent = 'Aucun geste détecté';
  translationDiv.textContent = 'Traduction : —';
});
