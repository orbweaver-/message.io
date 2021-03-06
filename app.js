//stores all of the imported variables
var im = require("./import.js");

//express settings
im.app.set('views', __dirname + '/assets/views');
im.app.use(im.express.static(__dirname+'/assets'));
im.app.engine('html', require('ejs').renderFile);
im.app.set('view engine', 'ejs');


//Routes
im.app.get('/', function(req, res){
    res.render('index.html');
});

//Start the server
im.db.mongoclient.open(function(err, mongoclient) {
    if(err) throw err;
    var port = process.argv[2];
    if(!port) port = 8080; 
    im.server.listen(port);
    console.log("Server started on port "+port);
});

//All the Socket connections
im.io.on('connection', function(socket){
    
    //Login sockets
    socket.on("signUp", function(data){
        console.log("signing up");
        im.login.signUp.fn(data, {
            success: function(data) {
                socket.emit("signUp", "Signed up succesfully");
            }, formIncomplete: function() {
                socket.emit("errorr", "Form was not completed");
            }, whitespace: function() {
                socket.emit("errorr", "Username cannot have whitespace");
            }, password: function() {
                socket.emit("errorr", "Password must be at least eight characters");
            }, notEmail: function(){
                socket.emit("errorr", "Email is not formatted correctly");
            }, unTaken: function() {
                socket.emit("errorr", "Username is already taken");
            }, emailTaken: function() {
                socket.emit("errorr", "The email is taken");
            }
        });
    });
    
    socket.on("login", function(data){
        data.socket = socket.id;
        console.log("login");
        
        im.db.db.collection('session').update({cookie: data.cookie}, {$set: {socket: socket.id}}, function(err, sess){
            im.login.login.fn(data, {
                success: function(data) {
                    socket.join("user"+data.status._id);
                    socket.emit('login', {status: data.status, user: data.status, cookie: data.cookie});
                }, incomplete: function() {
                    socket.emit("errorr", "Form incomplete");
                }, match: function() {
                    socket.emit("errorr", "Email and password do not match");
                }
            });
        });
    });
    
    socket.on("logout", function(data){
        console.log("logout");
        im.login.logout.fn({cookie: data}, {
            success: function(){
                socket.emit('logout', true);
            }, notAuth: function(){
                socket.emit("errorr", "You are not logged in");
            }
        });
    });
    
    socket.on("auth", function(data) {
        //update the users socket with each page load
        im.db.db.collection('session').update({cookie: data}, {$set: {socket: socket.id}}, function(err, sess){
            console.log("Authenticating");
            im.login.auth.fn({cookie: data}, {
                success: function(data){
                    socket.join("user"+data.user._id);
                    socket.emit('auth', {status: data.status, user: data.user, actions: data.actions});
                    socket.emit("convs", data.conv);
                }, notAuth: function(){
                    socket.emit('auth', {status: false});
                }
            });
        });
    });
    
    //message sockets
    socket.on("request", function(data){
        console.log("request");
        im.post.request.fn(data, {
            success: function(data){
                for(var i=0;i<data.conv[0].users.length;i++){
                    im.io.to("user"+data.conv[0].users[i]._id).emit("convs", data.conv);
                }
                for(var i=0;i<data.action.to.length;i++){
                    im.io.to("user"+data.action.to[i]).emit("action", data.action);
                }
            }, notAuth: function() {
                socket.emit("errorr", "You are not logged in.");
            }, nUsers: function() {
                socket.emit("errorr", "The users not found");
            }, nUser: function() {
                socket.emit("errorr", "User not found");
            }, convStarted: function() {
                socket.emit("errorr", "Conversation already exists");
            }, selfConv: function() {
                socket.emit("errorr", "That is your username");
            }
        });
    });
    socket.on("validate", function(data) {
        im.post.validate.fn(data, {
            success: function(data){
                for(var i=0;i<data.conv.users.length;i++){
                    im.io.to("user"+data.conv.users[i]._id).emit("validate", data);
                }
            }, notAuth: function(){
                socket.emit("errorr", "Not logged in");
            }, conv: function(){
                socket.emit("error", "Conversation already started");
            }
        });
    });
    socket.on("reject", function(data){
        im.post.reject.fn(data, {
            success: function(data){
                for(var i=0;i<data.users.length;i++){
                    im.io.to("user"+data.users[i]._id).emit("reject", data);
                }
            }, notAuth: function(){
                socket.emit("errorr", "Not logged in");
            }, conv: function(){
                socket.emit("errorr", "Conversation already rejected");
            }
        });
    });
    socket.on("delet", function(data){
        socket.leave("conv"+data.conv);
        im.post.delet.fn(data, {
            success: function(data) {
                socket.emit("delet", data);
            }, notAuth: function(){
                socket.emit("errorr", "Not logged in");
            }, conv: function(){
                socket.emit("errorr", "Conversation already rejected");
            }
        });
    });
    //begin messages sockets
    socket.on("getMessages", function(data){
        var rooms = socket.rooms;
        im.message.getMessages.fn(data, {
            success: function(data) {
                console.log("getMessages");
                socket.join("conv"+data.conv);
                socket.emit("getMessages", data.messages);
            }, permission: function() {
                socket.emit("errorr", "You do not have permission to access this conversation");
            }, notAuth: function() {
                socket.emit("errorr", "You are not authenticated");
            }
        });
    });
    socket.on("newMess", function(data){
        im.message.newMess.fn(data, {
            success: function(data){
                console.log("newMess");
                im.io.to("conv"+data[0].conv).emit("newMess", data[0]);
            }, markup: function() {
                socket.emit("errorr", "You cannot send a message with an < in it");
            }, permission: function() {
                socket.emit("errorr", "You do not have permission to post here");
            }, notAuth: function() {
                socket.emit("errorr", "You are not logged in");
            }
        });
    });
    
    //Action Controller sockets
    socket.on("showNots", function(data){
        im.action.showNots.fn(
        {
            data: data
        },  
        {
            success: function(results)
            {
                console.log("Notifications seen");
                socket.emit("showNots", results);
            },
            notAutheticated: function()
            {
                socket.emit("error", "You are not autheticated");
            }
        });
    });
    
    socket.on("disconnect", function(data){
        /*db.db.collection('session').remove({socket: socket.id}, function(err, sess){
            if(err) throw err;
            if(sess) console.log(socket.id+" logged off");
        });*/
    });
});