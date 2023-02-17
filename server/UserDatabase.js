const fs = require('fs');
const { User } = require("./User");
// Define the JSON file path and encoding
const filePath = './users.json';
const encoding = 'utf8';

class UserDatabase {

    constructor() {
        // init file if none
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, '[]', encoding);
        }

        // init arr if file empty
        var fileString = fs.readFileSync(filePath, encoding);
        if (fileString.length == 0) {
            fs.writeFileSync(filePath, '[]', encoding);
        }
    }

    get(user) {
        const usersString = fs.readFileSync(filePath, encoding);
        const users = JSON.parse(usersString);
        var userIndex = users.findIndex(userDB => userDB.name == user.name);
        if (userIndex !== -1) {
            return users[userIndex];
        }
        return null;
    }

    validifyPasswordForName(username, password) {
        var user = new User();
        user.name = username;
        var userFromDB = this.get(user);
        if (!userFromDB) return false; // no user
        if (userFromDB.password == password) return true; // pw match
        return false;
    }

    getHighscores(range) {
        const usersString = fs.readFileSync(filePath, encoding);
        const users = JSON.parse(usersString);
        const sortedUsers = users.sort((a, b) => b.totalScore - a.totalScore);
        // only return needed json-attributes
        const highscores = sortedUsers.slice(0, range).map(user => {
            return {
                name: user.name,
                totalScore: user.totalScore
            };
        });
        return highscores;
    }

    // updates user or appends if user doesn't exist
    update(user) {
        const fileString = fs.readFileSync(filePath, encoding);
        const users_JSON = JSON.parse(fileString);

        var userIndex = users_JSON.findIndex(userDB => userDB.name == user.name);
        if (userIndex === -1) {
            // append new user
            this.appendUser(user, users_JSON);
            return;
        }

        if (userIndex !== -1) {
            // update found user
            this.updateUser(user, users_JSON, userIndex);
            return;
        }
    }

    appendUser(newUser, users_JSON) {
        users_JSON.push(newUser.toDatabaseJSON());
        const updatedUsersString = JSON.stringify(users_JSON, null, 2);
        fs.writeFileSync(filePath, updatedUsersString, encoding);
    }

    updateUser(updatedUser, users_JSON, index) {
        users_JSON[index] = updatedUser.toDatabaseJSON();
        const updatedFileString = JSON.stringify(users_JSON, null, 2);
        fs.writeFileSync(filePath, updatedFileString, encoding);
    }
}

module.exports = { UserDatabase }