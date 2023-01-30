class User {
  constructor() {
    this.name = null;
    this.socket = null;
    this.connectedLobbyName = null;
    this.currentWrongAnswers = 0;
    this.currentCorrectAnswers = 0;
    this.currentScore = 0;
    this.currentStreak = 0;
    this.answerSubmitted = false;
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
}
module.exports = { User }
