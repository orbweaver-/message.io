(function(){
    var app = angular.module("app", ['btford.socket-io']);
    app.factory('socket', function (socketFactory) {
        return socketFactory({
            ioSocket: io.connect('http://104.131.176.87:8080/')
        });
    });

    app.controller("userController", ['$scope', '$rootScope', 'socket', function(s, rs, socket){
        rs.auth = false;
        this.hi = "hello";
    }]);
    app.controller("postController", ['$scope', '$rootScope', 'socket', function(s, rs, socket){
        //send request to talk
        rs.convs = [];
        this.request = function(username){
            username = username.split(",");
            socket.emit("request", {un: username, cookie: getCookie("auth")});
        }
        this.validate = function(id, conv){
            socket.emit("validate", {id: id, conv: conv, cookie: getCookie("auth")});
        }
        socket.on("request", function(data){
            if(data.err) return showErr(data.err);
            rs.convs.push(data.conv);
        });
        socket.on("convs", function(data){
            for(var i=0;i<data.length;i++){
                if(data[i].users.length > 2) {
                    data[i].multi = true;
                }else{
                    if(data[i].users[0].username==rs.user.username){
                        data[i].other = 1;
                    }else{
                        data[i].other = 0;
                    }
                }
                if(data[i].validated.length>1&&!data[i].multi) {
                    data[i].valid = true;
                }else{
                    if(data[i].validated[0].username==rs.user.username){
                        data[i].canValidate = true;
                    }
                }
                rs.convs.push(data[i]);
            }
        });
    }]);
    app.controller("loginController", ['$http', '$scope', '$rootScope', 'socket', function(h, s, rs, socket){
        rs.signUp = false;
        this.temp = {};
        
        //page load auth
        var auth = getCookie("auth");
        //make sure this doesn't get called twice
        if(auth!=""&&!rs.once){
            socket.emit('auth', auth);
        }
        rs.once = true;
        this.login = function(email, pass){
            socket.emit("login", {
               email: email,
               pass: pass
            });
            s.log.temp = {};
        };
        this.signUp = function(user, name, email, pass, cpass){
            console.log("signing up");
            if(pass == cpass){
                socket.emit("signUp", {
                    name: name,
                    username: user,
                    email: email,
                    name: name,
                    password: pass
                });
                s.log.temp = {};
            }else{
                showErr("Passwords do not match")
            }
        };
        this.logout = function(){
            socket.emit("logout", getCookie("auth"));
        };
        this.toggleSign = function(){
            rs.signUp = !rs.signUp;
        }
        socket.on("auth", function(data) {
            if(data.status){
                rs.user = data.user;
                console.log(rs);
                return rs.auth = true;
            }
        })
        socket.on("signUp", function(data){
            if(data.err) return showErr(data.err);
            showInfo(data.status);
        });
        socket.on('login', function(data) {
            if(data.err) return showErr(data.err);
            showInfo("Logged in");
            rs.user = data.status;
            rs.auth = true;
            document.cookie = "auth="+data.cookie;
        });
        socket.on("logout", function(data){
            if(data.err) return showErr(data.err);
            rs.user = {};
            rs.auth = false;
            document.cookie = "auth=";
        });
    }]);
})();