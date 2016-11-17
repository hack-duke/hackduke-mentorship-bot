var mongoose = require('mongoose');
var botFunctions = require('../app/botFunctions.js')

module.exports = function(config) {

    if (!config || !config.mongoUri)
        throw new Error('Need to provide mongo address.');

    mongoose.Promise = global.Promise
    mongoose.connect(config.mongoUri)

    var mentorSchema = new mongoose.Schema({ 
      first_name: String, 
      last_name: String,
      email: String,
      skills: [String],
      available: Boolean, // whether the mentor is open to judging at the moment
      active: Boolean,
      slack_id: String
    });
    
    var queueSchema = new mongoose.Schema({
      participant_id: String,
      start_time: {type: Date, default: Date.now},
      session_skill: String,
    });
    
    var sessionSchema = new mongoose.Schema({
      mentor_id: String, 
      participant_id: String,
      start_time: {type: Date, default: Date.now}, 
      ongoing: Boolean, // whether mentor-participant session is ongoing
      end_time: Date,
      session_skill: String, 
      rating: Number // post-session participant rating of session 
    });

    var Mentor = mongoose.model('Mentor', mentorSchema);
    var Session = mongoose.model('Session', sessionSchema);
    var Queue = mongoose.model('Queue', queueSchema); 

    var unwrapFromList = function(cb) {
      return function(err, data) {
        if (err) return cb(err);
        cb(null, data);
      };
    };

    var storage = {
      mentors: {
        get: function(email, cb) {
          Mentor.findOne({email: email}, function(err, result) {
            cb(null, result);
          });
        },
        // saves mentor to database
        save: function(data, cb) {
          Mentor.findOneAndUpdate({email: data['email']}, data, {upsert:true}, function(err, result) {
              cb(null, result);
          });
        },
        all: function(cb) {
          Mentor.find({}, cb);
        },
        // sets availability of mentor
        setAvailability: function(slackId, availability, cb) {
          Mentor.findOne({slack_id: slackId}, function(err, mentor) {
            if(!mentor || err) {
              cb('You aren\'t a mentor', null);
            } else {
              Mentor.update({email: mentor['email']}, {available: availability}, {upsert:true}, function(err, result) {
                if(!result || err) {
                  return cb('Error updating mentor availability', null)
                }
                cb(null, mentor);
              });
            }
          });
        },
        // ends mentorship session by setting ongoing to false
        endSession: function(slackId, cb) {
          Session.findOne({mentor_id: slackId, ongoing: true}, function(err, result) {
              if(!result || err) {
                return cb('Could not find session to end!', null);
              } 
              Session.update({mentor_id: slackId, ongoing: true},{end_time: Date.now(), ongoing: false}, {upsert:false}, function(err, result) {
                cb(null, mentor);
              });
            });
        },

        updateQueue: function(mentor, cb) {
          Queue.find({}).sort({start_time: -1}).exec(function(err, entries) {
            if(!entries || err) {
              return cb('There are no participants in the queue.', null);
            }
            var hasFoundMatch = false
            for(var i = 0; i < entries.length; i++) {
              for(var j = 0; j < mentor.skills.length; j++) {
                if(entries[i].session_skill === mentor.skills[j] && !hasFoundMatch) {
                  hasFoundMatch = true
                  var skill = entries[i].session_skill
                  var participant_id = entries[i].participant_id
                  Queue.remove({ _id : entries[i]._id }, function(err, result){
                    if(err || !result) {
                      return cb('Failed to remove person from queue', null)
                    }
                    botFunctions.startSession(skill, participant_id, function(msg) {
                      return cb(null, msg)
                    })
                  })
                }
              }
            }
            if(!hasFoundMatch) {
              cb(null, entries)
            }
          })
        }, 

        dequeue: function(participantslackId, cb) {
          Queue.find({}).sort({start_time: -1}).exec(function(err, entries) {
            var inQueue = false
            for(var i = 0; i < entries.length; i++) {
              if(entries[i].participant_id === participantslackId) {
                inQueue = true
                Queue.remove({ _id : entries[i]._id}, function(err, callback){
                  if(err) {
                    return cb('Error when removing person from queue', null)
                  }
                  return cb(null, 'You\'ve been removed from the queue!')
                })
              }
            }
            if(!inQueue) {
              return cb(null, 'You aren\'t in the queue!')
            }
          })
        },

        // starts a mentorship session by finding a mentor by matching skills and setting the active to true
        startSession: function(skill, participantslackId, cb) {
          //check if the participant is in the queue or slack id 
          var inQueue = false
          Queue.find({}).sort({start_time: -1}).exec(function(err, entries) {
            for(var i = 0; i < entries.length; i++) {
              console.log(entries[i].participant_id)
              console.log(participantslackId)
              if(entries[i].participant_id == participantslackId) {
                inQueue = true
              }
            }
            if(!inQueue) {
              // capitalizes the skill because they're store in the database capitalized (Python, Swift, etc.)
              var capitalized = skill.charAt(0).toUpperCase() + skill.substring(1).toLowerCase();
              Mentor.findOneAndUpdate({skills: capitalized, active: false, available: true}, {active: true}, {upsert:false}, function(err, mentor) {
                if(!mentor || err) {
                  var queuedParticipant = new Queue({participant_id: participantslackId, start_time: Date.now(), session_skill: capitalized});
                  queuedParticipant.save(function(err, queuedParticipant) {
                    if(!queuedParticipant || err) {
                      return cb('Error when saving queued participant', null)
                    }
                    return cb('No mentors available for that skill, you\'ve been added to the queue!', null);
                  });
                } else {
                  Session.findOne({mentor_id: mentor['slack_id'], ongoing: true}, function(err, session) {
                     if(session) {
                       return cb('A session with this mentor is already ongoing', null);
                     } 
                     if (err) {
                       cb('Error finding mentor', null) 
                     }
                     else {
                        var newSession = new Session({mentor_id: mentor['slack_id'], participant_id: participantslackId, 
                                                      start_time: Date.now(), ongoing: true, session_skill: capitalized})                   
                        newSession.save(function(err, newSession) {
                          if(!newSession || err) {
                            cb('Error saving session', null)
                          }
                          cb(null, newSession)
                        });
                     }
                  });
                }
              });
            } else {
              return cb("You\'re already in our queue. If you would like to remove yourself from the queue, please type 'dequeue'.", null)
            }
          })
        }

      } 
    };

    return storage
};
