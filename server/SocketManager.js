class SocketManager {
    constructor() {
      this.sockets = new Map();
    }

    get(name) {
      return this.sockets.get(name);
    }

    contains(name) {
      return this.sockets.has(name);
    }

    set(name, socket) {
      this.sockets.set(name, socket);
    }

    delete(name) {
      this.sockets.delete(name);
    }

    size() {
      return this.sockets.size;
    }

    arr() {
      return Array.from(this.sockets.values());
    }
}


class SockID {
    constructor(id, name) {
      this.id = id;
      this.name = name;
    }

    toString() {
      var str= "<br>--------------";
      str += "<br>Socket Nr: " + this.socketNumber;
      str += "<br>id=" + this.id;
      str += "<br>Name=" + this.name;
      return str;
    }
  
    toJSON() {
      return {
        id: this.id,
        name: this.name,
      }
    }
  }
  module.exports = {SockID, SocketManager}
  