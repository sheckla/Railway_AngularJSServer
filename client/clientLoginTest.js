/****************************
 Starting the Client
 ****************************
* 1. install NodeJS https://nodejs.org/en/download/
* 2. start terminal
* 3. type 'npm install'
* 4. node client.js
* 5. See Socket-Connection from Server at https://socketio-server.up.railway.app/
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
  socket = io(host, {
    transports: ["websocket"],
  });
}
connect();

/****************************
 Socket Connection Established
 ****************************/
socket.on("connect", () => {
  console.log("server connection successful");


  // Send to Server:    Information
  socket.emit("Client_SendUsername", userName);
  socket.on("Client_SendUsername_Success", (arg) => {
      if (arg) {
        console.log("login accepted");
      } else {
        console.log("login rejected");
      }
  });

  // Receive Listener:  Disconnect
  socket.on("disconnect", (arg) => {
    console.log("socket disconnected");
  });
});

/****************************
 Socket Connection Failed
 ****************************/
socket.on("connect_error", (err) => {
  console.log(`connect_error due to ${err.message}`);
});
