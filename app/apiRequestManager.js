var Request          = require('request')

var api_url = 'https://hackduke-api.herokuapp.com/'
var slack_url = 'https://slack.com/api'

// gets mentors from registration API
exports.getMentors = function(cb) {
  var endpoint = api_url + 'people/roles'
  var postData = {
    event_type: 'design_con',
    season: 'spring',
    year: 2016,
    role: 'mentor'
  }
  var options = {
    method: 'post',
    body: postData,
    json: true,
    url: endpoint,
    auth: {
      username: process.env.USERNAME,
      password: process.env.PASSWORD
    }
  }
  Request(options, function (err, res, body) {
    if (err || !res) {
      return cb(err, null);
    }
    cb(null, body);
  })
}

// creates private SLACK group given group name
exports.createGroup = function(name, cb) {
  var endpoint = slack_url + `/groups.create?token=${process.env.HACKDUKETOKEN}&name=${name}&pretty=1`
  var options = {
    method: 'get',
    url: endpoint,
  }
  Request(options, function (err, res, body) {
    if (err) {
      return cb(err, null);
    }
    cb(null, JSON.parse(body));
  })
}

// invites the participant, mentor, and bot to the group with the specified name
exports.inviteToGroup = function(groupName, participantSlackId, mentor, cb) {
  groupIdFromName(groupName, function(err, id) {
    if(err || !id) {
      return cb(err, null);
    }
    var endpoint = slack_url + `/groups.invite?token=${process.env.HACKDUKETOKEN}&channel=${id}`
    // invite all three parties to the channel
    var mentorSlackId = mentor['slack_id'];
    invite(endpoint, participantSlackId, function(err, result){
      invite(endpoint, mentorSlackId, function(err, result){
        invite(endpoint, process.env.BOTID, function(err, result){
          if(err || !result) {
            return cb(err, null);
          }
          var mentorFirstName = mentor['first_name'];
          var mentorLastName = mentor['last_name'];
          var mentorName = mentorFirstName + ' ' + mentorLastName;
          var mentorSkills = mentor['skills'].join(', ');
          userNameFromID(participantSlackId, function(err, participantName) {
              if(err || !participantName) {
                return cb(err, null);
              }
              messageGroup(id, '<!channel> Hey ' + participantName + ', meet ' +
              mentorName + '!\n' + mentorName + ' has experience using ' +
              mentorSkills);
              messageGroup(id, 'This session is to help ' + participantName +
              ' with a specific problem- once you\'re done, let me know to end session by typing "@mentorbot end session!""',
              function(err, result) {
               if(err || !result) {
                 return cb(err, null);
               }
               cb(null, result);
             });
          })
        });
      });
    });
  });
}

var messageGroup = exports.messageGroup = function(id, text, cb) {
  var postMessageUrl = slack_url + `/chat.postMessage?token=${process.env.HACKDUKETOKEN}`
  var endpoint = postMessageUrl + `&channel=${id}&text=${text}&username=mentorbot`
  var options = {
    method: 'get',
    url: endpoint,
  }
  Request(options, function (err, res, body) {
    if (err) {
      return cb(err, null);
    }
    cb(null, JSON.parse(body));
  })
}

// invites the specified userId, requires the groups.invite API URL and the token
var invite = exports.invite = function(currEndpoint, userId, cb) {
  var endpoint = currEndpoint + `&user=${userId}&pretty=1`
  var options = {
    method: 'get',
    url: endpoint,
  }
  Request(options, function (err, res, body) {
    if (err || !res) {
      return cb(err, null);
    }
    cb(null, body)
  });
}

// finds the groupId from the name of a group
var groupIdFromName = exports.groupIdFromName = function(name, cb) {
  var endpoint = slack_url + `/groups.list?token=${process.env.HACKDUKETOKEN}&name=${name}&pretty=1`
  var options = {
    method: 'get',
    url: endpoint,
  }
  Request(options, function (err, res, body) {
    if (err || !res) {
      return cb(err, null);
    }
    var parsedBody = JSON.parse(body);
    if(!parsedBody['ok']) {
      return cb(parsedBody['error'], null);
    }
    var groups = parsedBody['groups'];
    // loop through groups until name matches
    for(var i = 0; i < groups.length; i++) {
      var group = groups[i];
      if(name == group['name']) {
        return cb(null, group['id'])
      }
    }
    cb('Group with that name not found', null);
  })
}

// retrieves a user friendly name from a Slack ID
var userNameFromID = exports.userNameFromID = function(id, cb) {
  var endpoint = slack_url + `/users.list?token=${process.env.HACKDUKETOKEN}&pretty=1`
  var options = {
    method: 'get',
    url: endpoint,
  }
  Request(options, function (err, res, body) {
    if (err || !res) {
      return cb(err, null);
    }
    var parsedBody = JSON.parse(body);
    if(!parsedBody['ok']) {
      return cb(parsedBody['error'], null);
    }
    var members = parsedBody['members'];
    // loop through groups until name matches
    for(var i = 0; i < members.length; i++) {
      var member = members[i];
      if(id == member['id']) {
        return cb(null, member['name'])
      }
    }
    cb('Member with ID ' + id + ' not found', null);
  })
}
