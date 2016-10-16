var requestManager = require('./apiRequestManager.js')
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
    botkitMongoStorage.mentors.startSession(skill, function(err, result) {
      if(err || !result) {
        return bot.reply(message, err);
      }
      var mentorSlackId = result['slack_id'];
      var participantSlackId = message['user'];

      // group name is currently lowercase mentor id, dash, and lowercase participant id
      var groupName = mentorSlackId.toLowerCase() + '-' + participantSlackId.toLowerCase();
      requestManager.createGroup(groupName, function(err, body) {
        if(err || !result) {
          return bot.reply(message, JSON.stringify(err));
        } 
        // only reply with error if there's an error that's not name_taken
        // if name_taken, a group between the two users should've started before
        // and you can simply invite them to the group again if necessary
        if(!body['ok'] && body['error'] != 'name_taken') {
          bot.reply(message, body['error']);
        } else {
          // uppercase ids must be passed into inviteToGroup
          requestManager.inviteToGroup(groupName, participantSlackId, mentorSlackId, function(err, result) {
            if(err || !result) {
              return bot.reply(message, JSON.stringify(err));
            }
            return bot.reply(message, 'Mentor assigned');
          });
        } 
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

  controller.on('direct_message,mention,direct_mention',function(bot,message) {
    bot.api.reactions.add({
      timestamp: message.ts,
      channel: message.channel,
      name: 'robot_face',
    },function(err) {
      if (err) { console.log(err) }
      bot.reply(message,'I heard you loud and clear boss.');
    });
  });

}
