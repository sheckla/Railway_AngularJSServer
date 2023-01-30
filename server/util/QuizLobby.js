const { CategoryManager, Category } = require("./CategoryManager");
const { User } = require("./User");

// Get Question Topic names and their respective API id's
let categoryManager = new CategoryManager();

// Data class 
class QuestionTopic {
  constructor(category, type, difficulty, question, correctAnswer, falseAnswers) {
    this.question = question;
    this.category = category;
    this.type = type;
    this.difficulty = difficulty;
    this.correctAnswer = correctAnswer;
    this.falseAnswers = falseAnswers;
  }
}

/****************************
 Quiz Lobby:
  - Manages leader & joined users
  - Handles quiz-game loop
  - Broadcasts socket-events to joined users
 ****************************/
class QuizLobby {
  
  // Joined User Management
  leader;
  joined = [];
  maxJoined;

  // Lobby Settings
  totalQuestionCount;
  categoryName; // via categoryManager
  difficulty; // any, easy, medium, hard
  maxTimerSeconds;

  // Question Topics
  currentQuestionTopics = new Array();
  currentQuestionIndex = 0;

  // Quiz-Game states
  terminated;
  started;
  fetched;

  constructor(lobbyName, userLeader) {
    this.name = lobbyName;
    this.leader = userLeader;
    this.leader.connectedLobbyName = this.name;
    this.terminated = false;
    this.fetched = false;
    this.started = false;
    this.initStandardLobbySettings();
  }

  initStandardLobbySettings() {
    this.maxJoined = 9; // Total Users = 10 (+1 for Leader)
    this.totalQuestionCount = 10;
    this.categoryName ="Any";
    this.difficulty = "any";
    this.maxTimerSeconds = 30;
  }

  close() {
    if (this.leader) this.leader.connectedLobbyName = null;
    this.joined.forEach(user => {
      if (user) user.connectedLobbyName = null;
    })
    this.terminated = true;
  }

  /****************************
  User Management
  ****************************/
  join(user) {
    // Lobby full
    if (this.joined.length >= this.maxJoined) return;

    // add new Lobby user
    this.joined.push(user);
    user.connectedLobbyName = this.name;
  }

  leave(user) {
    // If removed user is leader - remove leader
    if (user.name == this.leader.name) {
      this.leader.connectedLobbyName = null;
      this.leader = null;
      return;
    }

    // Else remove from joined users
    for (var i = 0; i < this.joined.length; i++) {
      if (this.joined[i].name == user.name) {
        this.joined[i].connectedLobbyName = null;
        this.joined.splice(i, i+1);
      }
    }
  }

  // Emit event to leader & joined users
  broadcast(event, arg) {
    this.broadcastToJoinedUsers(event, arg);
    if (this.leader && this.leader.socket) {
      this.leader.socket.emit(event, arg);
    }
  }
  
  // Emit event to joined users
  broadcastToJoinedUsers(event, arg) {
    for (var i = 0; i < this.joined.length; i++) {
      if (this.joined[i].socket) this.joined[i].socket.emit(event, arg);
    }
  }

  // returns true if all users have submitted their answer
  allAnswersSubmitted() {
    if (this.terminated) return;
    if (!this.leader.answerSubmitted) return false;
    for (var i = 0; i < this.joined.length; i++) {
      if (!this.joined[i].answerSubmitted) return false;
    }
    return true;
  }
  
  /****************************
  Quiz-Game Loop 
  ****************************/
  async startQuiz() {
    // prevent duplicate quiz-starts if already running
    if (this.started) return;

    this.resetGame();
    this.started = true;

    this.broadcast('CurrentLobbyInformationChanged', this.toJSON());
    
    // Loop till all questions handled
    while (!this.isGameFinished() && !this.terminated) {
      // Start round and get current question
      var topic = this.nextQuestionTopic();
      console.log(this.name + " | " + "Current round: " + (this.currentQuestionIndex) + " topic:" + topic.question);
      console.log("correct answer=" + topic.correctAnswer);
      var shuffledTopic = this.shuffledQuestionTopic(topic);
      this.broadcast('CurrentLobbyQuestion', shuffledTopic);

      // Sleep for current Lobby-Timer, break sleep if all answers submitted
      await new Promise(resolve => {
        var interval = setInterval(() => {
          if (this.allAnswersSubmitted()) {
            clearInterval(interval);
            resolve();
          }
      }, 900);

      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, this.maxTimerSeconds * 1000);

      })

      // Round over
      this.finishQuestionRound();
    }

