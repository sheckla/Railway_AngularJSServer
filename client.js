/****************************
 Starting the Client
 ****************************
* 1. install NodeJS https://nodejs.org/en/download/
* 2. start terminal
* 3. type 'npm install'
* 4. node client.js
* 5. See Socket-Connection from Server at https://socketio-server.up.railway.app/
*/
var userName = "Daniel";
var messageToServer = "oWo v2";


/****************************
 Client Socket Initialization
 ****************************/
const io = require("socket.io-client");
var host = "https://socketio-server.up.railway.app/"; 
// ws:// normal websocket prefix
// wss:// secure websocket prefix
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
    socket.emit("Client_InfoQuery");

    // Receive Listener:  Server Local Time
    socket.on("Server_SendLocalTime", (arg) => {
      console.log(arg);
      console.log("time received! ctrl + c to exit");
      socket.emit("Client_ConnectionCloseRequest"); // Request Disconnect
    });

    // Receive Listener:  Server Local Time
    socket.on("Server_Response_InfoQuery", (arg) => {
      console.log(arg.id);
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

