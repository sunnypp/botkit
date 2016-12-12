/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack Button application that adds a bot to one or many slack teams.

# RUN THE APP:
  Create a Slack app. Make sure to configure the bot user!
    -> https://api.slack.com/applications/new
    -> Add the Redirect URI: http://localhost:3000/oauth
  Run your bot from the command line:
    clientId=<my client id> clientSecret=<my client secret> port=3000 node slackbutton_bot_interactivemsg.js
# USE THE APP
  Add the app to your Slack by visiting the login page:
    -> http://localhost:3000/login
  After you've added the app, try talking to your bot!
# EXTEND THE APP:
  Botkit has many features for building cool and useful bots!
  Read all about it here:
    -> http://howdy.ai/botkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

/* Uses the slack button feature to offer a real time bot to multiple teams */
var Botkit = require('../lib/Botkit.js');

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
  console.log('Error: Specify clientId clientSecret and port in environment');
  process.exit(1);
}

var feature_servers = {
	feature_numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ],
	// using _ to indicate input *before* passing bot and message
	freeSite_ByUser_: ( number, user, bot, message ) => {
		
	},
	
	makeStatusText: ( servers ) => {
		return 'Feature servers: ' + feature_servers.feature_numbers.map( i => servers.list[i] ? `:red_circle: ${i}` : `:white_circle: ${i}` ).join` | `;
	},
	
	makeFullStatusText: ( servers ) => {
		return feature_servers.feature_numbers.map( i => servers.list[i] ? `:red_circle: Feature ${i} being used by ${servers.list[i]}` : `:white_circle: Feature ${i} is free` ).join`\n`;
	},
};

var controller = Botkit.slackbot({
  // interactive_replies: true, // tells botkit to send button clicks into conversations
  json_file_store: './db_slackbutton_bot/',
}).configureSlackApp(
  {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    scopes: ['bot', 'commands', 'channels:write'],
  }
);

controller.setupWebserver(process.env.port,function(err,webserver) {
  controller.createWebhookEndpoints(controller.webserver);

  controller.createOauthEndpoints(controller.webserver,function(err,req,res) {
    if (err) {
      res.status(500).send('ERROR: ' + err);
    } else {
      res.send('Success!');
    }
  });
});


// just a simple way to make sure we don't
// connect to the RTM twice for the same team
var _bots = {};
function trackBot(bot) {
  _bots[bot.config.token] = bot;
}

controller.on('create_bot',function(bot,config) {

  if (_bots[bot.config.token]) {
    // already online! do nothing.
  } else {
    bot.spawn({token: process.env.token }).startRTM(function(err) {

      if (!err) {
        trackBot(bot);
      }

      bot.startPrivateConversation({user: config.createdBy},function(err,convo) {
        if (err) {
          console.log(err);
        } else {
          convo.say('I am a bot that has just joined your team');
          convo.say('You must now /invite me to a channel so that I can be of use!');
        }
      });

    });
  }

});


// Handle events related to the websocket connection to Slack
controller.on('rtm_open',function(bot) {
  console.log('** The RTM api just connected!');
});

controller.on('rtm_close',function(bot) {
  console.log('** The RTM api just closed');
  // you may want to attempt to re-open
});
/*
controller.on('slash_command', (bot,message) => {
	
	let [msg, number, branch] = message.command.match(/^feature\s+(\d)\s*(.*$)/);
	
	if ( number == '' ) {
		bot.replyPrivate( message, 'Please specify the feature server number with a space after the `/feature` command.' );
		return;
	}
	
	if ( branch == '' ) {
		
	}
	
});
*/
controller.hears([ /us(?:e|ing)\s+feature\s*(\d)/i , /building.*feature\s*(\d)/i ],'direct_mention,direct_message,ambient', (bot,message) => {

    controller.storage.users.get(message.user, (err, user) => {

        if (!user) {
            user = {
                id: message.user,
				name: 'Someone'
            }
			
			bot.reply(message, 'I don\'t know your name yet.  Try telling me `@ecomtestsites call me <your-name>` or introduce yourself to me via `@ecomtestsites my name is <your-name>`. :smile:');
        }
				
		controller.storage.users.get('__feature_server__', (e, servers) => {
			if (!servers) {
				servers = {
					id: '__feature_server__',
					list: ['','','','','']
				}
			}
			
			var feature_id = message.match[1];
			
			if ( servers.list[feature_id] != '' && servers.list[feature_id] != user.name ) {
				bot.reply(message, `Feature ${feature_id} is being used by *${servers.list[feature_id]}*. Please ask if (s)he wants you to build on it.\nIf yes, please tell ${servers.list[feature_id]} to free it or you may _forcefully_ free it by \`Forcefully free feature ${feature_id}\``);
				return;
			}
			else {
				servers.list[feature_id] = user.name;
			
				controller.storage.users.save(servers);			
			
				//bot.reply(message, [0, 1, 2, 3, 4].map( i => servers.list[i] ? `Feature ${i} being used by ${servers.list[i]}` : `Feature ${i} is free` ));
				
				/*
				bot.api.channels.setTopic({ 
					channel: message.channel, 
					topic: 'FEATURE — ' + [0, 1, 2, 3, 4].map( i => ' — ' + i + ( servers.list[i] == '' ? ':white_check_mark:' : `:x:${servers.list[i]}`) ).join(' — ')
				}, (api_err) => { if (api_err) { console.log(api_err) } });
				*/
				bot.api.reactions.add({ timestamp: message.ts, channel: message.channel, name: 'white_check_mark', }, (api_err) => { if (api_err) { console.log(api_err) } });

				/*							
				let literals = ["zero", "one", "two", "three", "four"];

				[0, 1, 2, 3, 4].filter( i => servers.list[i] == '' ).map( i => {
					bot.api.reactions.add({ timestamp: message.ts, channel: message.channel, name: literals[i], }, (api_err) => { if (api_err) { console.log(api_err) } });
				});
				*/
								
			}
			
		});

        controller.storage.users.save(user);

    });
	
});

