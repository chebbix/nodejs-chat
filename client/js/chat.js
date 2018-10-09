function ChatWindow(options) {
    var _this = this;
    var defaultOptions = {
        right: 10,
        contentHeight: 250,
        isMaximized: true,
        canClose: false,
        onCreated: function() {},
        onClose: function() {},
        onMaximizedStateChanged: function() {}
    };
    this.options = $.extend({}, defaultOptions, options);

    this.$window = $("<div/>").addClass("chat-window").appendTo($("body"));
    if (this.options.width)
        this.$window.css("width", this.options.width);
    this.$windowTitle = $("<div/>").addClass("chat-window-title").appendTo(this.$window);
    if (this.options.canClose) {
        var $closeButton = $("<div/>").addClass("close").appendTo(this.$windowTitle);
        $closeButton.click(function (e) {
            e.stopPropagation();

            // removes the window
            _this.$window.remove();

            // triggers the event
            _this.options.onClose(_this);
        });
    }
    $("<div/>").addClass("text").text(this.options.title).appendTo(this.$windowTitle);

    // content
    this.$windowContent = $("<div/>").addClass("chat-window-content").appendTo(this.$window);
    if (this.options.height)
        this.$windowContent.css("height", this.options.height);
    this.$windowInnerContent = $("<div/>").addClass("chat-window-inner-content").appendTo(this.$windowContent);

    // wire everything up
    this.$windowTitle.click(function () {
        _this.toggleMaximizedState();
    });

    this.setState(this.options.isMaximized, false);
    this.$window.css("right", this.options.right);
    this.$windowInnerContent.height(this.options.contentHeight);

    this.options.onCreated(this);
}

ChatWindow.prototype.setVisible = function (visible) {
    if (visible)
        this.$window.show();
    else
        this.$window.hide();
};

// returns whether the window is maximized
ChatWindow.prototype.getState = function () {
    return !this.$window.hasClass("minimized");
};

ChatWindow.prototype.setState = function (state, triggerMaximizedStateEvent) {
    // windows are maximized if the this.$windowContent is visible
    if (typeof triggerMaximizedStateEvent === "undefined") { triggerMaximizedStateEvent = true; }
    if (state) {
        // if it can't expand and is maximized
        this.$window.removeClass("minimized");
        this.$windowContent.show();
    } else {
        // if it can't expand and is minimized
        this.$window.addClass("minimized");
        this.$windowContent.hide();
    }

    if (triggerMaximizedStateEvent)
        this.options.onMaximizedStateChanged(this, state);
};
ChatWindow.prototype.toggleMaximizedState = function () {
    this.setState(this.$window.hasClass("minimized"));
};

ChatWindow.prototype.getWidth = function() {
    return this.$window.width();
};

function Chat(options) {
    var _this = this;
    this.socket = options.socket;
    this.user = options.user;
    options.onMaximizedStateChanged = function (window, state) {
        _this.saveState(state);
    };
    this.window = new ChatWindow(options);
    this.$userList = this.window.$windowInnerContent;
    this.$userList.addClass('user-list');
    this.pmWindows = {};


    this.updateUsers = function (users) {
        _this.$userList.empty();
        var j = 0;
        while (j < users.length) {
            if (users[j].id == _this.user.id)
                users.splice(j, 1);
            else
                j++;
        }
        if (users.length == 0) {
            $("<div/>").addClass("user-list-empty").text('No hay usuarios conectados').appendTo(_this.$userList);
        } else {
            for(var i in users) {
                var user = users[i];
                var $userListItem = $("<div/>").addClass("user-list-item").attr("data-val-id", user.id).appendTo(_this.$userList);
                $("<div/>").addClass("profile-status").addClass(user.logged == 0 ? "offline" : "online").appendTo($userListItem);
                $("<div/>").addClass("content").text(user.name).css('color', user.color).appendTo($userListItem);

                (function (userId) {
                    // handles clicking in a user. Starts up a new chat session
                    $userListItem.click(function () {
                        _this.socket.emit('open chat', userId);
                    });
                })(user.id);
            }
        }
    };

    this.openMessageWindow = function(room) {
        if (room.id in _this.pmWindows) {

        } else {
            _this.createPmWindow(room);
        }
    };

    this.addNewMessage = function(roomId, message) {
        if (roomId in _this.pmWindows) {
            _this.pmWindows[roomId].setState(true);
            _this.pmWindows[roomId].addMessage(message, _this.user, true);
        }
    };

    this.roomHistory = function (roomId, page, messages) {
        if (roomId in _this.pmWindows) {
            _this.pmWindows[roomId].addHistory(_this.user, messages);
        }
    };

    this.socket.on('users', this.updateUsers);
    this.socket.on('open chat', this.openMessageWindow);
    this.socket.on('add message', this.addNewMessage);
    this.socket.on('room history', this.roomHistory);
    this.restoreState();
}

