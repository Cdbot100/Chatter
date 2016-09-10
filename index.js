
//Mostly hacked together sample code =)
//Scott Gordon

//includes
var Botkit = require('Botkit');
var os = require('os');

var MongoClient = require('mongodb').MongoClient
  , assert = require('assert'); 

// Connection URL
var url = 'mongodb://localhost:27017/chatter'; 

//known keywords
var keywords = ['hello','thanks','thank you','ty', 'grades', 'marks', 'what are my','hi', 'hey','call me (.*)', 'my name is (.*)','what is my name', 'who am i','shutdown','uptime', 'identify yourself', 'who are you', 'what is your name', 'pizzatime', 'marks', 'attach'];

// Use connect method to connect to the server
MongoClient.connect(url, function(err, db) {
    if (err) {
    console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
    console.log("Connected successfully to: ", url);
    } //sg
}); 

//did you pass the token? (for mwsu sandbox api token can be passed automatically using run.sh)
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

//controller for our slackbot, a folder to save jsons, and turn on console debugging 
var controller = Botkit.slackbot({
    json_file_store: './json_database.db',
    debug: true
});
//spawn the token, set its value, start the chatbot
var bot = controller.spawn({
    token: process.env.token
}).startRTM();

//bot hears hello in a direct message or a @chatbot message 
controller.hears(['hello', 'hi', 'hey'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

//example code on how to use conversations to have long meaningful exchanges. also storage.users.save
controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

//example of referencing code in the local file
controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });

                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});

//good method for shutdown 
controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});

//a simple conversation about za
controller.hears(['pizzatime'], 'message_received,direct_message,direct_mention,mention', function(bot,message) {
    askFlavor = function(response, convo) {
      convo.ask('What flavor of pizza do you want?', function(response, convo) {
        convo.say('Awesome.');
        askSize(response, convo);
        convo.next();
      });
    }
    askSize = function(response, convo) {
      convo.ask('What size do you want?', function(response, convo) {
        convo.say('Ok.')
        askWhereDeliver(response, convo);
        convo.next();
      });
    }
    askWhereDeliver = function(response, convo) {
      convo.ask('So where do you want it delivered?', function(response, convo) {
        convo.say('Ok! Good bye.');
        convo.next();
      });
    }

    bot.startConversation(message, askFlavor);
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

//we want the controller to be able to query a DB, find our student based on ID, and return a list of grade objects
//heres our "Hears" function. a slash command for grades would have similar behavior

controller.hears(['grades', 'marks', 'what are my'],
    'direct_message,direct_mention,mention', function(bot, message) {

    student_id = function(response, convo) {
      convo.ask('What is your student ID?', function(response, convo) {
        convo.say('Awesome, let me look for those...I dont have them lulz');
        //askSize(response, convo);
        convo.next();
    });
    }
    //retrieve grades based on ID from DB

    //handle no student found Error

    //list grades individually 

    //print overall grade, (handle A marks, B marks , C or below) with smiley face
    bot.startConversation(message, student_id);
});

//simple response 
controller.hears(['thanks','thank you','ty'], 'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message, 'No problem');
});

//good example of how to print attachments legiably 
controller.hears(['attach'],['direct_message','direct_mention'],function(bot,message) {

  var attachments = [];
  var attachment = {
    title: 'This is an attachment',
    color: '#FFCC99',
    fields: [],
  };

  attachment.fields.push({
    label: 'Field',
    value: 'A longish value',
    short: false,
  });

  attachment.fields.push({
    label: 'Field',
    value: 'Value',
    short: true,
  });

  attachment.fields.push({
    label: 'Field',
    value: 'Value',
    short: true,
  });

  attachments.push(attachment);

  bot.reply(message,{
    text: 'See below...',
    attachments: attachments,
  },function(err,resp) {
    console.log(err,resp);
  });
});

//handler for unknown keyword
controller.hears(['',!keywords ],'direct_message,direct_mention,mention',function(bot,message) {  
   bot.reply(message, 'wha?'); 
})

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
