const cluster = require('node:cluster');
const http = require('node:http');
const numCPUs = require('node:os').availableParallelism();
const process = require('node:process');
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const { Server } = require("socket.io");
const { info } = require('node:console');
const cors = require("cors");
const express = require("express");

require('dotenv').config();
// the foloowing dependencies include 
// cluster -> to create a cluster of workers to utilise all the cores of the CPU
// http -> to create a http server to wrap up the express app
// os -> to get the number of available cores
// process -> to get the process id of the current process
// sticky -> to create a sticky session for the socket.io server



if (cluster.isPrimary) {
    console.log(`Primary is runnig on ${process.pid} `);
    // primary process or the master cluster is the is the main server that spawn workers and manage them (tracking the stage of the workers)  
    const httpServer = http.createServer();  // this create a http server 

    setupMaster(httpServer, {
        loadBalancingMethod: "round-robin" // this works by distributing the incoming requests to the worker with the least number of active connections
    });

    setupPrimary();
    cluster.setupPrimary({
        serialization: "advanced"
    });
    // setup primary is used to setting up connection between workers 

    // spawning the workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork(); // cluster.fork is used to spawn an instance of the server as a worker
    }

    // tracking the state of the workers 
    // cluster.on is used to listen to the events emitted by the workers in the cluster 
    // like "online" event is emitted when a worker is spawned and is ready to receive the incoming requests
    // "exit" event is emitted when a worker is terminated
    // error event is emitted when a worker encounters an error
    // listening event is emitted when a worker is listening on a port
    // disconnect event is emitted when a worker is disconnected

    cluster.on("exit", (worker, code, signal) => {
        console.log("worker " + worker.process.pid + " died");
    })
    cluster.on("online", (worker) => {
        console.log("worker " + worker.process.pid + " is online");
    })
    httpServer.listen(process.env.PORT, () => {
        console.log("Server is running on port ", process.env.PORT);
    })
}

else {
    console.log(`Worker started and is runnig on ${process.pid}`);
    // worker process are the instances of the server that are spawned by the primary process to handle the incoming requests
    const app = express();
    app.use(cors(
        {
            origin: 'http://localhost:5173',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true // Allow credentials
        }
    ));

    // wrapping the express app with the http server
    const httpServer = http.createServer(app);
    // creating the socket.io server 
    const io = require("socket.io")(httpServer, {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true // Allow credentials
        }
    })

    // io is a server side object that is responsible for managing all server side 1. event listeners ,2. derver side emitters and 3. managing connection with clients.


    // a separate cors need to be used for the socket.io server as the cors used for the http/express app will not work for the socket.io server

    {/* Imagine you're running a pizza delivery service called "PizzaHub" and you want to scale up your operations because you're getting more orders. You decide to open multiple branches across the city to handle the increasing demand efficiently.

Clustering:

Opening multiple branches allows you to serve customers from different parts of the city simultaneously. Each branch operates independently but belongs to the same "PizzaHub" brand.
This is similar to clustering in Node.js, where you run multiple instances of your server (branches) to handle incoming requests (orders) from different clients (customers).
Socket.IO Adapter:

Now, imagine each branch has its own delivery system and dispatch center.
To ensure efficient communication between branches and coordinate deliveries, you need a central dispatch system that can track orders and assign them to the nearest available branch.
This central dispatch system acts as the "adapter" in our analogy. It ensures that orders (messages) from customers are correctly routed to the nearest branch (server instance) for delivery.
Similarly, in Socket.IO, the adapter ensures that messages and events are correctly distributed among different server instances in a clustered environment.
Configuring Socket.IO to Use the Adapter:

When setting up your dispatch system, you configure each branch to connect to the central dispatch system.
Similarly, in Socket.IO, you configure your server instances to use the clustering adapter. This ensures that messages and events are distributed effectively across all server instances in the cluster.
Real-time Interactions:

Now, let's say a customer places an order for a pizza. The central dispatch system receives the order and assigns it to the nearest branch for delivery.
Similarly, in Socket.IO, when a client sends a message or performs an action, the clustering adapter ensures that the message is correctly delivered to the appropriate server instance, allowing real-time interactions to occur seamlessly across the cluster. */}

    io.adapter(createAdapter());
    setupWorker(io); // this is used to setup the worker to use the sticky session for the socket.io server

    // the diffeence between io.adapter(createAdapter()) and setupWorker(io) is that the former is used to create the adapter for the socket.io server and the latter is used to setup the worker to use the sticky session for the socket.io server

    io.on("connection", (socket) => {
        // 1. when user is conencted we transmit a message to a user 
        socket.emit("message", "connected to process number " + process.pid+ " with the socket id as "+socket.id);

        // 62.5x = 45*2500
      
            socket.join(`room${(process.pid)}`); // connecting each client to a room with the name as the process room+id of the worker
        // 2 when a message arrives at server from the client with the event message the server send a message back to the client that it has received it 
        socket.on("message", ({text,type}) => {
            
            let socketId = text.split(" ")[1]
            type = "server"
            // say i write "message_ths_to 12450" this message will be sent to the client with socketid 12450 ( by some how searching globally for the client among all the workers ) directly without the need to search first for the room of receipient (figue out how is it working) ?


            socket.to(`${socketId}`).emit("message", {text,type});
            console.log("this line got executed")
           
        //    if(type==="server"){
        //     console.log("this is executed when the message reach desired room ")
        //     socket.to(`${socketId}`).emit("message", {text,type});
        //    }
            // this method will transmit this message to all clients in this room except the client which send the message

            // now to route this message to a prtcicularclient only 
        })

        // 3 socket broadcast is used to send a message to all the clients connected to the server except the client which send the message

        socket.on("broadcast", (data) => {
            socket.broadcast.emit("broadcast", "this message has been broadcasted by server " + data + " from process number " + process.pid)
        }
        )

        // even if sockets are joined to room we can directly use broadcast to broadcast to all clients of all rooms 


        //  socket.emit is used to emit a message to the client who has sent the request now with 1st agr as the event name and 2nd arg as the data to be sent 

        //  socket.emit("message", "Hello from the server"); // this is used to emit a message to the client who has sent the request now 

        // socket.broadcast.emit("message", "Hello from the server"); // this is used to broadcast a message to all the clients connected to the server except the client which send the message
    });





    var corsOptions = {
        origin: '*',
        methods: ['GET', 'POST'],
        optionsSuccessStatus: 200
    }

    app.use(cors(corsOptions));

    app.get("/", (req, res) => {
        res.json({ message: `Worker started and is runnig on ${process.pid}` });
    });


}