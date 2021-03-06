var db = require("../mongo.js");
/*
    Post Controller
    Post schema
    {
        id: ...
        users: id array
        usernames: array
        names: array
        the validated array stores the ids of the users that have accepted the invatation to talk
        validated: array
        the rejected array stores the ids of the users that rejected the invatation to talk, if all but one user rejects the conversation, it is deleted
        rejected: array
        the deleted array store the users that deleted validated conversation
        deleted: array
    }
    
*/


module.exports = {
    request: {
        description:    "Create a request for a user to start a conversation"  ,
        
        inputs: {
            cookie:     "The cookie that authenticates the user",
            un:         "The username to request a conversation with",
            
        }, exits: {
            success:    "Request is submitted",
            notAuth:    "User is not authenticated",
            nUsers:     "Could not find the users for group conversation",
            nUser:      "Could not find the user for one to one conversation",
            convStarted:"Conversation is already started",
            selfConv:   "User has entered their username as the target"
            
        }, fn: function(inputs, exits){
            var User = db.db.collection("user");
            var Conv = db.db.collection("conversation");
            var Action = db.db.collection("action");
            var Sess = db.db.collection("session");
        
            //basic auth, id of the user is sess.user
            Sess.findOne({cookie: inputs.cookie}, function(err, sess){
                if(err) throw err;
                if(sess){
                        if(inputs.un[0]==sess.username) return exits.selfConv();
                        var arr = [{username: sess.username}];
                        for(var i=0;i<inputs.un.length;i++){
                            arr.push({username: inputs.un[i]});
                        }
                        User.find({$or: arr}, {username: true, name: true}).toArray(function(err, users){
                            if(err) throw err;
                            if(users.length>1){
                                Conv.findOne({users: users}, function(err, conv){
                                    if(err) throw err;
                                    if(!conv){
                                        var verified = {
                                            _id: sess.user,
                                            username: sess.username,
                                            name: sess.name
                                        };
                                        Conv.insert({users: users, validated: [verified], rejected: [], deleted: [], created: (new Date())}, function(err, conv){
                                            if(err) throw err;
                                            var actionText = sess.name + " wants to start a conversation";
                                            var actionTo = [];
                                            for(var i = 0;i < users.length;i++){
                                                if(users[i]._id != sess.user){
                                                    actionTo.push(users[i]._id);
                                                }
                                            }
                                            Action.insert({read: [], type: "request", from: {name: sess.name, username: sess.username}, to: actionTo, text: actionText, created: new Date()}, function(err, action){
                                                if(err) throw err;
                                                return exits.success({conv: conv, action: action[0]})
                                            });
                                        })
                                    }else{
                                        return exits.convStarted();
                                    }
                                });
                            }else{
                                if(users.length==1){
                                    return exits.nUser();
                                }else{
                                    return exits.nUsers();
                                }
                            }
                        });
                }else{
                    return exits.notAuth();
                }
            });
        }
        
    }, validate: {
        description:    "Validates a users conversation request",
        
        inputs: {
            cookie:     "The cookie that authenticates the user",
            conv:       "The ID of the conversation that you are validating"
            
        }, exits: {
            success:    "The conversation was validated",
            notAuth:    "The user is not logged in",
            conv:       "Could not find the conversation or it is already started",
            
            
        }, fn: function(inputs, exits) {
            var sess = db.db.collection("session");
            var Conv = db.db.collection("conversation");
        
            sess.findOne({cookie: inputs.cookie}, function(err, sess){
                if(err) throw err;
                if(sess){
                    // Make sure it is that conversation, and it has not already been validated
                    Conv.update({_id: new db.objectID(inputs.conv), 'validated.username': {$ne: sess.username}}, {$push: {validated: {
                        _id: sess._id,
                        username: sess.username,
                        name: sess.name
                    }}}, function(err, conv){
                        if(err) throw err;
                        if(conv){
                            Conv.findOne({_id: new db.objectID(inputs.conv)}, function(err, conv) {
                                if(err) throw err;
                                return exits.success({conv: conv, user: sess.username});
                        });
                    }else{
                        return exits.conv();
                    }
                });
            }else{
                return exits.notAuth();
            }
            });
        }
    }, reject: {
        description: "rejects the proposed conversation and removes it from sight",
        
        inputs: {
            cookie:     "The cookie that authenticates the user",
            conv:       "The ID of the conversation that you are rejecting"
            
        }, exits: {
            success:    "The conversation was rejected",
            notAuth:    "User is not logged in",
            conv:       "either the conversation does not exist or it is already rejected"
            
        }, fn: function(inputs, exits) {
            var sess = db.db.collection("session");
            var Conv = db.db.collection("conversation");
            
            sess.findOne({cookie: inputs.cookie}, function(err, sess){
                if(err) throw err;
                if(sess){
                    Conv.update({_id: new db.objectID(inputs.conv), 'rejected.username': {$ne: sess.username}}, {$push: {rejected: {
                        _id: sess._id,
                        username: sess.username,
                        name: sess.name
                    }}}, function(err, conv){
                        if(err) throw err;
                        if(conv){
                            Conv.findOne({_id: new db.objectID(inputs.conv)}, function(err, conv) {
                                if(err) throw err;
                                conv.reject = sess._id;
                                Conv.remove({rejected: {$size: (conv.users.length-1)}}, function(err, conv2){
                                    if(err) throw err;
                                    return exits.success(conv);
                                });
                            });
                        }else{
                            return exits.conv();
                        }
                    });
                }else{
                    return exits.notAuth();
                }
            });
        }
    }, 
    delet: {
        description:    "Deletes a conversation",
        
        inputs: {
            cookie:     "The cookie that authenticates the user",
            conv:       "The ID of the conversation that you are deleting"
            
        }, exits: {
            success:    "conversation was deleted",
            notAuth:    "User is not logged in",
            conv:       "The conversation does not exist"
            
        }, fn: function(inputs, exits) {
            var sess = db.db.collection("session");
            var Conv = db.db.collection("conversation");
            sess.findOne({cookie: inputs.cookie}, function(err, sess){
                if(err) throw err;
                if(sess){
                    Conv.update({_id: new db.objectID(inputs.conv), 'deleted.username': {$ne: sess.username}}, {$push: {deleted: {
                        _id: sess.user,
                        name: sess.name,
                        username: sess.username
                    }}}, function(err, conv){
                        if(err) throw err;
                        if(conv){
                            Conv.findOne({_id: new db.objectID(inputs.conv)}, function(err, conv){
                                if(err) throw err;
                                conv.delet = sess.user;
                                Conv.remove({deleted: {$size: (conv.users.length)}}, function(err, conv2){
                                    if(err) throw err;
                                    return exits.success(conv);
                                });
                            });
                        }else{
                            return exits.conv();
                        }
                    });
                }else{
                    return exits.notAuth();
                }
            });
        }
    }, logintest: function(data, cb){
        var sess = db.db.collection("session");
        sess.findOne({cookie: data.cookie}, function(err, sess){
            if(err) throw err;
            if(sess){
                
            }else{
                return cb({err: "Not logged in"});
            }
        });
    }
}