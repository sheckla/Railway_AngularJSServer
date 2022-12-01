class SocketManager {
  constructor() {
    this.sockets = [];
  }

  get(name) {
    for (var i = 0; i < this.sockets.length; i++) {
      if (this.sockets[i].name === name) {
        return this.sockets[i];
    }
  }
  }

  add(SockID) {
    this.sockets.push(SockID);
  }

  remove(id) {

  }

  size() {
    return this.sockets.length;
  }

  arr() {
    return this.sockets;
  }
}


class SockID {
    constructor(socketNumber, 
      id = "",
      name = "",
      msg = "", 
      connectionDate = "", 
      disconnectionDate = "", 
      extras = "", 
      timeZone = "") 
      {

      this.socketNumber = socketNumber;
      this.id = id;
      this.name = name;
      this.msg = msg;
      this.connectionDate = connectionDate;
      this.disconnectionDate = disconnectionDate;
      this.extras = extras;
      this.timeZone = timeZone;
    }

    toString() {
      var str= "<br>--------------";
      str += "<br>Socket Nr: " + this.socketNumber;
      str += "<br>id=" + this.id;
      str += "<br>Name=" + this.name;
      str += "<br>Msg=" + this.msg;
      str += "<br>ConnectionDate=" + this.connectionDate;
      str += "<br>DisconnectionDate=" + this.disconnectionDate;
      str += "<br>Timezone=" + this.timeZone;
      str += "<br>Extras=" + this.extras;
      return str;
    }
  
    toJSON() {
      return {
        id: this.id,
        name: this.name,
        msg: this.msg,
        connectionDate: this.connectionDate,
        disconnectionDate: this.disconnectionDate,
        extras: this.extras
      }
    }
  }
  module.exports = {SockID, SocketManager}
  