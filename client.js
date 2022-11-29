const io = require("socket.io-client");
var socket;
var host = "https://socketio-server.up.railway.app/";
//host = "ws://localhost:3000";

// Declared to call in Angular App later on
function connect() {
    socket =  io(host,{
      transports: ['websocket']
    });
  }
connect();

var userName = "Daniel";
var messageToServer = "Owo v2";


socket.on("connect", () => {
    console.log("connection established, sockedID=" + socket.id);
    socket.emit("Client_SendName", userName);
    socket.emit("Client_SendMessage", messageToServer);
    socket.emit("Client_SendTimezone", Intl.DateTimeFormat().resolvedOptions().timeZone);

    socket.on("Server_SendLocalTime", (arg) => {
      console.log(arg);
      console.log("time received! ctrl + c to exit");
      socket.emit("Client_ConnectionCloseRequest");
    });

    socket.on("disconnect", (arg) => {
      console.log(arg);
    });

  });

  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });

