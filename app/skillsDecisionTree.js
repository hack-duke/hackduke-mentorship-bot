var requestManager = require('./apiRequestManager.js')

exports.setup = function(controller) {

  controller.hears('mobile|web|hardware|track|company|companies', 'direct_message,direct_mention', function(bot, message) {
    companyText = 'Which of these companies do you need help with: Google, Facebook, or Esri?'
    hardwareText = 'Would you like help with wearables, virtual/augmented reality, or microcontrollers?'
    webText = 'Would you like help with the frontend, the backend, or would you just like help getting started?'
    trackText = 'Which track are you working on: inequality, health and wellness, energy and environment, or education?'
    mobileText = 'Would you like help with iOS or Android development?'
    switch(message.match[0]) {
      case 'hardware':
        return bot.reply(message, hardwareText)
      case 'web':
        return bot.reply(message, webText)
      case 'track':
        return bot.reply(message, trackText)
      case 'company':
        return bot.reply(message, companyText)
      case 'companies':
        return bot.reply(message, companyText)
      case 'mobile':
        return bot.reply(message, mobileText)
    }
  });

  controller.hears('backend', 'direct_message,direction_mention', function(bot,message) {
    return bot.reply(message, 'Which of the following is most relevant to your question: Firebase, Java, Node.js, Python, PHP, Ruby, C#, SQL, NoSQL (e.g. mongoDB)')
  });

  controller.hears('frontend', 'direct_message,direction_mention', function(bot,message) {
    return bot.reply(message, 'Would you like help with React, Angular, or Javascript in general?')
  });

  controller.hears('ios|android|start|react|angular|firebase|javascript|java|node|python|php|ruby|c#|inequality|health|wellness|energy|environment|education|machine learning|shell|functional|sql|nosql|data',
                   'direct_message,direct_mention', function(bot, message) {
    return bot.reply(message, "Please type 'help " + message.match[0] + "' to confirm your choice and get a mentor!")
  });

  controller.on('direct_message,direct_mention', function(bot,message) {
    requestManager.userNameFromID(message['user'], function(err, result) {
      if(err || !result) {
        return bot.reply(message, err);
      }
      var toSay = 'Hi ' + result + ', if you\'re a participant, enter \'help\'. If you\'re a mentor, you can end your session by typing \'end session\'.';
      return bot.reply(message, toSay);
    });
  });

}
