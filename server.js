// modules =================================================
var express        = require('express');
var app            = express();
var bodyParser     = require('body-parser');
var http           = require('http').Server(app);
var dotenv         = require('dotenv');

// configuration ===========================================

//load environment variables,
//either from .env files (development),
//heroku environment in production, etc...
dotenv.load();

// public folder for images, css,...
app.use(express.static(__dirname + '/public'))

//parsing
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

// view engine ejs
app.set('view engine', 'ejs');

// routes
require('./app/routes/routes')(app);

//port for Heroku
app.set('port', (process.env.PORT));

//botkit (apres port)
require('./app/controllers/botkit')

//START ===================================================
http.listen(app.get('port'), function(){
  console.log('listening on port ' + app.get('port'));
});

// connects the HackDuke Team using a variety of tokens and IDs
var slack = require('./app/controllers/botkit')

var team = {
  id: process.env.TEAMID,
  bot:{
    token: process.env.BOTTOKEN,
    user_id: process.env.BOTID,
    createdBy: process.env.CREATEDBYUSER
  },
  createdBy: process.env.CREATEDBYUSER,
  url: process.env.SLACKURL,
  name: 'HackDuke'
}

slack.connect(team)
