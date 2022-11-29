// *** Imports
const express = require("express");
const { start } = require("repl");
const { Manager } = require("socket.io-client");
const { isDataView } = require("util/types");
const { SockID, SocketManager } = require("./SocketManager.js");

// HTTP, SocketIO Init
const app = express();
const http = require("http").createServer(app);
const socket = require("socket.io")(http, {
    transports: ["polling", "websocket"]
})

// Server Variables
var totalHttpRequests = 0;
var totalSocketConnectionsEstablished = 0;
var serverStartDate = new Date().toLocaleString() + " " + Intl.DateTimeFormat().resolvedOptions().timeZone;
var manager = new SocketManager();
const port = process.env.PORT || 3000;


// Socket Listener on defined Port
http.listen(port, ()=>{
    console.log("Listning to port " + port);
    
    // Socket Connection established
    socket.on("connection", (socket) =>{
        console.log(socket.id + " connected, total_socketConnections=" + totalSocketConnectionsEstablished++);

        // Add to Socket Data-Manager
        var currentSocketID = new SockID();
        currentSocketID.socketNumber = totalSocketConnectionsEstablished;
        currentSocketID.id = socket.id;
        currentSocketID.connectionDate = new Date().toLocaleString() + " " + Intl.DateTimeFormat().resolvedOptions().timeZone;
        manager.add(currentSocketID);
        
        // Message Client with local Time
        socket.emit("Server_SendLocalTime", new Date().toLocaleString());

        // Client sends username
        socket.on("Client_SendName", (arg) => {
            console.log(socket.id + " event 'Client_SendName' = " + arg)
            currentSocketID.name = arg;
        });
        
        socket.on("Client_SendTimezone", (arg) => {
            console.log(socket.id + " event 'Client_SendTimezone' = " + arg)
            currentSocketID.timeZone = arg;
        });

        // Client Sends Message 
        socket.on("Client_SendMessage", (arg) => {
            console.log(socket.id + " sent 'hello' = " + arg)
            currentSocketID.msg = arg;
        });

        // Client Sends Message 
        socket.on("Client_ConnectionCloseRequest", (arg) => {
            console.log(socket.id + " requesting disconnect");
            socket.disconnect();
        });
        
        // Client Disconnects
        socket.on("disconnect", (arg) => {
            console.log(socket.id + " disconnected: " + arg);
            currentSocketID.extras = arg;
            currentSocketID.disconnectionDate = new Date().toLocaleString() + " " + Intl.DateTimeFormat().resolvedOptions().timeZone;
        })
        
    });
    
});

// Generic HTTP-Connect Listener
http.on("connection", (socket) =>{
    console.log("HTTP Connection");
});

// GET-Request
app.get("/",(req,res)=>{
    var header = "[GET/HTML - Answer] Verteilte Systeme Rockt! 1 in den Chat für meine Ponybros" 
    var serverVisits = "<br>Server HTTP/Browser visits: " + totalHttpRequests++;
    var started = "<br> Server started: " + serverStartDate;
    
    var currentTime = "<br> Request erhalten am: " + new Date().toLocaleString();
    
    var socketInfos = "";
    for (var i = 0; i < manager.size(); i++) {
        socketInfos += manager.arr()[i].toString();
    }
    
    
    
    var totalSocketConnections = "<br><br> Total Socket Connections Established (on Port " + port + "): " + totalSocketConnectionsEstablished +
        "<br> Socket History:";
    res.send(header + serverVisits + started + currentTime 
         + totalSocketConnections + socketInfos);
});