const videoElement = document.getElementsByClassName('input_video')[0];

let grahamScan;
let connectButton;
let serialController;

let settings = true;
let mirrorAxis = {x: false, y: false};
let offsetVector = {x: 0.0, y: 0.0};
let scaleFactor = 1;

let localData = 0;
let localConvexHull = 0;
let localConvexHullArea = 0;
let localStrokeWeight = 0.0;
let localDataTimeout = 20;

let externalData = 0;
let externalConvexHull = 0;
let externalConvexHullArea = 0;
let externalStrokeWeight = 0.0;
let externalDataTimeout = 20;

let intersectionHull = 0;
let intersectionHullArea = 0;


// Initiate socket connection to server URL
// Use http://localhost:5000 for Servers on this machine
// For deployment on Heroku use https://was-vor-der-sprache-kam.herokuapp.com/
socket = io.connect('https://was-vor-der-sprache-kam.herokuapp.com/');

// Client receives new Data from the Server
socket.on('prediction', (data) => {
    externalData = data;

    // Finding the External Convex Hull
    for (let i = 0; i < externalData.length; i++) {
        grahamScan.addPoint(externalData[i].x, externalData[i].y);
    }
    externalConvexHull = grahamScan.getHull();
    grahamScan = new ConvexHullGrahamScan();

    // Compute External Convex Hull Area
    externalConvexHullArea = calcPolygonArea(externalConvexHull);

    // Compute the External Stroke Weight
    externalStrokeWeight = getStrokeWeight(externalData, externalConvexHullArea);
    externalDataTimeout = 20; // Reset the Timer for external Data
})

// The Handpose-Model outputs a new prediction
function onResults(results) {
    if (results.multiHandLandmarks) {
        if (results.multiHandLandmarks.length > 0) {
            localData = getAuxiliaryPoints(results.multiHandLandmarks[0]);
            localData = correctValues(localData, offsetVector, scaleFactor, mirrorAxis);

            // Emit the new prediction to Server if not in Settings
            if (!settings) {
                socket.emit('prediction', localData);
            }

            // Finding the Local Convex Hull
            for (let i = 0; i < localData.length; i++) {
                grahamScan.addPoint(localData[i].x, localData[i].y);
            }
            localConvexHull = grahamScan.getHull();
            grahamScan = new ConvexHullGrahamScan();

            // Finding the Local Convex Hull Area
            localConvexHullArea = calcPolygonArea(localConvexHull);

            // Compute the Local Stroke Weight
            localStrokeWeight = getStrokeWeight(localData, localConvexHullArea);

            // Compute the Intersection Hull & Area
            if (localConvexHull && externalConvexHull) {
                intersectionHull = intersect(localConvexHull, externalConvexHull);
                if (intersectionHull.length > 0) {
                    intersectionHull = intersectionHull[0];
                    intersectionHullArea = calcPolygonArea(intersectionHull);
                } else {
                    intersectionHull = 0;
                }
            }
            // Reset the Timer for internal Data
            localDataTimeout = 20;
        }
    }
}

// Add User Interface to adjust size and position of the Handshape
document.addEventListener('keydown', (e) => {
    if (e.key === "ArrowUp") {
        offsetVector.x -= 0.01;
        offsetVector.x = Math.round(offsetVector.x * 100) / 100;
        localStorage.offsetVectorX = offsetVector.x;
    } else if (e.key === "ArrowDown") {
        offsetVector.x += 0.01;
        offsetVector.x = Math.round(offsetVector.x * 100) / 100;
        localStorage.offsetVectorX = offsetVector.x;
    } else if (e.key === "ArrowLeft") {
        offsetVector.y += 0.01;
        offsetVector.y = Math.round(offsetVector.y * 100) / 100;
        localStorage.offsetVectorY = offsetVector.y;
    } else if (e.key === "ArrowRight") {
        offsetVector.y -= 0.01;
        offsetVector.y = Math.round(offsetVector.y * 100) / 100;
        localStorage.offsetVectorY = offsetVector.y;
    } else if (e.key === "+") {
        scaleFactor += 0.01;
        scaleFactor = Math.round(scaleFactor * 100) / 100;
        localStorage.scaleFactor = scaleFactor;
    } else if (e.key === "-") {
        scaleFactor -= 0.01;
        scaleFactor = Math.round(scaleFactor * 100) / 100;
        localStorage.scaleFactor = scaleFactor;
    } else if (e.key === "x") {
        mirrorAxis.x = !mirrorAxis.x;
        localStorage.mirrorAxisX = mirrorAxis.x;
    } else if (e.key === "y") {
        mirrorAxis.y = !mirrorAxis.y;
        localStorage.mirrorAxisY = mirrorAxis.y;
    } else if (e.key === "s") {
        settings = !settings;
    } else if (e.key === "r") {
        mirrorAxis = {x: false, y: false};
        offsetVector = {x: 0.0, y: 0.0};
        scaleFactor = 1;
    }
});

