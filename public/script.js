const videoElement = document.getElementsByClassName('input_video')[0];

let grahamScan;
let connectButton;
let serialController;

let externalData = 0;
let localData = 0;
let externalConvexHull = 0;
let localConvexHull = 0;
let localStrokeWeight = 0.0;
let externalStrokeWeight = 0.0;
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
        grahamScan.addPoint(externalData[i].x, externalData[i].y);
    }
    externalConvexHull = grahamScan.getHull();
    grahamScan = new ConvexHullGrahamScan(); // Reset the GrahamScan by overwriting it

    // Compute the Stroke Weight
    externalStrokeWeight = getStrokeWeight(externalData, externalConvexHull);
    externalDataTimeout = 20; // Reset the Timer for external Data
})

// The Handpose-Model outputs a new prediction
function onResults(results) {
    if (results.multiHandLandmarks) {
        if (results.multiHandLandmarks.length > 0) {
            localData = results.multiHandLandmarks[0];
            socket.emit('prediction', localData); // Emit the new prediction to Server

            // Finding the Convex Hull
            for (let i = 0; i < localData.length; i++) {
                grahamScan.addPoint(localData[i].x, localData[i].y);
            }
            localConvexHull = grahamScan.getHull();
            grahamScan = new ConvexHullGrahamScan(); // Reset the GrahamScan by overwriting it

            // Compute the Stroke Weight
            localStrokeWeight = getStrokeWeight(localData, localConvexHull);
            localDataTimeout = 20; // Reset the Timer for internal Data
        }
    }
}

function setup() {
    createCanvas(1920, 1440);

    // init graham scan algorithm
    grahamScan = new ConvexHullGrahamScan();

    // init serial connection with baudrate
    serialController = new SerialController(57600);

    // init gui
    connectButton = createButton("Initialize Serial Connection");
    connectButton.class("button");
    connectButton.mousePressed(() => {
        serialController.init();
    });
}

function draw() {
    background(0);
    translate(width, 0);
    scale(-1, 1);

    if (localData) {
        drawLandmarksAsPoints(localData, localStrokeWeight, 0);
    }

    if (externalData) {
        drawLandmarksAsPoints(externalData, externalStrokeWeight, 1);
    }

    if (localConvexHull) {
        drawConvexHull(localConvexHull);
    }

    if (externalConvexHull) {
        drawConvexHull(externalConvexHull);
    }

    if (localConvexHull && externalConvexHull) {
        intersectionArea = intersect(localConvexHull, externalConvexHull);
        if (intersectionArea.length > 0) {
            drawConvexHull(intersectionArea[0], 1);
        }
    }

    if (localConvexHull) {
        resetMatrix();
        textAlign(CENTER, CENTER);
        textSize(60);
        textWidth(1);
        noStroke();
        fill(255);
        text(Math.round(polygonArea(localConvexHull) * 100) / 100, width / 2, 50);
        text(localStrokeWeight, width / 2, 100);
    }

    if (intersectionArea) {
        if (intersectionArea.length > 0) {
            let randomInt = Math.floor(Math.random() * 180);

            // write value to serial port
            serialController.write("WHATEVER");
            serialController.write(" "); // If sending multiple variables, they are seperated with a blank space
            serialController.write(randomInt); // send integer as string
            serialController.write("\r\n"); // to finish your message, send a "new line character"
        }
    }

    // Decrementing the local and external Timers
    localDataTimeout -= 1;
    externalDataTimeout -= 1;
    if (localDataTimeout <= 0) {
        localData = 0;
        localConvexHull = 0;
        intersectionArea = 0;
    }
    if (externalDataTimeout <= 0) {
        externalData = 0;
        externalConvexHull = 0;
        intersectionArea = 0;
    }
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.3.1632795355/${file}`;
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
    width: 160,
    height: 120
});

camera.start();

function drawLandmarksAsPoints(landmarks, weight, color) {
    if (color === 0) {
        fill(0, 255, 0);
    } else if (color === 1) {
        fill(255, 0, 0);
    }
    noStroke();
    for (let i = 0; i < landmarks.length; i++) {
        ellipse(landmarks[i].x * width, landmarks[i].y * height, 80 * weight, 80 * weight);
    }
}

function drawHandprint(landmarks, convexHull){

}

function drawConvexHull(landmarks, filled) {
    if (filled === 1) {
        noStroke();
        fill(255, 0, 255);
    } else if (!filled) {
        stroke(255);
        strokeWeight(5);
        noFill();
    }
    beginShape();
    for (let i = 0; i < landmarks.length; i++) {
        vertex(landmarks[i].x * width, landmarks[i].y * height);
    }
    endShape(CLOSE);
}

function getStrokeWeight(points, convexHull) {
    let area = calcPolygonArea(convexHull);
    let weight = 0.0;

    weight += distance(points[0], points[4]);
    weight += 3 * distance(points[0], points[8]);
    weight += 3 * distance(points[0], points[12]);
    weight += 3 * distance(points[0], points[16]);
    weight += 3 * distance(points[0], points[20]);
    weight += 12 * distance(points[4], points[20]);
    weight += 8 * distance(points[8], points[20]);

    return Math.floor(area / weight * 10000) / 100;
}

function calcPolygonArea(vertices) {
    var total = 0;

    for (var i = 0, l = vertices.length; i < l; i++) {
        var addX = vertices[i].x;
        var addY = vertices[i == vertices.length - 1 ? 0 : i + 1].y;
        var subX = vertices[i == vertices.length - 1 ? 0 : i + 1].x;
        var subY = vertices[i].y;

        total += (addX * addY * 0.5);
        total -= (subX * subY * 0.5);
    }

    return Math.abs(total);
}