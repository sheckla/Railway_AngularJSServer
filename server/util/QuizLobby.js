const { CategoryManager, Category } = require("./CategoryManager");
let categoryManager = new CategoryManager();

class QuestionTopic {
  constructor(category, type, difficulty, question, correctAnswer, falseAnswers) {
    this.category = category;
    this.type = type;
    this.difficulty = difficulty;
    this.question = question;
    this.correctAnswer = correctAnswer;
    this.falseAnswers = falseAnswers;
  }
}

class QuizLobby {
  constructor(lobbyName, leader) {
    this.name = lobbyName;
    this.leader = leader;
    this.joinedUsers = [];
    this.totalQuestionCount = 10;
    this.categoryName = "Any"; // via categoryManager
    this.difficulty = "any"; // any, easy, medium, hard
    this.maxJoinedUserSize = 2;
    this.currentQuestionTopics = new Array();
    this.currentQuestionIndex = 0;
    this.started = false;
  }

  add(user) {
    // Lobby full
    if (this.joinedUsers.length >= this.maxJoinedUserSize) return;

    // add new Lobby user
    this.joinedUsers.push(user);
  }

  remove(user) {
    // If removed user is leader - remove leader
    if (user.name == this.leader.name) {
      this.leader = null;
    }

    // Else remove from joined users
    for (var i = 0; i < this.joinedUsers.length; i++) {
      if (this.joinedUsers[i].name == user.name) this.joinedUsers.splice(i, i+1);
    }
  }

  full() {
    return (this.joinedUsers.length >= this.maxJoinedUserSize);
  }

  // Returns next question from polled questions
  nextQuestion() {
    if (this.currentQuestionIndex >= this.currentQuestionTopics.length) return;
    return this.currentQuestionTopics[this.currentQuestionIndex++];
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
    for (var i = 0; i < this.joinedUsers.length; i++) {
      if (this.joinedUsers[i].socket) this.joinedUsers[i].socket.emit(event, arg);
    }
  }

  // Get pure usernames from leader & joined users
  getAllUsernames() {
    var usernameArray = new Array();

    // Add Leader name
    if (this.leader) usernameArray.push(this.leader.name);

    // Add joined usernames
    usernameArray.push(this.getJoinedUsernames());
    return usernameArray;
  }

  // get pure usernames from joined users
  getJoinedUsernames() {
    var usernameArray = new Array();
    this.joinedUsers.forEach(user => {
      if (user !== undefined) usernameArray.push(user.name);
    })
    return usernameArray;
  }

  lobbyInfo() {
    return {
      name: this.name,
      totalQuestionCount: this.totalQuestionCount,
      categoryName: this.categoryName,
      difficulty: this.difficulty,
      leader: this.leader.name,
      users: this.getJoinedUsernames()
    }
  }

  // Generate fetch link for API-Call to TriviaDB
  generateFetchLink() {
    var url = "https://opentdb.com/api.php?amount=" + this.totalQuestionCount;

    if (this.categoryName != "Any") {
      url += "&category=" + categoryManager.getCategoryID(this.categoryName);
    }

    if (this.difficulty != "any") {
      url += "&difficulty=" + this.difficulty;
    }
    return url;
  }

  // (async) fetch questions and wait for response from TriviaDB
  // Questions formatted and saved into currentQuestionTopics
  async fetchQuestions() {
    this.currentQuestionTopics = Array();
    var url = this.generateFetchLink();

    // Fetch from API and add to current Question topics
    const response = await fetch(url);
    const data = await response.json();

    for (var i = 0; i < data.results.length; i++) {
      var topic = data.results[i];
      var questionTopic = new QuestionTopic(topic.category, topic.type, topic.difficulty,
        topic.question, topic.correct_answer, topic.incorrect_answers)

      this.currentQuestionTopics.push(questionTopic);
    }
  }
}


module.exports = { QuizLobby }