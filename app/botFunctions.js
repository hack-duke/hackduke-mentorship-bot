var requestManager = require('./apiRequestManager.js')
var decisionTree = require('./skillsDecisionTree.js')
var botkitMongoStorage = require('../config/botkitMongoStorage')({mongoUri: process.env.MONGOURI})

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
          slack_id: 'U0QMVCMM5'
        }
        botkitMongoStorage.mentors.save(data, function(err, result) {
          if(err || !result) {
            bot.reply(message, JSON.stringify(err));
          }
        });
      }
      bot.reply(message, 'Mentors updated!')
    });
  });

  // according to the skill/topic asked about, find a mentor, create a group, and invite all parties
  controller.hears('help (.*)', 'direct_message,direct_mention', function(bot,message) {
    var skills = ['frontend', 'mobile', 'backend', 'web', 'math'];
    var skill = message.match[1];
    // skill inputted must match one of the ones listed above, should move to database
    if(skills.indexOf(skill.trim().toLowerCase()) == -1) {
      return bot.reply(message, `Please select one of the following skills: ${skills.join(', ')}`);
    }
    var participantSlackId = message['user'];

    botkitMongoStorage.mentors.startSession(skill, participantSlackId, function(err, result) {
      if(err || !result) {
        return bot.reply(message, err);
      }
      var mentorSlackId = result['mentor_id'];

      // get the user's SlackName (guaranteed unique)
      requestManager.userNameFromID(participantSlackId, function(err, participantName) {
          if(err || !participantName) {
            return bot.reply(message, err);
          }
          requestManager.userNameFromID(mentorSlackId, function(err, mentorName) {
              if(err || !mentorName) {
                return bot.reply(message, err);
              }
              // TODO: replace mentor SlackID with name from MongoDB (or session object)
              // get rid of spaces and periods (not allowed in channel names)
              var fixedUserName = participantName.toLowerCase().replace(/[. ]/gi, '');
              var fixedMentorName = mentorName.toLowerCase().replace(/[. ]/gi, '');
              var groupName = fixedUserName + '-' + fixedMentorName; // see issue #6 for documentation
              requestManager.createGroup(groupName, function(err, body) {
                if(err || !body) {
                  return bot.reply(message, JSON.stringify(err));
                }
                // only reply with error if there's an error that's not name_taken
                // if name_taken, a group between the two users should've started before
                // and you can simply invite them to the group again if necessary

                if(!body['ok'] && body['error'] != 'name_taken') {
                  bot.reply(message, body['error']);
                }
                else {
                  // uppercase ids must be passed into inviteToGroup
                  requestManager.inviteToGroup(groupName, participantSlackId, mentorName, mentorSlackId,
                                               result['session_skill'], function(err, inviteResult) {
                    if(err || !inviteResult) {
                      return bot.reply(message, JSON.stringify(err));
                    }
                    if (!body['ok'] && body['error'] == 'name_taken') { // matched with previous mentor
                      return bot.reply(message, 'Looks like ' + mentorName + ' from before can help you out again!\n');
                    }
                    else { // matched with new mentor
                      return bot.reply(message, 'You\'ve been matched with a mentor!');
                    }
                  });
                }
              });
          });
      });
    });
  });

  controller.hears('end session','direct_message,direct_mention',function(bot,message) {
    botkitMongoStorage.mentors.endSession(message['user'], function(err, result) {
      if(err || !result) {
        return bot.reply(message, err);
      } else {
        return bot.reply(message,'Thanks for ending the session, you\'ve been placed back into the queue.');
      }
    });
  });

  decisionTree.setup(controller)

}
