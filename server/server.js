/****************************
 Importing & Setup
 ****************************/
// General libs
const express = require("express");

// Game Server specific libs
const { UniqueMap } = require("./UniqueMap");
const { User } = require("./User");
const { QuizLobby } = require("./QuizLobby");

// constant variables
const port = process.env.PORT || 3000;

// runtime variables
let userManager = new UniqueMap();
let lobbyManager = new UniqueMap();

// *************************
// Lobby Testing
// *************************


/****************************
 HTTP Socket Initialization
 ****************************/
const app = express();
const http = require("http").createServer(app);
const socket = require("socket.io")(http, {
  transports: ["polling", "websocket"],
});

/********************************************************
 Main HTTP/Socket Listener on defined port
********************************************************/
broadcastOpenLobbies();
http.listen(port, () => {
    log("Listening to port:" + port);

    // Socket Connected
    socket.on("connection", (socket) => {
    logArr([socket.id, "socket connection established"]);

    // Init current client/User
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
      quizLobby.broadcast("CurrentLobbyInformationChanged", quizLobby.toJSON()); // notify calling client with lobbyInfo
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
      lobby.join(currentUser); // add current Client to lobby
      lobby.broadcast("CurrentLobbyInformationChanged", lobby.toJSON()); // Notify all other users in lobby
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
    socket.on("Client_LobbyStartRequest", async (lobbySettings) => {
      var lobby = lobbyManager.get(lobbySettings.name);
      lobby.totalQuestionCount = lobbySettings.totalQuestionsAmount;
      lobby.maxTimerSeconds = lobbySettings.maxTimerSeconds;
      lobby.difficulty = lobbySettings.difficulty;
      lobby.categoryName = lobbySettings.category;
      lobby.fetchQuestions().then(() => {
        lobby.startQuiz();
      })
    });


    /****************************
     Submit Answer
    ****************************/
    socket.on('Client_SubmitAnswer', (answer) => {
      log("User: " + currentUser.name + " submitted answer: " + answer);
      var lobby = lobbyManager.get(currentUser.connectedLobbyName);
      lobby.submitAnswer(currentUser, answer);
    })

    /****************************
     Clients Disconnect
    ****************************/
    socket.on("disconnect", (arg) => {
      var user 
      log("User: " + currentUser.name + " disconnected - " + arg);
      
      // Remove from userManager to make username available again
      userManager.delete(currentUser.name);
      log("User: " + currentUser.name + " deleted from UserManager");
      
      handleLobbyLeave(currentUser.connectedLobbyName, currentUser);
    });
  });
});


/********************************************************
 Util & Helper Functions
 ********************************************************/

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
  lobby.leave(leavingUser);
  log("User: " + leavingUser.name + " left Lobby: " + lobbyName);

  // Lobby still active with leader - notify all clients in lobby
  if (lobby.leader) {
    lobby.broadcast("CurrentLobbyInformationChanged", lobby.toJSON());
    return;
  }

  // Lobby without leader - delete lobby and kick joined users
  log("Lobby: " + lobbyName + " has no leader. Closing lobby and kicking all users");
  lobby.broadcast("Client_LobbyLeaveRequest_Status", true); // Make all lobby-users leave lobby
  lobby.close();
  lobbyManager.delete(lobbyName);
}

function getOpenLobbies() {
  lobbies = [];
  lobbyManager.elements.forEach(lobby => {
    lobbies.push(lobby.toJSON());
  })
  return lobbies;
}

// TODO: only update lobby infoes for all users if change in lobbyManager occured
async function broadcastOpenLobbies() {
  setTimeout(() => {
    userManager.elements.forEach(user => {
      if (user.socket != null && user.connectedLobbyName == null) {
        user.socket.emit('CurrentOpenLobbies', getOpenLobbies());
      }
    });
    broadcastOpenLobbies();
  }, 1000);
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
