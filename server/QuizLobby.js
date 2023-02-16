const fetch = require('node-fetch-commonjs')
const { CategoryManager, Category } = require("./CategoryManager");
const { User } = require("./User");
const { log } = require("./Log");
const { UserDatabase } = require("./UserDatabase")

// Get Question Topic names and their respective API id's
let categoryManager = new CategoryManager();

// Data class 
class QuestionTopic {
    constructor(category, type, difficulty, question, correctAnswer, falseAnswers, index) {
        this.question = question;
        this.category = category;
        this.type = type;
        this.difficulty = difficulty;
        this.correctAnswer = correctAnswer;
        this.falseAnswers = falseAnswers;
        this.index = index;
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
    userDB;

    // Lobby Settings
    totalQuestionCount;
    categoryName; // via categoryManager
    difficulty; // any, easy, medium, hard
    maxTimerSeconds;

    // Question Topics
    currentQuestionTopics = new Array();
    currentQuestionIndex = 0;
    shuffledTopic;
    startTimeMeasure;

    // Quiz-Game states
    terminated;
    started;
    fetched;

    constructor(lobbyName, userLeader, userDB) {
        this.name = lobbyName;
        this.leader = userLeader;
        this.userDB = userDB;
        this.leader.connectedLobbyName = this.name;
        this.terminated = false;
        this.fetched = false;
        this.started = false;
        this.initStandardLobbySettings();
    }

    initStandardLobbySettings() {
        this.maxJoined = 9; // Total Users = 10 (+1 for Leader)
        this.totalQuestionCount = 10;
        this.categoryName = "Any";
        this.difficulty = "any";
        this.maxTimerSeconds = 1; // 15
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
                this.joined.splice(i, i + 1);
            }
        }
    }

    // Emit event to leader & joined users
    broadcast(event, arg) {
        log("emit", "\"" + this.name + "\", " + event);
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

        log("lobby", "\"" + this.name + "\", game started");
        this.broadcast('CurrentLobbyInformationChanged', this.toJSON());

        // Loop till all questions handled
        while (!this.isGameFinished() && !this.terminated) {
            // Start round and get current question
            var topic = this.nextQuestionTopic();
            log("lobby", "\"" + this.name + "\", " + "Question: [" + (this.currentQuestionIndex + +1) + "/" + this.totalQuestionCount + "], " +
                "topic:" + topic.question + ", correctAnswer:" + topic.correctAnswer);
            this.startTimeMeasure = performance.now();
            this.shuffledTopic = this.shuffledQuestionTopic(topic);
            this.broadcast('CurrentLobbyQuestion', this.shuffledTopic);

            // Sleep for current Lobby-Timer, break sleep if all answers submitted
            await new Promise(resolve => {
                var interval = setInterval(() => {
                    if (this.allAnswersSubmitted()) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 250);

                setTimeout(() => {
                    clearInterval(interval);
                    resolve();
                }, this.maxTimerSeconds * 1000);

            })

            // Round over
            this.finishQuestionRound();
        }

        this.started = false;
        log("lobby", "\"" + this.name + "\", game finished");

        log("lobby \"" + this.name + "\" updating user scores in DB");
        var users = [this.leader, ...this.joined];
        users.forEach(user => {
            if (user) {
                user.totalScore += user.currentScore;
                user.totalPlayedGames += 1;
                this.userDB.update(user);
            }
        })
        log("lobby \"" + this.name + "\" all scores updated in DB");


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
        var BASE_SCORE = 1000;
        user.answerSubmitted = true;
        var userInfo = {
            leader: this.leader,
            users: this.joined,
        }
        this.broadcast('CurrentLobbyUserInfoUpdate', userInfo); // send user info before scores are added

        // Calculate Score
        var answerTime = (performance.now() - this.startTimeMeasure) / 1000;
        var scoreFactor = (1 - this.remapBounds(answerTime, 0, this.maxTimerSeconds, 0, 1));

        if (answer == this.currentQuestionTopics[this.currentQuestionIndex].correctAnswer) {
            // correct - add score
            var addedScore = BASE_SCORE * scoreFactor;
            var streakScore = 0;
            if (user.currentStreak >= 1) streakScore = addedScore * 0.5;
            addedScore = Math.round(addedScore / 10) * 10;
            streakScore = Math.round(streakScore / 10) * 10;
            user.currentScore += addedScore + streakScore;
            user.currentStreak++;
            user.currentCorrectAnswers++;
            log("lobby", "\"" + this.name + "\", received Answer from:" + user.name + " is correct, addedScore = " + addedScore + ", streakScore=" +
                streakScore);
        } else {
            // false - reset streak
            user.currentStreak = 0;
            user.currentWrongAnswers++;
            log("lobby", "\"" + this.name + "\", received Answer from:" + user.name + " is false, no score added");
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
        log("lobby", "\"" + this.name + "\", round finished");
        this.resetSubmittedAnswers();
        this.currentQuestionIndex++;
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
        var shuffledTopic;
        if (global.structuredClone) {
            shuffledTopic = structuredClone(topic)
        } else {
            shuffledTopic = JSON.parse(JSON.stringify(topic))
        }
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

    usersSortedByScore() {
        var users = [this.leader, ...this.joined];
        users.sort((a, b) => b.currentScore - a.currentScore);
        return users;
    }

    userInfo() {
        var users = [this.leader, ...this.joined];
        return {
            leader: this.leader,
            users: this.joined,
        }
    }

    count() {
        return (this.joined.length + 1); // + leader which must be there or lobby is terminated;
    }

    currentTimer() {
        if (!this.started) return -1;
        var timer = (performance.now() - this.startTimeMeasure) / 1000;
        timer = Math.round(timer);
        timer = this.maxTimerSeconds - timer;
        return timer;
    }

    toJSON() {
        var top = new QuestionTopic();
        var jsonTopic = this.currentQuestionTopics[this.currentQuestionIndex];
        if (this.currentQuestionTopics[this.currentQuestionIndex] === undefined) jsonTopic = top;
        if (this.shuffledTopic) jsonTopic = this.shuffledTopic;
        return {
            name: this.name,
            totalQuestionCount: this.totalQuestionCount,
            categoryName: this.categoryName,
            difficulty: this.difficulty,
            maxTimerSeconds: this.maxTimerSeconds,
            started: this.started,
        }
    }

    /****************************
     Util & Helper Functions
    ****************************/

    // float i~[fromMin,fromMax] -> i~[toMin, toMax]
    remapBounds(i, fromMin, fromMax, toMin, toMax) {
        return (i - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
    }


    // (async) fetch questions and wait for response from TriviaDB
    async fetchQuestions() {
        //await new Promise(resolve => setTimeout(resolve, 2000)); // test delay for polling
        var url = this.generateFetchLink();
        log("lobby", "\"" + this.name + "\", fetching questions, " + url);

        // Fetch from API and add to current Question topics
        const response = await fetch(url);
        const data = await response.json();

        this.currentQuestionTopics = Array();
        // Add to questionTopics after questions have been received from API
        for (var i = 0; i < data.results.length; i++) {
            var topic = data.results[i];
            var questionTopic = new QuestionTopic(topic.category, topic.type, topic.difficulty,
                topic.question, topic.correct_answer, topic.incorrect_answers, i)
            this.currentQuestionTopics.push(questionTopic);
        }
        log("lobby", "\"" + this.name + "\", fetching questions DONE");
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