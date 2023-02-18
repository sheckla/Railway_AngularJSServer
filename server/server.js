/****************************
 Importing & Setup
 ****************************/
// General libs
const express = require("express");

// Game Server specific libs
const { UniqueMap } = require("./UniqueMap");
const { log } = require("./Log");
const { User } = require("./User");
const { QuizLobby } = require("./QuizLobby");
const { UserDatabase } = require("./UserDatabase");

// constant variables
const port = process.env.PORT || 3000;


// runtime variables
let UserDB = new UserDatabase(); // user DB, first pulled from 'users.json'
let Users = new UniqueMap(); // currently logged on users
let Lobbies = new UniqueMap(); // currently active lobbies


// *************************
// Lobby Testing
// *************************
async function testLobbyAndUsers() {
    user1 = new User();
    user1.name = "Client1";
    user1.password = "pass1";
    user1.totalScore = 1000;
    user1.totalPlayedGames = 15;

    user2 = new User();
    user2.name = "Client2";
    user2.password = "pass2";
    user2.totalScore = 2000;
    user2.totalPlayedGames = 10;
    UserDB.update(user1);
    UserDB.update(user2);

    // Await the update operations before calling validifyPasswordForName
    var loginSuccessful = false;
    UserDB.update(user1);
    UserDB.update(user2);

    var lobby1 = new QuizLobby("1", user1, UserDB);
    var lobby2 = new QuizLobby("2", user1, UserDB);
    var lobby3 = new QuizLobby("3", user1, UserDB);
    var lobby4 = new QuizLobby("4", user1, UserDB);
    var lobby5 = new QuizLobby("5", user1, UserDB);
    var lobby6 = new QuizLobby("6", user1, UserDB);
    Lobbies.set("1", lobby1);
    Lobbies.set("2", lobby2);
    Lobbies.set("3", lobby3);
    Lobbies.set("4", lobby4);
    Lobbies.set("5", lobby5);
    Lobbies.set("6", lobby6);
/*     lobby1.join(user2);
    lobby1.fetchQuestions().then(() => {
        lobby1.startQuiz();
    }) */
}
testLobbyAndUsers();

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
http.listen(port, () => {
    log("Listening to port:" + port);

    // Socket Connected
    socket.on("connection", (socket) => {
        log("receive", socket.id + " socket connected");

        // Init current client/User
        var currentUser = new User();
        currentUser.socket = socket;

        /****************************
         Client Login
        ****************************/
        socket.on('Client_LoginRequest', (userPass) => {
            var status_loginRequest = {
                success: false,
            }

            log("receive", userPass.name + " wants to log in with password:" + userPass.password);
            var loginSuccessful = false;
            var loggedUser = new User();
            loggedUser.name = userPass.name;

            if (Users.get(userPass.name)) {
                // User already logged in - abort
                loginSuccessful = false;
            } else {
                // User not logged in - check for password
                loginSuccessful = UserDB.validifyPasswordForName(userPass.name, userPass.password);
            }

            // **** Login request failed ****
            if (!loginSuccessful) {
                socketEmit(socket, 'Client_LoginRequest_Status', status_loginRequest); // status mit failed
                return;
            }

            // **** Login request Success ****
            currentUser.name = userPass.name;
            currentUser.password = userPass.password;
            storedUserValues = UserDB.get(currentUser);
            currentUser.totalScore = storedUserValues.totalScore;
            currentUser.totalPlayedGames = storedUserValues.totalPlayedGames;
            Users.set(currentUser.name, currentUser);

            status_loginRequest.success = true;
            status_loginRequest.totalPlayedGames = currentUser.totalPlayedGames;
            status_loginRequest.totalScore = currentUser.totalScore;
            socketEmit(socket, 'Client_LoginRequest_Status', status_loginRequest);

            // *** Also pass current Lobby Info & Highscores because User is logged in ***
            socketEmit(socket, 'CurrentOpenLobbies', getOpenLobbies());
            socketEmit(socket, 'CurrentLeaderboard', UserDB.getHighscores(11));
            log("User: " + userPass.name + " now logged in with their stored values from DB.");
        });

        /****************************
         Client Register
         ****************************/
        socket.on('Client_RegisterRequest', (userPass) => {
            log("receive", userPass.name + " wants to register with password:" + userPass.password);
            var newUser = new User();
            newUser.name = userPass.name;
            newUser.password = userPass.password;
            var userFree = false;
            if (UserDB.get(newUser) == null) userFree = true;

            socketEmit(socket, 'Client_RegisterRequest_Status', userFree);

            // Abort - user already exists
            if (!userFree) return;

            // Init User
            socketEmit(socket, 'CurrentOpenLobbies', getOpenLobbies());
            socketEmit(socket, 'CurrentLeaderboard', UserDB.getHighscores(10));
            currentUser.name = userPass.name;
            currentUser.password = userPass.password;
            log("User: " + currentUser.name + " now registered");

            // Save to DB
            UserDB.update(currentUser);
            Users.set(currentUser.name, currentUser);
        });

        /****************************
         Creating Lobby
        ****************************/
        socket.on("Client_LobbyCreationRequest", (lobbyName) => {
            log("User: " + currentUser.name + " wants to create Lobby: " + lobbyName);
            var lobbyNameAvailable = !Lobbies.contains(lobbyName);
            socketEmit(socket, 'Client_LobbyCreationRequest_Status', lobbyNameAvailable)
            // Lobby not available - abort
            if (!lobbyNameAvailable) {
                log("Lobby: " + lobbyName + " already exists.");
                return;
            }

            // Lobby available - create
            var quizLobby = new QuizLobby(lobbyName, currentUser, UserDB);
            Lobbies.set(lobbyName, quizLobby); // set name and leader
            socketEmit(socket, 'CurrentLobbyUserInfoUpdate', quizLobby.userInfo()); // notify calling client infos
            socketEmit(socket, 'CurrentLobbyInformationChanged', quizLobby.toJSON()); // notify calling client with default settings
            broadcastOpenLobbies();
            log("Lobby: " + lobbyName + " has been created");
        });

        /****************************
         Joining Lobby
        ****************************/
        socket.on("Client_LobbyJoinRequest", (lobbyName) => {
            log("User: " + currentUser.name + " wants to join Lobby: " + lobbyName);
            var lobbyExists = Lobbies.contains(lobbyName);
            var lobbyNotFull = false;
            if (lobbyExists) {
                lobbyNotFull = !Lobbies.get(lobbyName).isLobbyFull();
            }

            // TODO Check for full lobbies

            // Notify calling client
            socket.emit("Client_LobbyJoinRequest_Status", lobbyExists && lobbyNotFull);

            // Lobby doesn't exist to join - abort
            if (!lobbyExists) {
                log("Lobby: " + lobbyName + " doesn't exists");
                return;
            }

            // Lobby exists - client can join
            var lobby = Lobbies.get(lobbyName);
            lobby.join(currentUser); // add current Client to lobby
            lobby.broadcast("CurrentLobbyUserInfoUpdate", lobby.userInfo()); // Notify all other users in lobby
            socketEmit(socket, 'CurrentLobbyInformationChanged', lobby.toJSON());
            if (lobby.started) {
                var shuffledQuestion = lobby.shuffledTopic;
                shuffledQuestion["timerForLateJoinedUser"] = lobby.currentTimer();
                console.log(lobby.currentTimer());
                socketEmit(socket, 'CurrentLobbyQuestion', shuffledQuestion);
            }
            broadcastOpenLobbies();
            log("User: " + currentUser.name + " joined Lobby: " + lobbyName);
        })

        /****************************
         Leaving Lobby 
        ****************************/
        socket.on("Client_LobbyLeaveRequest", (lobbyName) => {
            log("User: " + currentUser.name + " wants to leave Lobby: " + lobbyName);
            var lobbyExists = Lobbies.contains(lobbyName);

            // Notify calling Client
            var status ={
                success: lobbyExists,
            }
            socket.emit("Client_LobbyLeaveRequest_Status", status);

            handleLobbyLeave(lobbyName, currentUser);
        });

        /****************************
         Starting Lobby 
        ****************************/
        socket.on("Client_LobbyStartRequest", async (lobbySettings) => {
            var lobby = Lobbies.get(lobbySettings.name);
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
            log("receive", "User: " + currentUser.name + " submitted answer: " + answer);
            var lobby = Lobbies.get(currentUser.connectedLobbyName);
            lobby.submitAnswer(currentUser, answer);
        })

        /****************************
         Clients Disconnect
        ****************************/
        socket.on("disconnect", (arg) => {
            if (!currentUser.name) {
                log("socket disconnect but user.name == null. Not Logged in correctly");
                return;
            }
            log("User: " + currentUser.name + " disconnected - " + arg);

            // Remove from userManager to make username available again
            Users.delete(currentUser.name);
            log("User: " + currentUser.name + " deleted from UserManager");

            handleLobbyLeave(currentUser.connectedLobbyName, currentUser);
        });
    });
});


