const port = process.env.PORT || 5000;

// importing express library and setting up server on port 5000
let express = require('express');
let app = express();
let server = app.listen(port);

let socket = require('socket.io');
let io = socket(server);

// define public directory as static
// meaning those are the files available to the client
app.use(express.static('public'));

console.log("Server is running.");


// execute newConnection when connection event occurs
io.sockets.on('connection', newConnection);

function newConnection(socket) {
    console.log('new connection ' + socket.id);

    // execute newPrediction when prediction event occurs
    socket.on('prediction', newPrediction);

    function newPrediction(data) {
        // emits to all sockets but this
        socket.broadcast.emit('prediction', data);
        // console.log("data received from " + socket.id);
    }
}
