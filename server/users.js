var repository = require('./repository');
var Room = require('./rooms').Room;

var users;
var io;

function init(socketIO, callback) {
    io = socketIO;
    users = {};
    var auxUsers = repository.getUsers(function(auxUsers) {
        for (var i in auxUsers) {
            users[auxUsers[i].id] = new User(auxUsers[i].id, auxUsers[i].name, false, null, auxUsers[i].color);
        }
        callback();
        io.emit('users', getSortedUsers());
    });
}

function getRandomColor() {
    var letters = '3456789ABC'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 10)];
    }
    return color;
}

function User(id, name, logged, socket, color) {
    this.id = id;
    this.name = name;
    this.logged = logged;
    if(!color) {
        this.color = getRandomColor();
    } else {
        this.color = color;
    }
    var sockets = {};
    if(this.logged) {
        sockets[socket.id] = socket.id;
    }
    var openRooms = {};

    this.addSocket = function(socket) {
        if(!this.hasSocket(socket)) {
            sockets[socket.id] = socket.id;
        }
    };
    this.removeSocket = function(socket) {
        if(this.hasSocket(socket)) {
            delete sockets[socket.id];
        }
    };
    this.hasSocket = function(socket) {
        return socket.id in sockets;
    };
    this.isEmpty = function() {
        return Object.keys(sockets).length === 0 && sockets.constructor === Object;
    };
    this.openRoom = function(user, callback) {
        if(user.id in openRooms) {
            if(callback) {
                callback(openRooms[user.id]);
            }
        } else {
            var that = this;
            new Room([user, this], function(room) {
                openRooms[user.id] = room;
                that.emit('open chat', room);
                if(callback) {
                    callback(room);
                }
            });
        }
    };
    this.getRoom = function(userId) {
        if(userId in openRooms) {
            return openRooms[userId];
        }
        return null;
    };
    this.closeRoom = function(user) {
        delete openRooms[user.id];
    };
    this.getOpenRooms = function() {
        return openRooms;
    };
    this.emit = function() {
        for(var socketId in sockets) {
            io.sockets.connected[socketId].emit.apply(io.sockets.connected[socketId], arguments);
        }
    };
}

function getUser(id)
{
    if(id in users) {
        return users[id];
    }
    return null;
}

function loginUser(user, socket, callback) {
    try {
        if (user.id in users) {
            users[user.id].logged = true;
            if (users[user.id].name !== user.name) {
                users[user.id].name = user.name;
            }
            users[user.id].addSocket(socket);
        } else {
            users[user.id] = new User(user.id, user.name, true, socket);
        }
        repository.setUser(users[user.id]);
        io.emit('users', getSortedUsers());
        callback(users[user.id]);
    } catch(e) {
        console.log(e.message);
    }
}

function logoutUser(id) {
    users[id].logged = false;
    repository.setUser(users[id]);
    io.emit('users', getSortedUsers());
}

function isUserCreated(userId) {
    return userId in users;
}

function getSortedUsers() {
    var sortedUsers = [];
    for (var i in users)
        sortedUsers.push(users[i]);
    return sortedUsers.sort(
        function(a, b) {
            if(a.logged > b.logged) {
                return -1;
            }
            if(a.logged < b.logged) {
                return 1;
            }
            return 0;
        }
    );
}


exports.init = init;
exports.loginUser = loginUser;
exports.logoutUser = logoutUser;
exports.getUser = getUser;
exports.isUserCreated = isUserCreated;
exports.getLoggedUsers = getSortedUsers;