/****************************
 Importing & Setup
 ****************************/
// General libs
const express = require("express");
const { start } = require("repl");
const { Manager } = require("socket.io-client");
const { isDataView } = require("util/types");

// Game Server specific libs
const { SockID, SocketManager } = require("./SocketManager.js");

// constant variables
const port = process.env.PORT || 3000;

// runtime variables
var receivedHTTPRequests = 0;
var receivedSocketConnections = 0;
var startDate_server =
  new Date().toLocaleString() +
  " " +
  Intl.DateTimeFormat().resolvedOptions().timeZone;
let socketManager = new SocketManager();

/****************************
 HTTP Socket Initialization
 ****************************/
const app = express();
const http = require("http").createServer(app);
const socket = require("socket.io")(http, {
  transports: ["polling", "websocket"],
});

http.listen(port, () => {
  log(["Listening to port:", port]);

  /****************************
     Socket Listener on defined port
     ****************************/
  socket.on("connection", (socket) => {
    log([socket.id, "connected"]);
    var currentSocketID = new SockID();

    /******************
         Receive Listeners
         *******************/
    // Client Username - User Initialization
    socket.on("Client_SendUsername", (arg) => {
      console.log("User: " + arg + " wants to log in.");

      //Check if User is connected, lookup in socketManager
      var userAlreadyFound = socketManager.contains(arg);

      //User is found, log in reject
      if (userAlreadyFound == true) {
        socket.emit("Client_SendUsername_Status", !userAlreadyFound);
        console.error("Attention!");
        log([arg, "already logged in - rejecting"]);
        return;
      }

      // Accept login and assign current user to SocketManager
      currentSocketID.id = socket.id;
      currentSocketID.name = arg;
      currentSocketID.connectionDate =
        new Date().toLocaleString() +
        " " +
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      socketManager.set(arg, currentSocketID);

      socket.emit("Client_SendUsername_Status", !userAlreadyFound);
      log([arg, "now logged in - successfull"]);
    });

    // Client disconnect request
    socket.on("Client_RequestConnectionClose", (arg) => {
      log([socket.id, "requests disconnect"]);
      socket.disconnect();
    });

    // Client Disconnects
    socket.on("disconnect", (arg) => {
      log([currentSocketID.name, "disconnected", arg]);
      socketManager.delete(currentSocketID.name);
    });
  });
});

/****************************
 HTTP Request Handling
 ****************************/

// HTTP-GET Request Answer
app.get("/", (req, res) => {
  res.send("");
  return;
});

// example: log(["message1", "message"])
function log(messages) {
  var date = new Date();
  var logMessage =
    "[" +
    date.getHours().toString().padStart(2, "0") +
    ":" +
    date.getMinutes().toString().padStart(2, "0") +
    ":" +
    date.getSeconds().toString().padStart(2, "0") +
    "] ";
  messages.forEach((msg) => {
    logMessage += msg.toString().padEnd(1) + " ";
  });
  console.log(logMessage);
}
