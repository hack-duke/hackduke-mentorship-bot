var mongoose = require('mongoose');

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


    var sessionSchema = new mongoose.Schema({
       mentor_id: String,
       participant_id: String,
       start_time: {type: Date, default: Date.now},
       ongoing: Boolean, // whether mentor-participant session is ongoing
       end_time: Date,
       session_skill: String,
       rating: Number // post-session participant rating of session
    });


    var queueSchema = new mongoose.Schema({
       participant_id: String,
       start_time: {type: Date, default: Date.now},
       session_skill: String,
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
                Mentor.findOne({slack_id: slackId}, function(err, result) {
                    if(!result || err) {
                        cb('You aren\'t a mentor', null);
                    } else {
                        Mentor.update({email: result['email']}, {available: setAvailability}, {upsert:true}, function(err, result) {
                            cb(null, result);
                        });
                    }
                });
            },
            // ends mentorship session by setting ongoing to false
            endSession: function(slackId, cb) {
                Mentor.findOneAndUpdate({slack_id: slackId, active: true}, {active: false}, {upsert: false}, function(err, result) {
                    if(!result || err) {
                        return cb('You cannot end this session!', null);
                    }
                    Session.findOne({mentor_id: slackId, ongoing: true}, function(err, result) {
                        if(!result || err) {
                            return cb('Could not find session to end!', null);
                        }
                        Session.update({mentor_id: slackId, ongoing: true},{end_time: Date.now(), ongoing: false}, {upsert:false}, function(err, result) {
                                cb(null, result);
                        });
                    });
                });
            },

            // starts a mentorship session by finding a mentor by matching skills and setting the active to true
            startSession: function(skill, participantslackId, cb) {
                // capitalizes the skill because they're store in the database capitalized (Python, Swift, etc.)
                var capitalized = skill.charAt(0).toUpperCase() + skill.substring(1).toLowerCase();
                Mentor.findOneAndUpdate({skills: capitalized, active: false}, {active: true}, {upsert:false}, function(err, mentor) {
                    if(!mentor || err) {
                      return cb('No mentors exist for that skill, please try again later', null);
                    } else if(!mentor['available']) {
                      var queuedParticipant = new Queue({participant_id: participantslackId, start_time: Date.now(), session_skill: capitalized});
                      queuedParticipant.save(function(err, queuedParticipant)) {
                        if(!newSession || err) {
                          cb(err, null)
                        }
                        cb(null, newSession)
                      }
                      return cb('No mentors are currently available for that skill, but we will assign one to you as soon as one is available!', null);
                    } else {
                        Session.findOne({mentor_id: mentor['slack_id'], ongoing: true}, function(err, session) {
                           if(session) {
                             return cb('A session with this mentor is already ongoing', null);
                           }
                           if (err) {
                             cb('We have encountered an error', null)
                           }
                           else {
                              var newSession = new Session({mentor_id: mentor['slack_id'], participant_id: participantslackId,
                                                            start_time: Date.now(), ongoing: true, session_skill: capitalized})
                              newSession.save(function(err, newSession) {
                                  if(!newSession || err) {
                                    cb(err, null)
                                  }
                                  cb(null, newSession)
                              });
                           }
                        });
                    }
                });
              }
            }
        };

    return storage
};
