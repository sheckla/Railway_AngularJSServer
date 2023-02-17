class User {
  constructor() {
    // Base infos
    this.name = null;
    this.socket = null;

    // DB infos
    this.password = null;
    this.totalScore = 0;
    this.totalPlayedGames = 0;

    // Ingame infos
    this.connectedLobbyName = null;
    this.currentWrongAnswers = 0;
    this.currentCorrectAnswers = 0;
    this.currentScore = 0;
    this.currentStreak = 0;
    this.answerSubmitted = false;
    this.questionResult = null;
  }

  toString() {
    var str = "<br>--------------";
    str += "<br>Name=" + this.name;
    return str;
  }

  toJSON() {
    return {
      name: this.name,
      currentScore: this.currentScore,
      currentStreak: this.currentStreak,
      answerSubmitted: this.answerSubmitted,
      currentWrongAnswers: this.currentWrongAnswers,
      currentCorrectAnswers: this.currentCorrectAnswers,
    }
  }

  toDatabaseJSON() {
    return {
      name: this.name,
      password: this.password,
      totalScore: this.totalScore,
      totalPlayedGames: this.totalPlayedGames,
    }
  }
}


module.exports = { User }