function setup() {
    createCanvas(1920, 1440);

    // load Variables from the localStorage
    loadLocalData();

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

    if (settings) {
        if (localData) {
            drawLandmarksAsPoints(localData, localStrokeWeight, 0);
        }
    } else {
        if (externalData) {
            drawHandprint(externalData, externalStrokeWeight);
        }
        if (intersectionHull) {
            // drawConvexHull(intersectionHull, 1);
            let proportion = Math.floor(intersectionHullArea / localConvexHullArea * 255);

            // write value to serial port
            serialController.write("CONTACT");
            serialController.write(" "); // If sending multiple variables, they are seperated with a blank space
            serialController.write(proportion); // send integer as string
            serialController.write("\r\n"); // to finish your message, send a "new line character"
        } else {
            serialController.write("CONTACT");
            serialController.write(" ");
            serialController.write(0);
            serialController.write("\r\n");
        }
    }

// Decrementing the local and external Timers
    localDataTimeout -= 1;
    externalDataTimeout -= 1;
    if (localDataTimeout <= 0) {
        localData = 0;
        localConvexHull = 0;
        intersectionHull = 0;
    }
    if (externalDataTimeout <= 0) {
        externalData = 0;
        externalConvexHull = 0;
        intersectionHull = 0;
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
    for (let i = 0; i < 21; i++) {
        ellipse(landmarks[i].x * width, landmarks[i].y * height, 50 * weight, 50 * weight);
    }
}

function drawHandprint(points, weight, shade = 255) {
    // Hand Segment 1
    fill(shade);
    stroke(shade);
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
    fill(shade);
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
    stroke(shade);
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
    stroke(shade);
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

function correctValues(points, offsetVector, scaleFactor, mirrorAxis) {
    let result = [];
    let baseVector = {};

    baseVector.x = points[0].x;
    baseVector.y = points[0].y;

    for (let i = 0; i < points.length; i++) {
        result[i] = {};
        result[i].x = points[i].x;
        result[i].y = points[i].y;
    }

    if (mirrorAxis.x) {
        for (let i = 0; i < points.length; i++) {
            result[i].x = 1 - result[i].x;
        }
    }

    if (mirrorAxis.y) {
        for (let i = 0; i < points.length; i++) {
            result[i].y = 1 - result[i].y;
        }
    }

    for (let i = 0; i < points.length; i++) {
        result[i].x -= baseVector.x;
        result[i].y -= baseVector.y;
        result[i].x *= scaleFactor;
        result[i].y *= scaleFactor;
        result[i].x += baseVector.x;
        result[i].y += baseVector.y;
        result[i].x += offsetVector.x;
        result[i].y += offsetVector.y;
    }
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

function getStrokeWeight(points, area) {
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

function loadLocalData() {
    if (localStorage.offsetVectorX) {
        offsetVector.x = parseFloat(localStorage.offsetVectorX);
    }
    if (localStorage.offsetVectorY) {
        offsetVector.y = parseFloat(localStorage.offsetVectorY);
    }
    if (localStorage.scaleFactor) {
        scaleFactor = parseFloat(localStorage.scaleFactor);
    }
    if (localStorage.mirrorAxisX) {
        mirrorAxis.x = (localStorage.mirrorAxisX === 'true');
    }
    if (localStorage.mirrorAxisY) {
        mirrorAxis.y = (localStorage.mirrorAxisY === 'true');
    }
}