controller.hears([ /forcefully\s+free\s+feature\s*(\d)/i ], 'direct_mention,direct_message,ambient', (bot, message) => {

	controller.storage.users.get('__feature_server__', (e, servers) => {
		if (!servers) {
			return;
		}
		
		var feature_id = message.match[1];
		servers.list[feature_id] = '';

		controller.storage.users.save(servers);
					
		bot.reply( message, feature_servers.makeFullStatusText(servers) );
		
	});

});


controller.hears([ /feature\s+full\s+status/i ], 'direct_mention,direct_message,ambient', (bot, message) => {

	controller.storage.users.get('__feature_server__', (e, servers) => {
		if (!servers) {
			return;
		}
		
		bot.reply( message, feature_servers.makeFullStatusText(servers) );
		
	});

});


controller.hears([ /feature\s+status/i ], 'direct_mention,direct_message,ambient', (bot, message) => {

	controller.storage.users.get('__feature_server__', (e, servers) => {
		if (!servers) {
			return;
		}
		
		bot.reply( message, feature_servers.makeStatusText(servers) );
		
	});

});

controller.hears([ /free\s+feature\s*(\d)/i, /feature\s*(\d).*free/i ], 'direct_mention,direct_message,ambient', (bot, message) => {

    controller.storage.users.get(message.user, (err, user) => {

        if (!user) {
            user = {
                id: message.user,
				name: 'Someone'
            }
			
			bot.reply(message, 'I don\'t know your name yet.  Try telling me `call me <your-name>` or introduce yourself to me via `my name is <your-name>`. :smile:');
        }
				
		controller.storage.users.get('__feature_server__', (e, servers) => {
			if (!servers) {
				return;
			}
			
			var feature_id = message.match[1];
			if ( servers.list[feature_id] == user.name ) {
				
				if ( user.name == 'Someone' ) {
					bot.reply(message, 'Well.  *Someone* used it without telling me his / her name.  As you are also *Someone*, I\'ll free it. :smirk:');					
				} 
				
				servers.list[feature_id] = '';
			} 
			else if ( servers.list[feature_id] == '' ) {
				bot.reply(message, `The site was not recorded to be used by anyone... Did I miss anything? :thinking_face:`);
			} 
			else {
				bot.reply(message, `Feature ${feature_id} is being used by *${servers.list[feature_id]}*. Please ask if (s)he wants you to build on it.\nIf yes, please tell ${servers.list[feature_id]} to free it or you may _forcefully_ free it by \`Forcefully free feature ${feature_id}\``);
			}
							
			let literals = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
			
			feature_servers.feature_numbers.filter( i => servers.list[i] == '' ).map( i => {
				bot.api.reactions.add({ timestamp: message.ts, channel: message.channel, name: literals[i], }, (api_err) => { if (api_err) { console.log(api_err) } });
			});
			
			controller.storage.users.save(servers);
			
		});

        controller.storage.users.save(user);

    });
	
});



controller.hears(['help'], 'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message, "Calm down my friend. You can use `feature status` to have a quick glance on what servers are free. `feature full status` for a full one with names. `use faeture x` or `using feature x` for getting a feature site. `free feature x` and `feature x ...... free` to free a site.");
});


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


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Shutdown?', [
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

controller.on(['direct_message','mention','direct_mention'],function(bot,message) {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'robot_face',
  },function(err) {
    if (err) { console.log(err) }
    bot.reply(message,'I am a bot who takes care of the servers.');
  });
});

controller.storage.teams.all(function(err,teams) {

  if (err) {
    throw new Error(err);
  }

  // connect all teams with bots up to slack!
  for (var t  in teams) {
    if (teams[t].bot) {
      controller.spawn(teams[t]).startRTM(function(err, bot) {
        if (err) {
          console.log('Error connecting bot to Slack:',err);
        } else {
          trackBot(bot);
        }
      });
    }
  }

});
