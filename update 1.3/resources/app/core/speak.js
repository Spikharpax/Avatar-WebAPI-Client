const SimpleTTS = require("simpletts");
const TTS = new SimpleTTS();

let EEvent;
let Config;
let AvatarSocket;

function speak(tts, callback, voice, volume, speed) {

  if (!tts) {
      console.log('Speak error:', 'TTS manquant pour le speak');
      if (callback) callback();
      return;
  }

  tts = tts.replace(/[\n]/gi, "" ).replace(/[\r]/gi, "" );

	if (tts.indexOf('|') != -1)
	  tts = tts.split('|')[Math.floor(Math.random() * tts.split('|').length)];

  listenStop (() => {
    setTimeout(function(){
	    if (Config.speech.server_speak) {
		    return AvatarSocket.emit('server_speak', tts, callback);
      }
      let options = {text: tts};
      if (voice)
        options.voice = voice;
      else if (Config.voices.current && Config.voices.current.toLowerCase() != "par défaut")
        options.voice = Config.voices.current;

      if (volume)
        options.volume = volume;
      else if (Config.voices.volume)
        options.volume = Config.voices.volume.toString();

      if (speed)
        options.speed = speed;
      else if (Config.voices.speed)
        options.speed = Config.voices.speed.toString();

      TTS.read(options)
      .then(() => {
          setTimeout(function(){
            EEvent.start (() => {
              if (callback) return callback();
            });
          }, Config.speech.timeout);
      })
      .catch((err) => {
        EEvent.start(() => {
        	console.log('Speak error:', err);
          if (callback) return callback();
        });
      });
    }, Config.speech.timeout);
  });

}

let ChromeStopped;
function listenStop (callback) {
  ChromeStopped = EEvent.isListen();
  if (ChromeStopped) {
    EEvent.stop (callback);
  } else {
    callback();
  }
}


var SpeakManager = {
  'init': function() {
    welcomeInfo('magenta', 'Painting unicorns ...');
    Avatar.speak = speak;
    return SpeakManager;
  },
  'setOptions': function(ee, conf, socket){
    EEvent = ee;
    Config = conf;
    AvatarSocket = socket;
  },
  'setConfig': function(conf){
    Config = conf;
  }
}
exports.init = SpeakManager.init;