Chat.prototype.createPmWindow = function (roomData) {
    var _this = this;
    var user;
    for (var i in roomData.users) {
        if(roomData.users[i].id != this.user.id) {
            user = roomData.users[i];
        }
    }
    var room = new Room({
        user: user,
        room: roomData,
        onNewMessage: function(msg, userId) {
            _this.socket.emit('add message', userId, msg);
        },
        onClose: function() {
            _this.socket.emit('close chat', user.id);
            delete _this.pmWindows[roomData.id];
            _this.organizePmWindows();
        },
        getMoreHistory: function(page) {
            _this.socket.emit('room history', user.id, page);
        }
    });
    if(roomData.messages.length < 20) {
        room.hasMorePages = false;
    }

    for (var i in roomData.messages) {
        room.addMessage(roomData.messages[i], _this.user, false);
    }
    this.pmWindows[roomData.id] = room;
    this.organizePmWindows();
    room.window.onClose = function () {
        delete _this.pmWindows[room.room.id];
        _this.organizePmWindows();
    };
};

// organizes the pm windows
Chat.prototype.organizePmWindows = function () {
    // this is the initial right offset
    var rightOffset = 25 + this.window.getWidth();
    for (var i in this.pmWindows) {
        this.pmWindows[i].window.$window.css('right', rightOffset);
        rightOffset += this.pmWindows[i].window.getWidth() + 10;
    }
};

Chat.prototype.getState = function () {
    return this.window.getState();
};

Chat.prototype.saveState = function (state) {
    createCookie('chat-state', state);
};

Chat.prototype.restoreState = function () {
    var state = readCookie('chat-state');
    if(state !== null) {
        this.window.setState(state);
    }
};


function Room(options) {
    var _this = this;
    this.options = options;
    this.room = this.options.room;
    this.user = options.user;
    this.window = new ChatWindow({
        title: this.user.name,
        canClose: true,
        onClose: this.options.onClose,
        onMaximizedStateChanged: function (window, state) {
            _this.saveState(state);
        }
    });
    this.window.$windowTitle.css('color', this.user.color);
    this.$pmContent = this.window.$windowInnerContent;
    this.$pmContent.addClass("pm-window").addClass("message-board");

    this.$messagesWrapper = $("<div/>").addClass("messages-wrapper").appendTo(this.$pmContent);

    // sets up the text
    var $windowTextBoxWrapper = $("<div/>").addClass("chat-window-text-box-wrapper").appendTo(this.$pmContent);

    this.$textBox = $("<textarea />").attr("rows", "1").addClass("chat-window-text-box").appendTo($windowTextBoxWrapper).css('font-size', '13px');
    this.$textBox.autosize({
        callback: function (ta) {
            var messagesHeight = 250 - $(ta).outerHeight();
            _this.$messagesWrapper.height(messagesHeight);
        }
    });
    this.$textBox.keypress(function (e) {
        if (e.which == 13) {
            e.preventDefault();
            if (_this.$textBox.val()) {
                _this.options.onNewMessage(_this.$textBox.val(), _this.user.id);
                _this.$textBox.val('').trigger("autosize.resize");
            }
        }
    });
    this.paginating = false;
    this.hasMorePages = true;
    this.page = 1;

    this.$messagesWrapper.scroll(function(){
        if(_this.hasMorePages && !_this.paginating && _this.$messagesWrapper.scrollTop() == 0) {
            _this.getMoreHistory();
        }
    });

    this.restoreState();
}
Room.prototype.getMoreHistory = function () {
    this.paginating = true;
    this.page++;
    this.options.getMoreHistory(this.page);
};
Room.prototype.adjustScroll = function () {
    this.$messagesWrapper[0].scrollTop = this.$messagesWrapper[0].scrollHeight;
};
Room.prototype.playSound = function () {
    /// <summary>Plays a notification sound</summary>
    /// <param FullName="fileFullName" type="String">The file path without extension</param>
    var $soundContainer = $("#soundContainer");
    if (!$soundContainer.length)
        $soundContainer = $("<div>").attr("id", "soundContainer").appendTo($("body"));
    var baseFileName = "sounds/chat";
    var oggFileName = baseFileName + ".ogg";
    var mp3FileName = baseFileName + ".mp3";

    var $audioTag = $("<audio/>").attr("autoplay", "autoplay");
    $("<source/>").attr("src", oggFileName).attr("type", "audio/mpeg").appendTo($audioTag);
    $("<embed/>").attr("src", mp3FileName).attr("autostart", "true").attr("loop", "false").appendTo($audioTag);

    $audioTag.appendTo($soundContainer);
};
Room.prototype.addMessage = function (message, currentUser, playSound, prepend) {

    var $messageP = $("<p/>").text(message.text);

    linkify($messageP);
    emotify($messageP);


    var date = new Date(message.created);
    var $iconTime = $('<i/>').addClass('icon-time')
        .css('float', 'right')
        .css('opacity', '0.5')
        .attr("data-toggle", "tooltip")
        .attr("title", 'Enviado: ' + date.toLocaleString())
        .hide();
    $messageP.append($iconTime);
    $messageP.hover(function() {
        $iconTime.show();
    }, function() {
        $iconTime.hide();
    });

    var $lastMessage = $("div.chat-message:last", this.$messagesWrapper);
    if(prepend) {
        $lastMessage = $("div.chat-message:first", this.$messagesWrapper);
    }

    var formatedTime = date.getFullYear() + date.getMonth() + date.getDate() + date.getHours() + Math.round(date.getMinutes() / 10);
    if ($lastMessage.length && $lastMessage.data("user") == message.user.id && $lastMessage.data("time") == formatedTime) {
        if(prepend) {
            $messageP.prependTo($(".chat-text-wrapper", $lastMessage));
        } else {
            $messageP.appendTo($(".chat-text-wrapper", $lastMessage));
        }
    } else {
        var $chatMessage = $("<div/>").addClass("chat-message")
            .data('user', message.user.id)
            .data('time', formatedTime);

        if(message.user.id != currentUser.id) {
            $chatMessage.css('color', message.user.color)
                .addClass('another-user-message');
        } else {
            $chatMessage.addClass('current-user-message');
        }
        if(prepend) {
            $chatMessage.prependTo(this.$messagesWrapper);
        } else {
            $chatMessage.appendTo(this.$messagesWrapper);
        }

        var $textWrapper = $("<div/>").addClass("chat-text-wrapper").appendTo($chatMessage);

        // add text
        $messageP.appendTo($textWrapper);
    }
    if(message.user.id != currentUser.id && playSound) {
        this.playSound();
    }

    if(prepend) {
        this.$messagesWrapper[0].scrollTop += $messageP.height();
    } else {
        this.adjustScroll();
    }
};

