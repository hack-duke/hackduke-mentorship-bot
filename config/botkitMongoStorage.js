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
        active: Boolean, // whether the mentor is currently mentoring or not
        available: Boolean, // whether the mentor is open to judging at the moment
        slack_id: String
    });
    
    var sessionSchema = new mongoose.Schema({
       mentor_id: String, 
       participant_id: String,
       Start_Time: {type: Date, default: Date.now}, 
       Ongoing: Boolean, // whether mentor-participant session is ongoing
       End_Time: Date,
       Rating: Number // post-session participant rating of session 
    });

    var Mentor = mongoose.model('Mentor', mentorSchema);
    var Session = mongoose.model('Session', sessionSchema); 

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
                Mentor.findOneAndUpdate({email: data.email}, data, {upsert:true}, function(err, result) {
                    cb(null, result);
                })
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
                        Mentor.update({email: result.email}, {available: setAvailability}, {upsert:true}, function(err, result) {
                            cb(null, result);
                        });
                    }
                });
            },
            // ends mentorship session by setting active to false
            endSession: function(slackId, cb) {
                Mentor.findOne({slack_id: slackId, active: true}, function(err, result) {
                    if(!result || err) {
                        cb('You don\'t have a mentorship session to end', null);
                    } else 
                        Mentor.update({email: result.email}, {active: false}, {upsert:true}, function(err, result) {
                            cb(null, result);
                         
                        })
                        Session.update({End_Time: Date.now}, {Ongoing: false}) 
                    }
                });
            },
            // starts a mentorship session by finding a mentor by matching skills and setting the active to true
            startSession: function(skill, cb) {
                // capitalizes the skill because they're store in the database capitalized (Python, Swift, etc.)
                var capitalized = skill.charAt(0).toUpperCase() + skill.substring(1).toLowerCase();
                Mentor.findOne({skills: capitalized, available: true, active: false}, function(err, result) {
                    if(!result || err) {
                        cb('No mentors available for that skill, please try again later', result);
                    } else {
                        var mentor = result;
                        Mentor.update({email: result.email}, {active: true}, {upsert:true}, function(err, result) {
                            cb(null, mentor);
                        })
                        var newSession = new Session({mentor_id: mentor['slack_id'], {Start_Time: Date.now})
                    }
                });
            }
        },
    };

    return storage;
};
