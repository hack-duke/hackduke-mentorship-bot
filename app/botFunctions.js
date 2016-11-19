var requestManager = require('./apiRequestManager.js')
var decisionTree = require('./skillsDecisionTree.js')
var botkitMongoStorage = require('../config/botkitMongoStorage')({mongoUri: process.env.MONGOURI})

var startSession = exports.startSession = function(skill, participantSlackId, cb) {
 botkitMongoStorage.mentors.startSession(skill, participantSlackId, function(err, result) {
    if(err || !result) {
      return cb(err)
    }
    var mentorSlackId = result['mentor_id'];

    // get the user's SlackName (guaranteed unique)
    requestManager.userNameFromID(participantSlackId, function(err, participantName) {
      if(err || !participantName) {
        return cb('Error when finding username from ID')
      }
      requestManager.userNameFromID(mentorSlackId, function(err, mentorName) {
        if(err || !mentorName) {
          return cb('Error when find username from ID')
        }
        // TODO: replace mentor SlackID with name from MongoDB (or session object)
        // get rid of spaces and periods (not allowed in channel names)
        var fixedUserName = participantName.toLowerCase().replace(/[. ]/gi, '');
        var fixedMentorName = mentorName.toLowerCase().replace(/[. ]/gi, '');
        var groupName = fixedUserName.substring(0, Math.min(10, fixedUserName.length)) + '-' + fixedMentorName.substring(0, Math.min(10, fixedUserName.length));
        // see issue #6 for documentation - max slack channel length is 21
        requestManager.createGroup(groupName, function(err, body) {
          if(err || !body) {
            return cb('Error when creating group')
          }
          // only reply with error if there's an error that's not name_taken
          // if name_taken, a group between the two users should've started before
          // and you can simply invite them to the group again if necessary

          if(!body['ok'] && body['error'] != 'name_taken') {
            return cb('Slack error when creating group')
          }
          else {
            // uppercase ids must be passed into inviteToGroup
            requestManager.inviteToGroup(groupName, participantSlackId, mentorName, mentorSlackId,
                                         result['session_skill'], function(err, inviteResult) {
              if(err || !inviteResult) {
                return cb('Error when inviting people to group')
              }
              if (!body['ok'] && body['error'] == 'name_taken') { // matched with previous mentor
                return cb('Looks like ' + mentorName + ' from before can help you out again!\n')
              }
              else { // matched with new mentor
                return cb('You\'ve been matched with a mentor!')
              }
            });
          }
        });
      });
    });
  });
}

