class UniqueMap {
  constructor() {
    this.elements = new Map();
  }

  get(id) {
    return this.elements.get(id);
  }

  contains(id) {
    return this.elements.has(id);
  }

  set(id, elem) {
    this.elements.set(id, elem);
  }

  delete(id) {
    this.elements.delete(id);
  }

  size() {
    return this.elements.size;
  }
  /* 
    getMatchingArr(ids) {
      var matching = new Array();
      for (var i = 0; i < ids.length; i++) {
        if (this.contains(ids[i])) matching.push(this.get(ids[i]));
      }
      return matching;
    } */
}
module.exports = { UniqueMap }