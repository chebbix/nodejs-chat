var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = require('./users');

users.init(io, function() {
    http.listen(3000, function(){
        console.log('listening on *:3000');
    });
});

io.on('connection', function(socket) {
    var userId;
    socket.on('login', function(user) {
        users.loginUser(user, socket, function(loggedUser) {
            userId = user.id;
            var openRooms = loggedUser.getOpenRooms();
            for(var i in openRooms) {
                socket.emit('open chat', openRooms[i]);
            }
        });
    });
    socket.on('disconnect', function() {
        if(userId) {
            var user = users.getUser(userId);
            if(user) {
                user.removeSocket(socket);
                if(user.isEmpty()) {
                    users.logoutUser(userId);
                }
            }
        }
    });
    socket.on('open chat', function(targetUserId) {
        if(userId) {
            var user = users.getUser(userId);
            var targetUser = users.getUser(targetUserId);
            if(user && targetUser) {
                user.openRoom(targetUser);
            }
        }
    });
    socket.on('close chat', function(targetUserId) {
        if(userId) {
            var user = users.getUser(userId);
            var targetUser = users.getUser(targetUserId);
            if (user && targetUser) {
                user.closeRoom(targetUser);
            }
        }
    });
    socket.on('add message', function(targetUserId, txt) {
        if(userId) {
            var user = users.getUser(userId);
            var targetUser = users.getUser(targetUserId);
            if (user && targetUser) {
                var room = user.getRoom(targetUser.id);
                if (room) {
                    room.addMessage(user, txt, function (message) {
                        user.emit('add message', room.id, message);
                        var targetRoom = targetUser.getRoom(user.id);
                        if (targetRoom) {
                            targetRoom.updateMessages(function () {
                                targetUser.emit('add message', targetRoom.id, message);
                            });
                        } else {
                            targetUser.openRoom(user);
                        }
                    });
                }
            }
        }
    });
    socket.on('room history', function(targetUserId, page) {
        if(userId) {
            var user = users.getUser(userId);
            var targetUser = users.getUser(targetUserId);
            if (user && targetUser) {
                var room = user.getRoom(targetUser.id);
                if (room) {
                    room.getMessageHistory(page, function (messages) {
                        user.emit('room history', room.id, page, messages);
                    });
                }
            }
        }
    });
});