exports.setUpDialog = function(controller) {

  // pulls mentors from registration API and updates them on the database
  controller.hears('update mentors','direct_message,direct_mention',function(bot,message) {
    requestManager.getMentors(function(err, body) {
      for(var i = 0; i < body.length; i++){
        var mentor = body[i];
        // arrange data to be placed in Mentor schema
        data = {
          first_name: mentor['person']['first_name'],
          last_name: mentor['person']['last_name'],
          email: mentor['person']['email'],
          skills: mentor['role']['skills'],
          active: false,
          available: true,
          slack_id: null
        }
        botkitMongoStorage.mentors.save(data, function(err, result) {
          if(err) {
            bot.reply(message, JSON.stringify(err));
          }
        });
      }
      bot.reply(message, 'Mentors updated!')
    });
  });

  // sets mentor to be away
  controller.hears('away', 'direct_message,direct_mention', function(bot,message) {
    botkitMongoStorage.mentors.setAvailability(message['user'], false, function(err, mentor) {
      if(err || !mentor) {
        bot.reply(message, err)
      } else {
        bot.reply(message, "You\'ve been set to away! Type 'available' to help out more hackers!")
      }
    })
  });

  // sets mentor to be available
  controller.hears('available', 'direct_message,direct_mention', function(bot,message) {
    botkitMongoStorage.mentors.setAvailability(message['user'], true, function(err, mentor) {
      if(err || !mentor) {
        bot.reply(message, err)
      } else {
        bot.reply(message, 'You\'ve been set to available! Please wait until another hacker needs your help!')
        botkitMongoStorage.mentors.updateQueue(mentor, function(err, result) {
          if(err || !result) {
            bot.reply(message, 'Error updating queue')
          }
        })
      }
    })
  });

  controller.hears('dequeue', 'direct_message,direct_mention', function(bot, message) {
    botkitMongoStorage.mentors.dequeue(message['user'], function(err, msg) {
      if(err || !msg) {
        return bot.reply(message, 'Error dequeing')
      }
      bot.reply(message, msg)
    })
  })

  // according to the skill/topic asked about, find a mentor, create a group, and invite all parties
  controller.hears('help (.*)', 'direct_message,direct_mention', function(bot,message) {
    var skills = ['inequality', 'health', 'wellness', 'energy', 'environment', 'education', 'ios', 'android', 'wearable',
                  'virtual', 'augmented', 'reality', 'microcontroller', 'data', 'science', 'nosql', 'sql', 'c#', 'ruby',
                  'php', 'python', 'javascript', 'java', 'firebase', 'javascript', 'html', 'css', 'react', 'angular', 'esri',
                  'lifelock', 'facebook', 'coinbase', 'zoho', 'cerner', 'optum', 'appian', 'microsoft', 'twitter', 'google',
                  'qualtrics', 'innovation', 'co-lab', 'start']
    var skill = message.match[1];
    // skill inputted must match one of the ones listed above, should move to database
    if(skills.indexOf(skill.trim().toLowerCase()) == -1) {
      return bot.reply(message, 'We couldn\'t find that option, please try again!');
    }
    var participantSlackId = message['user'];

    var lowercase = skill.trim().toLowerCase()

    // special cases to improve UX
    if(lowercase == 'health' || lowercase == 'wellness') {
      skill = 'Health & Wellness'
    } else if(lowercase == 'energy' || lowercase == 'environment') {
      skill = 'Energy & Environment'
    } else if(lowercase == 'virtual' || lowercase == 'augmented' || lowercase == 'reality') {
      skill = 'Virtual/Augmented Reality'
    } else if(lowercase == 'data' || lowercase == 'science') {
      skill = 'Data Science'
    } else if(lowercase == 'html' || lowercase == 'css') {
      skill = 'Web Frontend (HTML/Javascript/CSS)'
    } else if(lowercase == 'innovation' || lowercase == 'co-lab') {
      skill = 'Innovation Co-Lab'
    } else if(lowercase == 'ios') {
      skill = 'iOS'
    } else if(lowercase == 'php') {
      skill = 'PHP'
    } else if(lowercase == 'sql') {
      skill = 'SQL'
    } else if(lowercase == 'nosql') {
      skill = 'NoSQL'
    } else if (lowercase == 'start') {
      skill = 'start'
    } else if(lowercase == 'wearable') {
      skill = 'Wearables'
    } else if(lowercase == 'microcontroller') {
      skill = 'Microcontrollers'
    } else if(lowercase == 'lifelock') {
      skill = 'LifeLock'
    } else {
      skill = lowercase.charAt(0).toUpperCase() + lowercase.substring(1).toLowerCase();
    }

    startSession(skill, participantSlackId, function(msg) {
      bot.reply(message, msg)
    })
  });

  controller.hears('end session','direct_message,direct_mention',function(bot,message) {
    botkitMongoStorage.mentors.endSession(message['user'], function(err, mentor, name, byMentor) {
      if(err || !mentor) {
        return bot.reply(message, err);
      } else {
        if(byMentor) {
          bot.reply(message,'Thanks for ending the session! Please wait until another hacker needs your help.')
        } else {
          bot.reply(message,'Thanks for ending the session! Feel free to pair up with another mentor whenever you need help.')
        }
        requestManager.groupIdFromName(name, function(err, groupid) {
          if (err || !groupid) {
            return;
          }
          else {
            requestManager.messageGroup(groupid,'This session is now closed. Happy hacking!', function(err, result) {
              if (err || !result) {
                return;
              }
            });
            botkitMongoStorage.mentors.updateQueue(mentor, function(err, result) {
              if(err || !result) {
                bot.reply(message, 'Error updating queue')
              }
            })
          }
        });
      }
    });
  });

  controller.hears('thank', 'direct_message,direct_mention', function(bot, message) {
    bot.reply(message,{
      text: "No problem! Just let me know if I can help again.",
      username: "mentorbot",
      icon_emoji: ":robot_face:",
    });
  })

  decisionTree.setup(controller)

}
