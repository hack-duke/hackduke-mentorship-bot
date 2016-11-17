var requestManager = require('./apiRequestManager.js')

exports.setup = function(controller) {

  controller.hears('mobile|web|hardware|track|company|companies', 'direct_message,direct_mention', function(bot, message) {
    companyText = 'Which of these companies do you need help with: Esri, LifeLock, Facebook, Coinbase, Zoho, Cerner, Optum, Appian, Microsoft, Twitter, Google, Qualtrics, Innovation Co-lab?'
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
    return bot.reply(message, 'Which of the following is most relevant to your question: Firebase, Java, Javascript, Python, PHP, Ruby, C#, SQL, NoSQL (e.g. mongoDB)')
  });

  controller.hears('frontend', 'direct_message,direction_mention', function(bot,message) {
    return bot.reply(message, 'Would you like help with React, Angular, or HTML/CSS in general?')
  });

  controller.hears('inequality|health|wellness|energy|environment|education|ios|android|wearable|virtual|augmented|reality|microcontroller|data|science|nosql|sql|c#|ruby|php|python|javascript|java|firebase|javascript|html|css|react|angular|esri|lifelock|facebook|coinbase|zoho|cerner|optum|appian|microsoft|twitter|google|qualtrics|innovation|co-lab|start',
                   'direct_message,direct_mention', function(bot, message) {
    return bot.reply(message, "Please type 'help " + message.match[0] + "' to confirm your choice and get a mentor!")
  });

  controller.hears('help', 'direct_message,direction_mention', function(bot, message) {
    bot.reply(message, '\n _General Commands_ \n *end session* - ends the current mentorship session \n _Hacker Commands_ \n *dequeue* - remove your current request from the queue so you can request a different mentor \n *mobile*, *web*, *hardware*, *track knowledge*, *data science*, or *company* for more info about any of these categories \n _Mentor Commands_ \n *away* - set your state to away so you cannot be paired with a hacker \n *available* - sets your state to available so you can be paired with a hacker' )
  });

  controller.on('direct_message,direct_mention', function(bot,message) {
    requestManager.userNameFromID(message['user'], function(err, result) {
      if(err || !result) {
        return bot.reply(message, err);
      }
      return bot.reply(message, "Hi " + result + ", what would you like help with: mobile, web, hardware, track knowledge, data science, or a company\'s technology? \n If you\'re having trouble with commands as a mentor or hacker, just type 'help'!");
    });
  });

}
