var redis = require('redis');
var client = redis.createClient();

var pageSize = 20;

function getMessages(roomId, callback, page)
{
    if(typeof page == 'undefined') {
        page = 1;
    }
    var start = page * pageSize * (-1);
    var stop = start + pageSize - 1;

    client.lrange('room:' + roomId, start, stop, function(err, messages) {
        if(err != null) {
            throw err;
        }

        if(messages === null) {
            callback({});
        } else {
            for (var i in messages) {
                messages[i] = JSON.parse(messages[i]);
            }
            callback(messages);
        }
    });
}

function setMessage(roomId, message, callback)
{
    return client.rpush('room:' + roomId, JSON.stringify(message), function(err, reply) {
        if(err != null) {
            throw err;
        }
        callback(reply);
    });
}

function setUser(user)
{
    return client.hset('users', user.id, JSON.stringify(user));
}

function getUser(userId)
{
    var user = client.hget('users', userId);
    if(user) {
        return JSON.parse(user);
    }
    return null;
}

function getUsers(callback)
{
    var users = client.hgetall('users', function(err, users) {
        if(err != null) {
            throw err;
        }
        if(users === null) {
            callback({});
        } else {
            for (var i in users) {
                users[i] = JSON.parse(users[i]);
            }
            callback(users);
        }
    });
}

exports.getMessages = getMessages;
exports.setMessage = setMessage;
exports.setUser = setUser;
exports.getUser = getUser;
exports.getUsers = getUsers;