/****************************
 Importing & Setup
 ****************************/
// General libs
const express = require("express");

// Game Server specific libs
const { UniqueMap } = require("./Util/UniqueMap.js");
const { User } = require("./Util/User.js");
const { QuizLobby } = require("./Util/QuizLobby.js");

// constant variables
const port = process.env.PORT || 3000;

// runtime variables
let userManager = new UniqueMap();
let lobbyManager = new UniqueMap();

// *************************
// Open Lobbies for testing
u1 = new User();
u1.name = "Rainbow Dash";
u2 = new User();
u2.name = "Applejack";
u3 = new User();
u3.name = "Pinkie Pie";
u4 = new User();
u4.name = "Rarity";
u5 = new User();
u5.name = "Fluttershy";
u6 = new User();
u6.name = "Twilight Sparkel";
lobby1 = new QuizLobby("Karl Ess Buchclub", u1);
lobby1.add(u4);
lobby2 = new QuizLobby("Magical Tree Garden", u2);
lobby2.add(u5);
lobby2.add(u6);
lobby3 = new QuizLobby("Pumperverein OS", u3);
lobbyManager.set("Karl Ess Buchclub", lobby1);
lobbyManager.set("Magical Tree Garden", lobby2);
lobbyManager.set("Pumperverein OS", lobby3);
// *************************

/****************************
 HTTP Socket Initialization
 ****************************/
const app = express();
const http = require("http").createServer(app);
const socket = require("socket.io")(http, {
  transports: ["polling", "websocket"],
});

http.listen(port, () => {
  log("Listening to port:" + port);

  /****************************
   Main Socket Listener on defined port
  ****************************/
  socket.on("connection", (socket) => {
    logArr([socket.id, "socket connection established"]);
    var currentUser = new User();
    currentUser.socket = socket;

    /****************************
     Client Login
    ****************************/
    socket.on("Client_SendUsername", (username) => {
      log("User: " + username + " wants to log in.");
      var usernameAvailable = !userManager.contains(username);

      // Notify calling client
      socket.emit("Client_SendUsername_Status", usernameAvailable);

      // Send current open Lobbies to client
      socket.emit("CurrentOpenLobbies", getOpenLobbies()); // TODO notify periodically

      //User is found, log in reject
      if (!usernameAvailable) {
        socket.emit("Client_SendUsername_Status", usernameAvailable);
        log("User: " + username + " already logged in - login request rejected.");
        return;
      }

      // Accept login and assign current user to SocketManager
      currentUser.name = username;
      userManager.set(username, currentUser);
      log("User: " + username + " now logged in.");

    });

    /****************************
     Creating Lobby
    ****************************/
    socket.on("Client_LobbyCreationRequest", (lobbyName) => {
      log("User: " + currentUser.name + " wants to create Lobby: " + lobbyName);
      var lobbyNameAvailable = !lobbyManager.contains(lobbyName);

      // Notify calling client
      socket.emit("Client_LobbyCreationRequest_Status", lobbyNameAvailable);

      // Lobby not available - abort
      if (!lobbyNameAvailable) {
        log("Lobby: " + lobbyName + " already exists.");
        return;
      }

      // Lobby available - create
      var quizLobby = new QuizLobby(lobbyName, currentUser);
      lobbyManager.set(lobbyName, quizLobby); // set name and leader
      currentUser.connectedLobbyName = lobbyName; // assign lobby to user
      quizLobby.broadcast("CurrentLobbyInformationChanged", quizLobby.lobbyInfo()); // notify calling client with lobbyInfo
      log("Lobby: " + lobbyName + " has been created");
    });

    /****************************
     Joining Lobby
    ****************************/
    socket.on("Client_LobbyJoinRequest", (lobbyName) => {
      log("User: " + currentUser.name + " wants to join Lobby: " + lobbyName);
      var lobbyExists = lobbyManager.contains(lobbyName);

      // Notify calling client
      socket.emit("Client_LobbyJoinRequest_Status", lobbyExists);

      // Lobby doesn't exist to join - abort
      if (!lobbyExists) {
        log("Lobby: " + lobbyName + " doesn't exists");
        return;
      }

      // Lobby exists - client can join
      lobby = lobbyManager.get(lobbyName);
      lobby.add(currentUser); // add current Client to lobby
      lobby.broadcast("CurrentLobbyInformationChanged", lobby.lobbyInfo()); // Notify all other users in lobby
      currentUser.connectedLobbyName = lobbyName; // assign lobby to user
      log("User: " + currentUser.name + " joined Lobby: " + lobbyName);
    })

    /****************************
     Leaving Lobby 
    ****************************/
    socket.on("Client_LobbyLeaveRequest", (lobbyName) => {
      log("User: " + currentUser.name + " wants to leave Lobby: " + lobbyName);
      var lobbyExists = lobbyManager.contains(lobbyName);

      // Notify calling Client
      socket.emit("Client_LobbyLeaveRequest_Status", lobbyExists);

      handleLobbyLeave(lobbyName, currentUser);
    });

    /****************************
     Starting Lobby 
    ****************************/
     socket.on("Client_LobbyStartRequest", (lobbyName) => {
      // TODO
    });

    /****************************
     Question Topic Request
    ****************************/
    socket.on("Client_RequestQuestionTopics", async (lobbyName) => {
      await lobbyManager.get(lobbyName).fetchQuestions();
      socket.emit("Client_RequestQuestionTopics_Status", lobbyManager.get(lobbyName).currentQuestionTopics);
    })

    /****************************
     Clients Disconnect
    ****************************/
    socket.on("disconnect", (arg) => {
      log("User: " + currentUser.name + " disconnected - " + arg);

      // Remove from userManager to make username available again
      userManager.delete(currentUser.name);
      log("User: " + currentUser.name + " deleted from UserManager");

      handleLobbyLeave(currentUser.connectedLobbyName, currentUser);
    });
  });
});

// Handles lobby leaving events and notifies the joined clients
function handleLobbyLeave(lobbyName, leavingUser) {
  lobbyExists = lobbyManager.contains(lobbyName);

  // Lobby doesn't exist - abort 
  if (!lobbyExists) {
    log("Lobby: " + lobbyName + " doesn't exists");
    return;
  }

  // Lobby exists - remove client from lobby
  lobby = lobbyManager.get(lobbyName);
  leavingUser.connectedLobbyName = null;
  lobby.remove(leavingUser);
  log("User: " + leavingUser.name + " left Lobby: " + lobbyName);

  // Lobby still active with leader - notify all clients in lobby
  if (lobby.leader) {
    lobby.broadcast("CurrentLobbyInformationChanged", lobby.lobbyInfo());
    return;
  }

  // Lobby without leader - delete lobby and kick joined users
  log("Lobby: " + lobbyName + " has no leader. Closing lobby and kicking all users");
  lobby.broadcast("Client_LobbyLeaveRequest_Status", true); // Make all lobby-users leave lobby
  lobbyManager.delete(lobbyName);
}

function getOpenLobbies() {
  lobbies = [];
  lobbyManager.elements.forEach(lobby => {
    lobbies.push(lobby.lobbyInfo());
  })
  return lobbies;
}


// example: log(["message1", "message"])
function logArr(messages) {
  var date = new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  var timestamp = "[" + hours + ":" + minutes + ":" + seconds + "]";

  var logMessage = timestamp + " ";
  messages.forEach((msg) => {
    if (msg !== undefined) {
      logMessage += msg.toString().padEnd(1) + " ";
    }
  });
  console.log(logMessage);
}

function log(str) {
  logArr([str]);
}
