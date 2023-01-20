class User {
  constructor() {
    this.name = null;
    this.socket = null;
    this.connectedLobbyName = null;
  }

  toString() {
    var str = "<br>--------------";
    str += "<br>Name=" + this.name;
    return str;
  }

  toJSON() {
    return {
      name: this.name,
    }
  }
}
module.exports = { User }
