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
    grahamScan = new ConvexHullGrahamScan();

    // Compute the Stroke Weight
    externalStrokeWeight = getStrokeWeight(externalData, externalConvexHull);
    externalDataTimeout = 20; // Reset the Timer for external Data
})

// The Handpose-Model outputs a new prediction
function onResults(results) {
    if (results.multiHandLandmarks) {
        if (results.multiHandLandmarks.length > 0) {
            localData = getAuxiliaryPoints(results.multiHandLandmarks[0]);
            socket.emit('prediction', localData); // Emit the new prediction to Server

            // Finding the Convex Hull
            for (let i = 0; i < localData.length; i++) {
                grahamScan.addPoint(localData[i].x, localData[i].y);
            }
            localConvexHull = grahamScan.getHull();
            grahamScan = new ConvexHullGrahamScan();

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
        drawHandprintNew(localData, localStrokeWeight);
        //drawLandmarksAsPoints(localData, localStrokeWeight, 0);
    }

    if (externalData) {
        drawHandprintNew(externalData, externalStrokeWeight);
        //drawLandmarksAsPoints(externalData, externalStrokeWeight, 1);
    }

    if (localConvexHull && externalConvexHull) {
        intersectionArea = intersect(localConvexHull, externalConvexHull);
        if (intersectionArea.length > 0) {
            drawConvexHull(intersectionArea[0], 1);
        }
    }

    /**
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
     **/

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
        ellipse(landmarks[i].x * width, landmarks[i].y * height, 50 * weight, 50 * weight);
    }
}

function drawHandprint(points, weight) {
    fill(255);
    stroke(255);
    // Hand Segment 1
    beginShape();
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[0].x * width, points[0].y * height);
    curveVertex(points[17].x * width, points[17].y * height);
    curveVertex(points[13].x * width, points[13].y * height);
    curveVertex(points[9].x * width, points[9].y * height);
    curveVertex(points[5].x * width, points[5].y * height);
    curveVertex(points[2].x * width, points[2].y * height);
    endShape(CLOSE);

    // Hand Segment 2
    beginShape();
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[0].x * width, points[0].y * height);
    curveVertex(points[5].x * width, points[5].y * height);
    curveVertex(points[2].x * width, points[2].y * height);
    endShape(CLOSE);

    // Thumb
    noFill();
    strokeWeight(weight * 100);
    beginShape();
    curveVertex(points[2].x * width, points[2].y * height);
    curveVertex(points[2].x * width, points[2].y * height);
    curveVertex(points[3].x * width, points[3].y * height);
    curveVertex(points[4].x * width, points[4].y * height);
    curveVertex(points[4].x * width, points[4].y * height);
    endShape();

    // Index Finger
    strokeWeight(weight * 90);
    beginShape();
    curveVertex(points[5].x * width, points[5].y * height);
    curveVertex(points[5].x * width, points[5].y * height);
    curveVertex(points[6].x * width, points[6].y * height);
    curveVertex(points[7].x * width, points[7].y * height);
    curveVertex(points[8].x * width, points[8].y * height);
    curveVertex(points[8].x * width, points[8].y * height);
    endShape();

    // Middle Finger
    beginShape();
    curveVertex(points[9].x * width, points[9].y * height);
    curveVertex(points[9].x * width, points[9].y * height);
    curveVertex(points[10].x * width, points[10].y * height);
    curveVertex(points[11].x * width, points[11].y * height);
    curveVertex(points[12].x * width, points[12].y * height);
    curveVertex(points[12].x * width, points[12].y * height);
    endShape();

    // Ring Finger
    beginShape();
    curveVertex(points[13].x * width, points[13].y * height);
    curveVertex(points[13].x * width, points[13].y * height);
    curveVertex(points[14].x * width, points[14].y * height);
    curveVertex(points[15].x * width, points[15].y * height);
    curveVertex(points[16].x * width, points[16].y * height);
    curveVertex(points[16].x * width, points[16].y * height);
    endShape();

    // Pinky
    beginShape();
    curveVertex(points[17].x * width, points[17].y * height);
    curveVertex(points[17].x * width, points[17].y * height);
    curveVertex(points[18].x * width, points[18].y * height);
    curveVertex(points[19].x * width, points[19].y * height);
    curveVertex(points[20].x * width, points[20].y * height);
    curveVertex(points[20].x * width, points[20].y * height);
    endShape();
}