Room.prototype.addHistory = function(currentUser, messages)
{
    messages.reverse();
    for (var i in messages) {
        this.addMessage(messages[i], currentUser, false, true);
    }
    this.hasMorePages = messages.length == 20;
    this.paginating = false;
};

Room.prototype.getState = function () {
    return this.window.getState();
};

Room.prototype.setState = function (state) {
    return this.window.setState(state);
};

Room.prototype.saveState = function (state) {
    createCookie('room-state-' + this.room.id, state);
};

Room.prototype.restoreState = function () {
    var state = readCookie('room-state-' + this.room.id);
    if(state !== null) {
        this.window.setState(state);
    }
};

function readCookie(name) {
    var nameEq = name + "=";
    var ca = document.cookie.split(';');
    var cookieValue;
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ')
            c = c.substring(1, c.length);
        if (c.indexOf(nameEq) == 0) {
            cookieValue = c.substring(nameEq.length, c.length);
        }
    }
    if (cookieValue) {
        try  {
            return JSON.parse(cookieValue);
        } catch (e) {
            return cookieValue;
        }
    } else
        return null;
}

function createCookie(name, value) {
    document.cookie = name + "=" + value + "; path=/";
}

function linkify($element) {
    var inputText = $element.html();
    var replacedText, replacePattern1, replacePattern2, replacePattern3;

    //URLs starting with http://, https://, or ftp://
    replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    replacedText = inputText.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

    //URLs starting with "www." (without // before it, or it'd re-link the ones done above).
    replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
    replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

    //Change email addresses to mailto:: links.
    replacePattern3 = /(\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,6})/gim;
    replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

    return $element.html(replacedText);
}

function emotify($element) {
    var inputText = $element.html();
    var replacedText = inputText;

    var emoticons = [
        { pattern: ":-\)", cssClass: "happy" },
        { pattern: ":\)", cssClass: "happy" },
        { pattern: "=\)", cssClass: "happy" },
        { pattern: ":-D", cssClass: "very-happy" },
        { pattern: ":D", cssClass: "very-happy" },
        { pattern: "=D", cssClass: "very-happy" },
        { pattern: ":-\(", cssClass: "sad" },
        { pattern: ":\(", cssClass: "sad" },
        { pattern: "=\(", cssClass: "sad" },
        { pattern: ":-\|", cssClass: "wary" },
        { pattern: ":\|", cssClass: "wary" },
        { pattern: "=\|", cssClass: "wary" },
        { pattern: ":-O", cssClass: "astonished" },
        { pattern: ":O", cssClass: "astonished" },
        { pattern: "=O", cssClass: "astonished" },
        { pattern: ":-P", cssClass: "tongue" },
        { pattern: ":P", cssClass: "tongue" },
        { pattern: "=P", cssClass: "tongue" }
    ];

    for (var i = 0; i < emoticons.length; i++) {
        replacedText = replacedText.replace(emoticons[i].pattern, "<span class='" + emoticons[i].cssClass + "'></span>");
    }

    return $element.html(replacedText);
}