const videoElement = document.getElementsByClassName('input_video')[0];
let convexHull = new ConvexHullGrahamScan();

let externalData;
let localData;
let externalConvexHull;
let localConvexHull;

// initiate socket connection to server url
socket = io.connect('http://localhost:3000');

socket.on('prediction', (data) => {
    externalData = data;

    for (let i = 0; i < externalData.length; i++) {
        convexHull.addPoint(externalData[i].x, externalData[i].y);
    }
    externalConvexHull = convexHull.getHull();
    convexHull = new ConvexHullGrahamScan();
})

function onResults(results) {
    if (results.multiHandLandmarks) {
        if (results.multiHandLandmarks.length > 0) {
            localData = results.multiHandLandmarks[0];
            socket.emit('prediction', localData);

            for (let i = 0; i < localData.length; i++) {
                convexHull.addPoint(localData[i].x, localData[i].y);
            }
            localConvexHull = convexHull.getHull();
            convexHull = new ConvexHullGrahamScan();
        }
    }
}

function setup() {
    createCanvas(1920, 1440);
}

function draw() {
    background(0);

    if (localData) {
        fill(0, 255, 0);
        noStroke();
        for (let i = 0; i < localData.length; i++) {
            ellipse(localData[i].x * 1920, localData[i].y * 1440, 30, 30);
        }
    }

    if (externalData) {
        fill(255, 0, 0);
        noStroke();
        for (let i = 0; i < externalData.length; i++) {
            ellipse(externalData[i].x * 1920, externalData[i].y * 1440, 30, 30);
        }
    }

    if (localConvexHull) {
        stroke(255, 255, 255);
        strokeWeight(5);
        noFill();
        beginShape();
        for (let i = 0; i < localConvexHull.length; i++) {
            vertex(localConvexHull[i].x * 1920, localConvexHull[i].y * 1440);
        }
        endShape(CLOSE);
    }

    if (externalConvexHull) {
        stroke(255, 255, 255);
        strokeWeight(5);
        noFill();
        beginShape();
        for (let i = 0; i < externalConvexHull.length; i++) {
            vertex(externalConvexHull[i].x * 1920, externalConvexHull[i].y * 1440);
        }
        endShape(CLOSE);
    }

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