function drawHandprintNew(points, weight) {
    // Hand Segment 1
    fill(255);
    stroke(255);
    strokeWeight(weight * 90);
    strokeCap(ROUND);
    beginShape();
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[0].x * width, points[0].y * height);
    curveVertex(points[25].x * width, points[25].y * height);
    curveVertex(points[30].x * width, points[30].y * height);
    curveVertex(points[24].x * width, points[24].y * height);
    curveVertex(points[29].x * width, points[29].y * height);
    curveVertex(points[23].x * width, points[23].y * height);
    curveVertex(points[28].x * width, points[28].y * height);
    curveVertex(points[22].x * width, points[22].y * height);
    curveVertex(points[27].x * width, points[27].y * height);
    curveVertex(points[21].x * width, points[21].y * height);
    curveVertex(points[26].x * width, points[26].y * height);
    curveVertex(points[2].x * width, points[2].y * height);
    endShape(CLOSE);

    // Hand Segment 2
    fill(255);
    noStroke();
    beginShape();
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[1].x * width, points[1].y * height);
    curveVertex(points[0].x * width, points[0].y * height);
    curveVertex(points[5].x * width, points[5].y * height);
    curveVertex(points[21].x * width, points[21].y * height);
    curveVertex(points[2].x * width, points[2].y * height);
    endShape(CLOSE);

    // Hand Segment 3
    noFill();
    stroke(255);
    strokeWeight(weight * 90);
    beginShape();
    curveVertex(points[17].x * width, points[17].y * height);
    curveVertex(points[17].x * width, points[17].y * height);
    curveVertex(points[25].x * width, points[25].y * height);
    curveVertex(points[0].x * width, points[0].y * height);
    curveVertex(points[1].x * width, points[1].y * height);
    endShape();

    // Thumb
    noFill();
    stroke(255);
    strokeWeight(weight * 100);
    strokeCap(ROUND);
    line(points[2].x * width, points[2].y * height, points[3].x * width, points[3].y * height);
    line(points[3].x * width, points[3].y * height, points[4].x * width, points[4].y * height);

    // Index Finger
    strokeWeight(weight * 90);
    line(points[5].x * width, points[5].y * height, points[6].x * width, points[6].y * height);
    line(points[6].x * width, points[6].y * height, points[7].x * width, points[7].y * height);
    line(points[7].x * width, points[7].y * height, points[8].x * width, points[8].y * height);

    // Middle Finger
    line(points[9].x * width, points[9].y * height, points[10].x * width, points[10].y * height);
    line(points[10].x * width, points[10].y * height, points[11].x * width, points[11].y * height);
    line(points[11].x * width, points[11].y * height, points[12].x * width, points[12].y * height);

    // Ring Finger
    line(points[13].x * width, points[13].y * height, points[14].x * width, points[14].y * height);
    line(points[14].x * width, points[14].y * height, points[15].x * width, points[15].y * height);
    line(points[15].x * width, points[15].y * height, points[16].x * width, points[16].y * height);

    // Pinky
    line(points[17].x * width, points[17].y * height, points[18].x * width, points[18].y * height);
    line(points[18].x * width, points[18].y * height, points[19].x * width, points[19].y * height);
    line(points[19].x * width, points[19].y * height, points[20].x * width, points[20].y * height);
}

function getAuxiliaryPoints(points) {
    let p1, p2, v1, v2;
    let result = [];

    for (let i = 0; i < points.length; i++) {
        result[i] = points[i];
    }

    // Auxiliary Point 22
    p1 = getMiddlePoint(points[2], points[5]);
    result[points.length] = p1;

    // Auxiliary Point 23
    p1 = getMiddlePoint(points[5], points[9]);
    result[points.length + 1] = p1;

    // Auxiliary Point 24
    p1 = getMiddlePoint(points[9], points[13]);
    result[points.length + 2] = p1;

    // Auxiliary Point 25
    p1 = getMiddlePoint(points[13], points[17]);
    result[points.length + 3] = p1;

    // Auxiliary Point 26
    v1 = {};
    v1.x = points[17].x - points[0].x;
    v1.y = points[17].y - points[0].y;
    p1 = {};
    p1.x = points[0].x + 0.3 * v1.x;
    p1.y = points[0].y + 0.3 * v1.y;
    v2 = {};
    v2.x = p1.x - points[1].x;
    v2.y = p1.y - points[1].y;
    p2 = {};
    p2.x = p1.x + 0.3 * v2.x;
    p2.y = p1.y + 0.3 * v2.y;
    result[points.length + 4] = p2;

    // Auxiliary Point 27
    p1 = getMiddlePoint(points[2], points[3]);
    result[points.length + 5] = p1;

    // Auxiliary Point 28
    p1 = getMiddlePoint(points[5], points[6]);
    result[points.length + 6] = p1;

    // Auxiliary Point 29
    p1 = getMiddlePoint(points[9], points[10]);
    result[points.length + 7] = p1;

    // Auxiliary Point 30
    p1 = getMiddlePoint(points[13], points[14]);
    result[points.length + 8] = p1;

    // Auxiliary Point 31
    p1 = getMiddlePoint(points[17], points[18]);
    result[points.length + 9] = p1;

    return result;
}

function getMiddlePoint(pointA, pointB) {
    let result = {};
    result.x = pointA.x + (pointB.x - pointA.x) / 2;
    result.y = pointA.y + (pointB.y - pointA.y) / 2;
    return result;
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