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
              cb('You aren\'t a mentor!', null);
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
          Session.findOne({mentor_id: slackId, ongoing: true}, function(err, mentor_session) {
              if(!mentor_session || err) {
                // can't find session with slackId as mentor, so try finding with slackId as participant
                Session.findOne({participant_id: slackId, ongoing: true}, function(err, participant_session) {
                    if(!participant_session || err) {
                      // can't find slackId as mentor or participant in active session
                      return cb('You\'re not in an active session!', null);
                    }
                    // updating and ending session object
                    Session.update({participant_id: slackId, ongoing: true},{end_time: Date.now(), ongoing: false}, {upsert:false}, function(err, update) {
                      storage.mentors.updateMentorFromEndedSession(participant_session, update, err, function(err, result) {
                        return cb(err, result, false)
                      })
                    });
                })
              } else {
                Session.update({mentor_id: slackId, ongoing: true},{end_time: Date.now(), ongoing: false}, {upsert:false}, function(err, update) {
                  storage.mentors.updateMentorFromEndedSession(mentor_session, update, err, function(err, result) {
                    return cb(err, result, true)
                  })
                });
              }
            });
        },

        updateMentorFromEndedSession: function(session, update, err, cb) {
          console.log(session)
          if(!update || err) {
            return cb('Error updating session status', null)
          }
          // finding mentor that was just just had his/her session ended
          Mentor.findOne({slack_id: session.mentor_id}, function(err, mentor) {
            if(!mentor || err) {
              return cb('Error finding mentor from session', null)
            }
            // setting that mentor to be active
            Mentor.update({slack_id: session.mentor_id}, {active: false}, function(err, updated) {
              if(!update || err) {
                return cb('Error setting mentor active to false')
              }
              return cb(null, mentor)
            })
          })
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
          var inProgress = false
          Queue.find({}).sort({start_time: -1}).exec(function(err, entries) {
            Session.find({ongoing: "true"}).exec(function(err, sessions) {
              // check queue entries
              for(var i = 0; i < entries.length; i++) {
                if(entries[i].participant_id == participantslackId) {
                  inQueue = true
                }
              }
              // check sessions
              for(var i = 0; i < sessions.length; i++) {
                if(sessions[i].participant_id == participantslackId) {
                  inProgress = true
                }
              }
              if(!inProgress && !inQueue) {
                Mentor.find({skills: skill, active: false, available: true}).exec(function(err, mentors) {
                  var array_of_mentors = mentors
                  var random = array_of_mentors[Math.floor(Math.random()*array_of_mentors.length)];
                  Mentor.findOneAndUpdate({_id: random._id}, {active: true}, {upsert:false}, function(err, mentor) {
                    if(!mentor || err) {
                      var queuedParticipant = new Queue({participant_id: participantslackId, start_time: Date.now(), session_skill: skill});
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
                                                          start_time: Date.now(), ongoing: true, session_skill: skill})                   
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

                })



              } else {
                if(inQueue) {
                  return cb("You\'re already in our queue. If you would like to remove yourself from the queue, please type 'dequeue'.", null)
                } else if(inProgress) {
                  return cb("You\'re already in a session with someone. Please end that session by typing 'end session' before trying to find another mentor!", null)
                }
              }
            });
          });
        }
      } 
    };

    return storage
};
