/****************************
 Starting the Client
 ****************************
* 1. install NodeJS https://nodejs.org/en/download/
* 2. start terminal
* 3. type 'npm install'
* 4. node client.js
* 5. See Socket-Connection from Server at https://socketio-server.up.railway.app/

{
  "name": "SocketIO",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node server.js"
  },
  "author": "DG",
  "dependencies": {
    "express": "^4.17.1",
    "http": "0.0.1-security",
    "socket.io": "^3.0.0",
    "socket.io-client": "^3.0.0"
  },
  "engines": {
    "node": "v12.18.3"
  }
}



*/
var userName = "Applejack";
var messageToServer = "OwO v2";


/****************************
 Client Socket Initialization
 ****************************/
const io = require("socket.io-client");
var host = "https://socketio-server.up.railway.app/";
host = "ws://localhost:3000";
var socket;

function connect() { 
  socket = io(host,{
    transports: ['websocket']
  });
}
connect();



/****************************
 Socket Connection Established
 ****************************/
socket.on("connect", () => {
    console.log("connection established, sockedID=" + socket.id);

    // Send to Server:    Information
    socket.emit("Client_SendName", userName);
    socket.emit("Client_SendMessage", messageToServer);
    socket.emit("Client_SendTimezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // Receive Listener:  Server Local Time
    socket.on("Server_SendLocalTime", (arg) => {
      console.log(arg);
      console.log("time received! ctrl + c to exit");
    });
    
    socket.emit("Client_StringRequest");
    socket.on("Client_StringRequest_Answer", (msg) => {
      console.log(msg);
      socket.emit("Client_ConnectionCloseRequest"); // Request Disconnect
    });

    // Receive Listener:  Disconnect
    socket.on("disconnect", (arg) => {
      console.log(arg);
    });

  });

/****************************
 Socket Connection Failed
 ****************************/
  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

