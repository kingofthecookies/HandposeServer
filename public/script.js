const videoElement = document.getElementsByClassName('input_video')[0];
let convexHull = new ConvexHullGrahamScan();

let externalData = 0;
let localData = 0;
let externalConvexHull = 0;
let localConvexHull = 0;
let intersectionArea = 0;
let externalDataTimeout = 20;
let localDataTimeout = 20;

// Initiate socket connection to server URL
socket = io.connect('http://localhost:3000');

// Client receives new Data from the Server
socket.on('prediction', (data) => {
    externalData = data;

    // Finding the Convex Hull
    for (let i = 0; i < externalData.length; i++) {
        convexHull.addPoint(externalData[i].x, externalData[i].y);
    }
    externalConvexHull = convexHull.getHull();
    convexHull = new ConvexHullGrahamScan(); // Reset the GrahamScan by overwriting it

    externalDataTimeout = 20; // Reset the Timer for external Data
})

// The Handpose-Model outputs a new prediction
function onResults(results) {
    if (results.multiHandLandmarks) {
        if (results.multiHandLandmarks.length > 0) {
            localData = results.multiHandLandmarks[0];
            socket.emit('prediction', localData); // Emit the new prediction to Server

            //Finding the Convex Hull
            for (let i = 0; i < localData.length; i++) {
                convexHull.addPoint(localData[i].x, localData[i].y);
            }
            localConvexHull = convexHull.getHull();
            convexHull = new ConvexHullGrahamScan(); // Reset the GrahamScan by overwriting it

            localDataTimeout = 20; // Reset the Timer for internal Data
        }
    }
}

function setup() {
    createCanvas(1920, 1440);
}

function draw() {
    background(0);
    translate(width, 0);
    scale(-1, 1);

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

    if (localConvexHull && externalConvexHull) {
        intersectionArea = intersect(localConvexHull, externalConvexHull);
        if (intersectionArea.length > 0) {
            noStroke();
            fill(255, 0, 255);
            beginShape();
            for (let i = 0; i < intersectionArea[0].length; i++) {
                vertex(intersectionArea[0][i].x * 1920, intersectionArea[0][i].y * 1440);
            }
            endShape(CLOSE);
        }
    }

    // Decrementing the local and external Timers
    localDataTimeout -= 1;
    externalDataTimeout -= 1;
    if(localDataTimeout <= 0){
        localData = 0;
        localConvexHull = 0;
    }
    if(externalDataTimeout <= 0){
        externalData = 0;
        externalConvexHull = 0;
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