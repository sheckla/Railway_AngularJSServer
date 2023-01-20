class Category {
  constructor(name, id) {
    this.name = name;
    this.id = id;
  }
}
class CategoryManager {
  constructor() {
    this.categories = [];
    this.categories.push(new Category("Any", 0));
    this.categories.push(new Category("General Knowledge", 9));
    this.categories.push(new Category("Entertainment: Books", 10));
    this.categories.push(new Category("Entertainment: Film", 11));
    this.categories.push(new Category("Entertainment: Music", 12));
    this.categories.push(new Category("Entertainment: Musicals & Theatres", 13));
    this.categories.push(new Category("Entertainment: Television", 14));
    this.categories.push(new Category("Entertainment: Video Games", 15));
    this.categories.push(new Category("Entertainment: Board Games", 16));
    this.categories.push(new Category("Science & Nature", 17));
    this.categories.push(new Category("Science: Computers", 18));
    this.categories.push(new Category("Science: Mathematics", 19));
    this.categories.push(new Category("Mythology", 20));
    this.categories.push(new Category("Sports", 21));
    this.categories.push(new Category("Geography", 22));
    this.categories.push(new Category("History", 23));
    this.categories.push(new Category("Politics", 24));
    this.categories.push(new Category("Art", 25));
    this.categories.push(new Category("Celebrities", 26));
    this.categories.push(new Category("Animals", 27));
    this.categories.push(new Category("Vehicles", 28));
    this.categories.push(new Category("Entertainment: Comics", 29));
    this.categories.push(new Category("Science: Gadgets", 30));
    this.categories.push(new Category("Entertainment: Japanese Anime & Manga", 31));
    this.categories.push(new Category("Entertainment: Cartoons & Animations", 32));
  }

  // Gets ID for specific category-name
  getCategoryID(categoryName) {
    for (var i = 0; i < this.categories.length; i++) {
      if (this.categories[i].name == categoryName) return this.categories[i].id;
    }
  }

  // Gets category name for specific id
  getCategoryName(id) {
    for (var i = 0; i < this.categories.length; i++) {
      if (this.categories[i].id == id) return this.categories[i].name;
    }
  }

  get(categoryName) {
    for (var i = 0; i < this.categories.length; i++) {
      if (this.categories[i].name == categoryName) return this.categories[i];
    }
  }
}

module.exports = { CategoryManager, Category }
