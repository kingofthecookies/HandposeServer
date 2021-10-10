const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const context = canvasElement.getContext('2d');

let externalData;
let localData;
let externalConvexHull;
let localConvexHull;

// initiate socket connection to server url
socket = io.connect('http://localhost:3000');

socket.on('prediction', (data) => {
    console.log("data recieved");
    externalData = data;
})

function onResults(results) {
    if (results.multiHandLandmarks) {
        localData = results.multiHandLandmarks;
        socket.emit('prediction', localData);
    }
}

window.requestAnimationFrame(loop);

function loop(timeStamp) {
    draw();
    // Keep requesting new frames
    window.requestAnimationFrame(loop);
}

function draw() {
    context.save();
    context.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (localData) {
        for (const landmarks of localData) {
            drawConnectors(context, landmarks, HAND_CONNECTIONS,
                {color: '#00FF00', lineWidth: 5});
            drawLandmarks(context, landmarks, {color: '#FF0000', lineWidth: 2});
        }
    }

    if (externalData) {
        for (const landmarks of externalData) {
            drawConnectors(context, landmarks, HAND_CONNECTIONS,
                {color: '#FF0000', lineWidth: 5});
            drawLandmarks(context, landmarks, {color: '#00FF00', lineWidth: 2});
        }
    }

    context.restore();
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