    this.started = false;
    console.log("Lobby game finished");
    this.resetGame();
    this.broadcast('LobbyGameFinished', true);
  }

  resetGame() {
    // Init scores
    this.currentQuestionIndex = 0;
    if (this.leader) {
      this.leader.currentScore = 0;
      this.leader.currentStreak = 0;
      this.leader.currentCorrectAnswers = 0;
      this.leader.currentWrongAnswers = 0;
    }
    this.joined.forEach(user => {
      user.currentScore = 0;
      user.currentStreak = 0;
      user.currentCorrectAnswers = 0;
      user.currentWrongAnswers = 0;
    });
    this.resetSubmittedAnswers();
  }

  submitAnswer(user, answer) {
    console.log(answer + "=" + this.currentQuestionTopics[this.currentQuestionIndex].correctAnswer);
    user.answerSubmitted = true;
    var userInfo = {
      leader: this.leader,
      users: this.joined,
    }
    this.broadcast('CurrentLobbyUserInfoUpdate', userInfo); // send user info before scores are added
    if (answer == this.currentQuestionTopics[this.currentQuestionIndex].correctAnswer) {
      user.currentScore+=1000;
      user.currentStreak++;
      user.currentCorrectAnswers++;
    } else {
      user.currentStreak = 0;
      user.currentWrongAnswers++;
    }
  }

  resetSubmittedAnswers() {
    if (this.terminated) return;
    this.leader.answerSubmitted = false;
    this.joined.forEach(user => {
      user.answerSubmitted = false;
    })
  }

  // Question round finished - add respective scores
  finishQuestionRound() {
    var finishTime = performance.now();
    console.log("finishing round");
    this.resetSubmittedAnswers();
    this.currentQuestionIndex++;
    this.broadcast('CurrentLobbyInformationChanged', this.toJSON());
  }

  // Returns next question from polled questions
  nextQuestionTopic() {
    if (this.currentQuestionTopics.length == 0) throw new Error("Questions not polled from API!");
    if (this.currentQuestionIndex >= this.totalQuestionCount) throw new Error("QuizLobby questions out of bounds!");
    return this.currentQuestionTopics[this.currentQuestionIndex];
  }

  // Returns question topic with shuffled answers 
  shuffledQuestionTopic(topic) {
    var answers = this.shuffleArray([topic.correctAnswer, ...topic.falseAnswers]);
    var shuffledTopic = structuredClone(topic);
    // Delete sorted topic answer properties
    delete shuffledTopic['correctAnswer'];
    delete shuffledTopic['falseAnswers'];
    // asssign new property
    shuffledTopic.shuffledAnswers = answers;
    return shuffledTopic;
  }
  
  /****************************
   Getters
  ****************************/
  isLobbyFull() {
    return (this.joined.length >= this.maxJoined);
  }
 
  isGameFinished() {
   return !(this.currentQuestionIndex < this.totalQuestionCount); 
  }
  
  // usernames from leader & joined users
  getAllUsernames() {
    var usernameArray = new Array();
    
    // Add Leader name
    if (this.leader) usernameArray.push(this.leader.name);
    
    // Add joined usernames
    usernameArray.push(this.getJoinedUsernames());
    return usernameArray;
  }

  // usernames from joined users
  getJoinedUsernames() {
    var usernameArray = new Array();
    this.joined.forEach(user => {
      if (user !== undefined) usernameArray.push(user.name);
    })
    return usernameArray;
  }

  toJSON() {
    var top = new QuestionTopic();
    var jsonTopic = this.currentQuestionTopics[this.currentQuestionIndex];
    if (this.currentQuestionTopics[this.currentQuestionIndex] === undefined) jsonTopic = top;
    return {
      name: this.name,
      totalQuestionCount: this.totalQuestionCount,
      categoryName: this.categoryName,
      difficulty: this.difficulty,
      leader: this.leader,
      users: this.joined,
      maxTimerSeconds: this.maxTimerSeconds,
      started: this.started,
      currentQuestionIndex: this.currentQuestionIndex,
      currentQuestionTopic: jsonTopic,
    }
  }

  /****************************
   Util & Helper Functions
  ****************************/
  // (async) fetch questions and wait for response from TriviaDB
  async fetchQuestions() {
    console.log("fetch start");
    //await new Promise(resolve => setTimeout(resolve, 2000)); // test delay for polling
    var url = this.generateFetchLink();
    
    // Fetch from API and add to current Question topics
    const response = await fetch(url);
    const data = await response.json();
    
    this.currentQuestionTopics = Array();
    // Add to questionTopics after questions have been received from API
    for (var i = 0; i < data.results.length; i++) {
      var topic = data.results[i];
      var questionTopic = new QuestionTopic(topic.category, topic.type, topic.difficulty,
        topic.question, topic.correct_answer, topic.incorrect_answers)

      this.currentQuestionTopics.push(questionTopic);
    }
    console.log("fetch finish");
  }
  
  // Generate fetch link for API-Call to TriviaDB
  generateFetchLink() {
    var url = "https://opentdb.com/api.php?amount=" + this.totalQuestionCount;

    if (this.categoryName != "Any") {
      url += "&category=" + categoryManager.getCategoryID(this.categoryName);
    }

    // difficulty must be lower case
    var lowercaseDifficulty = this.difficulty.charAt(0).toLowerCase() + this.difficulty.slice(1);
    if (lowercaseDifficulty != "any") {
      url += "&difficulty=" + lowercaseDifficulty;
    }
    console.log(url);
    return url;
  }

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1)); // random index
      [arr[i], arr[j]] = [arr[j], arr[i]]; // swap array elements
    }
    return arr;
  }
}


module.exports = { QuizLobby }