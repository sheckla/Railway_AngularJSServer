/****************************
 Importing
 ****************************/
const express = require("express");
const { start } = require("repl");
const { Manager } = require("socket.io-client");
const { isDataView } = require("util/types");
const { SockID, SocketManager } = require("./SocketManager.js");

/****************************
 HTTP Socket Initialization
 ****************************/
const app = express();
const http = require("http").createServer(app);
const socket = require("socket.io")(http, {
    transports: ["polling", "websocket"]
})

/****************************
 Server Variables
 ****************************/
var totalHttpRequests = 0;
var totalSocketConnectionsEstablished = 0;
var serverStartDate = new Date().toLocaleString() + " " + Intl.DateTimeFormat().resolvedOptions().timeZone;
var manager = new SocketManager();
const port = process.env.PORT || 3000;


/****************************
 Socket Listener on defined port
 ****************************/
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
        
        // Send Local Server Time to client;
        socket.emit("Server_SendLocalTime", new Date().toLocaleString());


        /******************
         Receive Listeners
        *******************/

        // Client Username
        socket.on("Client_SendName", (arg) => {
            console.log(socket.id + " event 'Client_SendName' = " + arg)
            currentSocketID.name = arg;
        });
        
        // Client Timezone
        socket.on("Client_SendTimezone", (arg) => {
            console.log(socket.id + " event 'Client_SendTimezone' = " + arg)
            currentSocketID.timeZone = arg;
        });

        // Client Message
        socket.on("Client_SendMessage", (arg) => {
            console.log(socket.id + " sent 'hello' = " + arg)
            currentSocketID.msg = arg;
        });

        // Client disconnect request
        socket.on("Client_ConnectionCloseRequest", (arg) => {
            console.log(socket.id + " requesting disconnect");
            socket.disconnect();
        });

        socket.on("Client_StringRequest", (arg) => {
            console.log(socket.id + " string request");
            socket.emit("Client_StringRequest_Answer", manager.arr());
        });
        
        // Client Disconnects
        socket.on("disconnect", (arg) => {
            console.log(socket.id + " disconnected: " + arg);
            currentSocketID.extras = arg;
            currentSocketID.disconnectionDate = new Date().toLocaleString() + " " + Intl.DateTimeFormat().resolvedOptions().timeZone;
        })
        
    });
    
});

/****************************
 HTTP Request Handling
 ****************************/

// HTTP-Connect Listener
http.on("connection", (socket) =>{
    console.log("HTTP Connection");
});

// HTTP-GET Request Answer
app.get("/",(req,res)=>{
    res.send("");
    return;
    // Build Reply HTML Message
    var str_HeaderMessage = "[GET/HTML - Answer] Verteilte Systeme Rockt! 1 in den Chat für meine Ponybros" 
    var str_ServerVisits = "<br>Server HTTP/Browser visits: " + totalHttpRequests++;
    var str_ServerStartTime = "<br> Server started: " + serverStartDate;
    var str_RequestReceivedTime = "<br> Request erhalten am: " + new Date().toLocaleString();
    var str_TotalSocketConnectionsAmount = "<br><br> Total Socket Connections Established (on Port " + port + "): " + totalSocketConnectionsEstablished;
    var str_SocketHistory = "<br> Socket History:";
    for (var i = 0; i < manager.size(); i++) {
        str_SocketHistory += manager.arr()[i].toString();
    }

    // Respond with HTML-Document Text
    res.send(str_HeaderMessage + 
        str_ServerVisits + 
        str_ServerStartTime + 
        str_RequestReceivedTime +
        str_TotalSocketConnectionsAmount + 
        str_SocketHistory);
});