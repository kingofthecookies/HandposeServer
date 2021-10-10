const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

let predictionData;


// initiate socket connection to server url
socket = io.connect('http://localhost:3000');

// execute processData when prediction event occurs
socket.on('prediction', (data) => {
    console.log("data recieved");
    if (data.multiHandLandmarks) {
        predictionData = data.multiHandLandmarks;
    }
})

function onResults(results) {
    socket.emit('prediction', results);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        // console.log(results.multiHandLandmarks);
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                {color: '#00FF00', lineWidth: 5});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});
        }
    }

    if (predictionData) {
        for (const landmarks of predictionData) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                {color: '#FF0000', lineWidth: 5});
            drawLandmarks(canvasCtx, landmarks, {color: '#00FF00', lineWidth: 2});
        }
    }
    canvasCtx.restore();
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});
hands.setOptions({
    maxNumHands: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
});
camera.start();