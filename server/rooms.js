var repository = require('./repository');
var Hashids = require("hashids"),
    hashids = new Hashids("afh2lkhgv8i043l5gds53gk75t6");
var users = require('./users');

function createId(users)
{
    var userIds = [];
    for (var i in users) {
        userIds.push(parseInt(users[i].id));
    }
    userIds.sort(function(a,b) { return a - b; });
    return hashids.encode(userIds);
}

function Room(users, callback)
{
    this.id = createId(users);
    this.users = users;

    var that = this;
    this.updateMessages(function() {
        callback(that);
    });
}
Room.prototype.getMessages = function() {
    return this.messages;
};
Room.prototype.addMessage = function(owner, text, callback) {
    var message = {
        user: owner.id,
        text: text,
        created: new Date()
    };
    var that = this;
    repository.setMessage(this.id, message, function() {
        that.updateMessages(function() {
            message.user = users.getUser(message.user);
            callback(message);
        });

    });
};
Room.prototype.updateMessages = function(callback)
{
    this.messages = [];
    var that = this;
    repository.getMessages(this.id, function(messages) {
        for (var i in messages) {
            that.messages.push({
                user: users.getUser(messages[i].user),
                text: messages[i].text,
                created: messages[i].created
            });
        }
        if(callback) {
            callback();
        }
    });
};

Room.prototype.getMessageHistory = function(page, callback)
{
    repository.getMessages(this.id, function(messages) {
        var formattedMessages = [];
        for (var i in messages) {
            formattedMessages.push({
                user: users.getUser(messages[i].user),
                text: messages[i].text,
                created: messages[i].created
            });
        }
        callback(formattedMessages);
    }, page);
};

exports.Room = Room;