/********************************************************
 Util & Helper Functions
 ********************************************************/

function socketEmit(socket, event, arg) {
    log("emit", "[" + event + ", " + arg + "]");
    socket.emit(event, arg);
}

// Handles lobby leaving events and notifies the joined clients
function handleLobbyLeave(lobbyName, leavingUser) {
    lobbyExists = Lobbies.contains(lobbyName);

    // Lobby doesn't exist - abort 
    if (!lobbyExists) {
        log("Lobby: " + lobbyName + " doesn't exist");
        return;
    }

    {
        // Lobby exists - remove client from lobby
        lobby = Lobbies.get(lobbyName);
        lobby.leave(leavingUser);
        log("User: " + leavingUser.name + " left Lobby: " + lobbyName);

        // Lobby still active with leader - notify all clients in lobby
        if (lobby.leader) {
            lobby.broadcast("CurrentLobbyUserInfoUpdate", lobby.userInfo());
            broadcastOpenLobbies();
            return;
        }

        // Lobby without leader - delete lobby and kick joined users
        log("Lobby: " + lobbyName + " has no leader. Closing lobby and kicking all users");
        var status = {
            success: true,
            kick: true,
        }
        lobby.broadcast("Client_LobbyLeaveRequest_Status", status); // Make all lobby-users leave lobby
        lobby.close();
        Lobbies.delete(lobbyName);
    }
    broadcastOpenLobbies();
}

function getOpenLobbies() {
    lobbies = [];
    Lobbies.elements.forEach(lobby => {
        var shortInfo = {
            name: lobby.name,
            users: lobby.count(),
        }
        lobbies.push(shortInfo);
    })
    return lobbies;
}

function broadcastOpenLobbies() {
    log('emit', "broadcasting lobbies");
    Users.elements.forEach(user => {
        // Only emit to users currently not in a lobby
        if (user.socket != null && user.connectedLobbyName == null) {
            socketEmit(user.socket, 'CurrentOpenLobbies', getOpenLobbies());
        }
    });
}
function broadcastCurrentLeaderboard(range) {
    log('emit', "broadcasting leaderboard");
    Users.elements.forEach(user => {
        // Only emit to users currently not in a lobby
        if (user.socket != null && user.connectedLobbyName == null) {
            socketEmit(user.socket, 'CurrentLeaderboard', UserDB.getHighscores(range));
        }
    });
}