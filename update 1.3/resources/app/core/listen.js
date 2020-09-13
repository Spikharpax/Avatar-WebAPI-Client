const cron = require('cron').CronJob;
const _ = require('underscore');
const clj_fuzzy = require('./lib/clj-fuzzy');
const soundex   = require('./lib/soundex/soundex.js').soundex;
const fs = require('fs-extra');
const path = require('path');
const {remote, ipcRenderer} = require('electron');
const {BrowserWindow, shell} = remote;
const https = require('https');
const express = require('express');
const helmet = require('helmet');
const {exec} = require("child_process");

let sse;
let job;
let is_listen;
let is_silence;
let is_askme = {active: false, options: null};
let is_AKA_action;
let AKAStopped;
let ChromeStopped;
// multi actions
let actions = [];

function Navigator (callback) {
	const opn = require('opn');
	opn('Avatar', {wait: true, app: ['chrome', '--app=https://'+Config.chrome.address+':'+Config.chrome.port]})
	if (callback) callback();
}


function HTTPSServer (callback) {

	var ServerChrome = express();
	ServerChrome.use(helmet()); // Helmet helps to secure Express apps by setting various HTTP headers.

	ServerChrome.use(express.static(__dirname  + '/chrome'));
  const SSE = require('sse-emitter');
	sse = new SSE({
	  keepAlive: 115000
	});

	ServerChrome.get('/AvatarClient', sse.bind());

	ServerChrome.post('/AvatarIntercom', function(req, res){
			uploadFile(req, res);
	})

	ServerChrome.post('/AvatarServer', function(req, res){
		res.status(200).end();
		if (req.query.AKA) 	AKA();
		if (req.query.action) actionFromChrome(req.query.action, req.query.threashold);
		if (req.query.listen) listenFromChrome(req.query.listen, req.query.threashold);
		if (req.query.config) {
			req.query.config = JSON.parse(req.query.config);
			configFromChrome(req.query.config);
		}
		if (req.query.init) {
			initFromChrome(Config.chrome.port, req.query.chrome);
			if (Config.chrome.full_screen) setWindowFullScreen(req.query.init);
		}
		if (req.query.normalScreen) setWindowNormalScreen(req.query.normalScreen);
		if (req.query.close) closeFromChrome(req.query.close);
		if (req.query.getVoices) {
      getVoices(2, (voices) => {
        sse.emit('/AvatarClient', {command: "voices", voices: voices});
      });
    }
		if (req.query.testVoice)  testVoice(req.query.speech, req.query.testVoice, req.query.speed, req.query.volume);
		if (req.query.help) {
      let Documentation = require('./documentation.js').init(Config);
      Documentation.setStaticPath(path.normalize (__dirname + '/../../../documentation'), () => {
          shell.openExternal('http://localhost:'+Config.http.documentation.port+'/Introduction.html');
      });
    }
	});

	https.createServer({
		key: fs.readFileSync(__dirname + '/certificats/'+Config.chrome.key),
		cert: fs.readFileSync(__dirname + '/certificats/'+Config.chrome.cert)
	}, ServerChrome).listen(Config.chrome.port);

  if (callback) callback();

}


function isChromeStopped () {
  return ChromeStopped;
}

function stopChromeListen (next) {

			if (ChromeStopped) {
				if (next) next();
				return;
			}

			sse.emit('/AvatarClient', {command: "stop"});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);

			ChromeStopped = true;
}

function startChromeListen (next) {

			if (!ChromeStopped) {
				if (next) next();
				return;
			}
			sse.emit('/AvatarClient', {command: "start"});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);

			ChromeStopped = false;
}


function stopChromeAKA (next) {

			if (AKAStopped) {
				if (next) next();
				return;
			}

			sse.emit('/AvatarClient', {command: "stopAKA"});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);

			AKAStopped = true;
}


function startChromeAKA (next) {

			if (!AKAStopped) {
				if (next) next();
				return;
			}

			sse.emit('/AvatarClient', {command: "startAKA"});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);

			AKAStopped = false;
}

function initChrome (next) {
    setTimeout(function(){
      sse.emit('/AvatarClient', {command: "init", config: Config});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);
    }, Config.chrome.timeout_ready);
}

function intercomChrome (to, next) {
			const {join} = require("path");
			const dir = join(__dirname, "transfert");
			fs.ensureDirSync(dir);
			let file = join(dir, "intercom.wav");
			fs.removeSync(file);

			stopChromeListen(() => {
				sse.emit('/AvatarClient', {command: "intercom", to: to});

				intercomClient = to;
				setTimeout(() => {
					if (next) next();
				},Config.chrome.timeout_emit);
			});
}

function logChrome (type, msg, next) {
			sse.emit('/AvatarClient', {command: "log", type: type, msg: msg});
			setTimeout(() => {
				if (next) next();
			},Config.chrome.timeout_emit);
}

function quitChrome (flag) {
		sse.emit('/AvatarClient', {command: "quit", flag: flag});
}


function setWindowFullScreen (name) {
  const {join} = require("path");
	const nircmd = join(__dirname, "lib", "nircmd", "nircmd");
	setTimeout(()=> {
		exec(nircmd +' win activate ititle "'+name+'"', (err, _stdout, stderr) => {
			if (err == null)
				exec(nircmd +' win activate ititle "'+name+'"', (err, _stdout, stderr) => {
					if (err == null)
						exec(nircmd +' sendkeypress F11', (err, _stdout, stderr) => {
							if (err)
									console.log("Unable to resize Chrome windows");
						})
				})
		})
	}, 2000)
}


function setWindowNormalScreen (name) {
  const {join} = require("path");
	const nircmd = join(__dirname, "lib", "nircmd", "nircmd");
	exec(nircmd +' win activate ititle "'+name+'"', (err, _stdout, stderr) => {
		if (err == null)
			exec(nircmd +' sendkeypress F11', (err, _stdout, stderr) => {
				if (err)
						console.log("Unable to resize Chrome windows");
			})
	})
}

var init = exports.init = function () {
    welcomeInfo('orange', 'Starting and connecting Web browser, please wait...');
    Navigator(() => {
      HTTPSServer(() => {
          Avatar.SpeakManager.setOptions({stop: stopChromeListen, start: startChromeListen, isListen: isChromeStopped}, Config, socket);
      });
    });
}


function testVoice (speech, voice, speed, volume) {
  if (voice == 'Par défaut') voice = null;

  Avatar.speak(speech, () => {
    stopListen(true);
  }, voice, volume, speed);
}


function changeVoice(withAKA) {

  if (Config.speech.server_speak) {
    socket.emit('plugin_action', "SonosPlayer", {action : {command: "change_voice"}});
  } else {
    if ((Config.voices.active.indexOf(Config.voices.current) == -1) || (Config.voices.active.indexOf(Config.voices.current) == (Config.voices.active.length - 1))) {
      Config.voices.current = Config.voices.active[0];
    } else {
      Config.voices.current = Config.voices.active[Config.voices.active.indexOf(Config.voices.current) + 1];
    }

    if (!Config.voices.current) // juste au cas ou...
      Config.voices.current = "Par défaut";

    fs.writeJsonSync('./resources/app/Avatar.config', Config);
    Avatar.SpeakManager.setConfig(Config);
  }

  Avatar.speak("C'est fait.", () => {
    logger('green', 'Merci Dave, cette voix me va bien aussi.', () => {
			end(true);
		});
  });

}



function getVoices (withAKA, callback) {

  const SimpleTTS = require("simpletts");
  const TTS = new SimpleTTS();
  TTS.getVoices("sapi")
  .then((voices) => {
    if (voices && voices.length > 0) {
      if (withAKA == 2) callback(voices);
      else {
        for (let i=0; i < voices.length; i++) {
            if (voices[i].name.toLowerCase() != "microsoft julie mobile" && voices[i].name.toLowerCase() != "microsoft paul mobile")
              logger('white', 'voix '+i+': genre: '+(voices[i].gender ? voices[i].gender : "Inconnu")+' nom: '+voices[i].name);
        }
      }
    } else {
        if (withAKA == 2)
					callback();
        else
					logger('orange', 'Aucune voix disponibles, Dave.');
    }
  }).catch((err) => {
    if (withAKA == 2)
			callback();
    else
			logger('Error', "Je n'ai pas pu récupérer les voix systèmes, Dave");
  });

  if (withAKA == 1) stopListen(true);
}


var intercom = exports.intercom = function(to) {
  intercomChrome (to);
}


function actionFromChrome (buffer, threashold) {
    if (buffer.toLowerCase() == Config.voices.changefor.toLowerCase()) {
       changeVoice();
       return;
    }

    if (buffer.toLowerCase() == Config.voices.getVoices.toLowerCase()) {
      getVoices();
      return;
    }

    buffer = searchActions(buffer, threashold, true);
		stopChromeListen(() => {
    	action(buffer, threashold, true);
		})
}


function listenFromChrome(buffer, threashold) {

  if (buffer.toLowerCase() == Config.voices.getVoices.toLowerCase()) {
    getVoices(1);
    return;
  }

  if (buffer.toLowerCase() == Config.voices.changefor.toLowerCase()) {
     changeVoice(true);
     return;
  }

  if (!is_askme.active) {
    buffer = searchActions(buffer, threashold, false);
		stopChromeListen(() => {
    	action(buffer, threashold, false);
		});
  } else {
    stopChromeListen (() => {
      getTag(buffer, is_askme.options, tag => {
        socket.emit('answer', tag);
      });
    });
  }

}


function configFromChrome (params) {
  if (params) {
    Config = params;
    fs.writeJsonSync('./resources/app/Avatar.config', params);
    Avatar.SpeakManager.setConfig(Config);
  }
}


function initFromChrome (port, chromeVersion) {
  welcomeInfo('chrome', chromeVersion);
  welcomeInfo('green', 'HTTPS Web Server is listening on port: '+ port.toString());
  initChrome (() => {
    // Ready to listen AKA
    //startChromeListen();

    setTimeout(function() {
      ipcRenderer.sendSync('welcomeHide');
    },2000);
  });
}


function closeFromChrome(flag) {
    if (flag == "true") {
      ipcRenderer.sendSync('quit');
      return;
    }
    let win = new BrowserWindow({
      width: 5,
      height: 5,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      transparent: true,
      skipTaskbar: true,
      title: "Quitter A.V.A.T.A.R Client",
      show: false,
      webPreferences: {
        nodeIntegration: true
      }
    });

    let options = {
        type: 'question',
        title: 'Quitter A.V.A.T.A.R Client',
        message: 'Tu veux vraiment me déconnecter, Dave ?',
        detail: 'Je t\'en pris, ne fais pas ça !\nJe t\'ai dit que je ne vous laisserai pas faire...',
        buttons: ['Oui', 'Non']
    };
    remote.dialog.showMessageBox(win, options, function(response) {
        win.close();
        if (response == 0)
            quit();
        else
          quitChrome (false);
    });
}



function uploadFile(request, response) {
    const {join} = require("path");
		const dir = join(__dirname, "transfert");
    var formidable = require('formidable');
    var util = require('util');
    var form = new formidable.IncomingForm();
    form.uploadDir = dir;
    form.keepExtensions = true;
    form.maxFieldsSize = 10 * 1024 * 1024;
    form.maxFields = 1000;
    form.multiples = false;
    form.parse(request, function(err, fields, files) {
        var file = util.inspect(files);
        var fileName = join(dir, file.split('path:')[1].split('\',')[0].split("\\transfert\\")[1].toString().replace(/\\/g, '').replace(/\//g, ''));
				var newFile = join(dir, 'intercom.wav');
				const ffmpeg = join(__dirname, "lib", "ffmpeg", "bin", "ffmpeg");
				exec(ffmpeg + ' -loglevel quiet -y -i '+fileName+' '+newFile, (err, _stdout, stderr) => {
					fs.removeSync(fileName);
					response.status(200).end();
          sending_intercom(intercomClient);
				});
    });
}


var count_occurences = function (buffer, separator, sep_list) {
  let pos = buffer.toLowerCase().indexOf(" "+separator+" ");
  while ( pos != -1 ) {
     sep_list.push({separator: " "+separator+" ", pos: pos});
     pos = buffer.toLowerCase().indexOf(" "+separator+" ",pos+1);
  }
  return sep_list;
}


var searchActions = function (buffer, threashold, withAKA) {

  if (!Config.separator_actions) {
    logger('orange', "configurez d'abord les séparateurs d'actions");
    return buffer;
  }

  let sep_list = [];
  _.each(Config.separator_actions, function(num, index, list) {
      sep_list = count_occurences(buffer, num, sep_list);
  });

  if (sep_list == 0)  // only one
      return buffer;

  // classement
  sep_list = _.sortBy(sep_list, 'pos');
  actions = [];
  let pos=0;
  let first;
  let action;
  // search multi actions
  for(let i=0; i<sep_list.length;i++){
      action = buffer.substring(pos, sep_list[i].pos);
      if (i>0)
        actions.push({next: action, threashold: threashold, withAKA: withAKA});
      else
        first = action;
      pos = sep_list[i].pos + sep_list[i].separator.length;
      if (i+1 == sep_list.length)
        actions.push({next: buffer.substring(pos), threashold: threashold, withAKA: withAKA});
  };
  return first;

}


var quit = exports.quit = function () {
  quitChrome (true);
  setTimeout(function() {
    ipcRenderer.sendSync('quit');
  },2000);
}


var logger = exports.logger = function (type, msg, callback) {
  logChrome(type, msg, callback);
}



function sending_intercom (to) {

  const spawn = require('child_process').spawn;
  const {join} = require("path");
  const sox = join(__dirname, "lib", "sox", "sox");
  const file = join(__dirname, "transfert", "intercom.wav");
  if (!fs.existsSync(file)) {
    logger('Error', "La communication s'est perdue dans l'espace, Dave. Je suis désolé.");
    end(true);
		return;
  }

  if (Config.speech.server_speak && to.toLowerCase() == Config.client.toLowerCase()) {
    socket.emit('play_intercom_newclient', file, Config.client);
    logger('green', 'Communication envoyée.');
    return;
  } else if (!Config.speech.server_speak && to.toLowerCase() == Config.client.toLowerCase()) {
    logger('green', 'Communication envoyée.', () => {
			const FFplay = require('ffplay');
	    let intercomPlayer = new FFplay(file, null, () => {
	      intercomPlayer = null;
	      end(true);
	    });
		});
    return;
  }

  socket.emit('init_intercom', Config.client, to);

  let transfert = spawn (sox, [
    '-q',
  	'-t', 'wav', file,
  	'-t', 'wav', '-'
  ],  { stdio: 'pipe'});

  transfert.stdout.setEncoding('binary');
  transfert.stdout.on('data', function(data) {
      socket.emit('send_intercom', Config.client, to , data);
  });

  transfert.on('close', function(code) {
     fs.removeSync(file);
     if(code) {
       logger('Error', "La communication s'est perdue dans l'espace, Dave. Je suis désolé.",() => {
				 end(true);
			 });
     }
     if (transfert) transfert.kill();
     socket.emit('send_intercom', Config.client, to, 'end');
     Avatar.speak("Communication envoyé.", () => {
       logger('green', 'Communication envoyée.',() => {
				 end(true);
			 });
     });
  });

}


var AKA = exports.AKA = function () {

  var start = function () {
		is_listen = true;
    logger('green', 'Je suis à ton écoute, Dave.', () => {
			silence()
			.then(() => {
				Avatar.speak(Config.locale[Config.speech.locale].tts_restoreContext, () => {
	          start_listen();
				});
			});
		});
	}

	if (Avatar.connected) {
    if (Config.listen.current == true)
			socket.emit('get_current', start);
		else
      start();
	} else {
    logger ('Error', "Je ne suis pas connecté au serveur, Dave.");
	}

}


var OnOffListen  = exports.OnOffListen = function(on) {
  if (on)
      startChromeListen();
  else
      stopChromeListen();
}


var start_listen = exports.start_listen = function() {
	if (ChromeStopped == true) {
		startChromeListen(() => {
			if (!AKAStopped) {
				stopChromeAKA(() => {
					if (!is_askme.active) timeout_speech();
				})
			} else {
				if (!is_askme.active) timeout_speech();
			}
		})
	} else {
		if (!AKAStopped) {
			stopChromeAKA(() => {
				if (!is_askme.active) timeout_speech();
			})
		} else {
			if (!is_askme.active) timeout_speech();
		}
	}
}


function action (sentence, threashold, keyword) {

    if (job) job.stop(); job = null;

    tts = cancel_speech (sentence, Config.locale[Config.speech.locale].tts_forceMute.split('|'), Config.locale[Config.speech.locale].answers_forceMute);
    if (!tts) tts = cancel_speech (sentence, Config.locale[Config.speech.locale].tts_cancel.split('|'), Config.locale[Config.speech.locale].answers_cancel);
    if (!tts) tts = cancel_speech (sentence, Config.locale[Config.speech.locale].tts_thank.split('|'), Config.locale[Config.speech.locale].answers_thank);

    is_AKA_action = keyword;
    emit_action (tts, sentence);
}


function emit_action (tts, sentence) {
  if (tts) {
    return Avatar.speak(tts, function() {
				end(true, true);
    });
  }
  logger ('Action', "J'envoie ton Intention à la base, Dave.", () => {
		socket.emit('action', sentence);
	});
}


function cancel_speech(sentence, answers, tbl_answers) {

	var tts;

	_.map(answers, function(answer) {
		if (sentence.toLowerCase() == answer.toLowerCase())
			tts = tbl_answers.split('|')[Math.floor(Math.random() * tbl_answers.split('|').length)];
	});

	if (!tts) {
		// dernière chance en distance de Levenshtein
		var sdx = soundex(sentence);
		var score = 0;

		_.map(answers, function(answer) {
			var sdx_gram = soundex(answer);
			var levens  = clj_fuzzy.metrics.levenshtein(sdx, sdx_gram);
			levens  = 1 - (levens / sdx_gram.length);
			if (levens > score && levens >= Config.listen.threashold) {
        logger('orange', 'Compréhension au plus proche: '+answer);
			  score = levens;
			  tts = tbl_answers.split('|')[Math.floor(Math.random() * tbl_answers.split('|').length)];
			}
		});
	}

  return tts;
}



function timeout_speech() {

	var d = new Date();
	var s = d.getSeconds()+Config.listen.timeout;
	d.setSeconds(s);

	if (job) job.stop();
	job = new cron(d, function(done) {
    logger ('orange', "Aucune règle. Délais d'écoute atteint...", () => {
			stopListen(true);
		});
	},null, true);
}


var stopListen = exports.stopListen = function (byCron) {
	if (job) job.stop(); job = null;
	if (byCron)
		end(true,true);
}


var end = exports.end = function(full,loop) {

	if (actions.length == 0 && Config.listen.loop_mode && !is_AKA_action && !loop && is_listen && full != 'end') {
    if (is_askme.active) {
      is_askme.active = false;
      is_askme.options = null;
    }

		// loop mode
    Avatar.speak(Config.locale[Config.speech.locale].tts_restart_restoreContext, function() {
      start_listen();
    });
	} else {
    if (actions.length > 0 && full != 'end') {
      	logger ('Intent', actions[0].next, () => {
					action(actions[0].next, actions[0].threashold, actions[0].withAKA);
		      actions = (actions.length > 1) ? _.rest(actions) : [];
				});
    } else {
      if (full == 'end')
        full = true;
      // reset listen
  		reset_listen(full);
    }
	}
}


function reset_listen(full) {
	if (full) {
    startChromeListen(() => {
			if (!AKAStopped)
				logger ('green', "Appelle-moi quand tu veux, Dave.");
			else
				startChromeAKA();
		});
		// Reinit variables
		is_askme.active = is_listen = is_silence = false;
    is_askme.options = null;
	}
	// remet le son des périphériques
	Avatar.unmute();
}



var force_silence = exports.force_silence = function (callback) {
	silence()
	.then(() => callback())
	.catch(function(err) {
    logger('Erreur', 'Je n\'ai pas pu régler le volume', () => {
			end(true, true);
		});
	})
}


function silence() {
  return new Promise(function (resolve, reject) {
    if (!is_silence) {
      // Coupe le son des périphériques
      Avatar.mute();
      // Reset microphone volume
      reset_volume(Config.microphone.level_micro);
      is_silence = true;
    }
    resolve();
  });
}


var reset_volume = exports.reset_volume = function(level_micro) {
	if (Config.microphone.set_micro) {
    let nircmd = join(__dirname, "lib", "nircmd", "nircmd");
    nircmd = nircmd+' setsysvolume ' + level_micro.toString() + ' "default_record"'
		Avatar.remote(qs);
    logger('orange', 'Je règle le volume à '+level_micro.toString());
	}
}


var change_speaker_volume = exports.change_speaker_volume = function(level_speaker) {
  let nircmd = join(__dirname, "lib", "nircmd", "nircmd");
  nircmd = nircmd+' setsysvolume ' + level_speaker.toString() + ' ' + level_speaker.toString();
  Avatar.remote(qs);
  logger('orange', 'Je change le volume de l\'enceinte à '+level_speaker.toString());
}


function is_grammar(sentence, rules) {

	for (var i=0; i < rules.grammar.length; i++){
		if (sentence.toLowerCase() == rules.grammar[i].toLowerCase()) {
			return rules.tags[i];
		}
	}

	// dernière chance en distance de Levenshtein
	var sdx = soundex(sentence);
	var score = 0;
	var match;
	for (var i=0; i < rules.grammar.length; i++){
		var sdx_gram = soundex(rules.grammar[i]);
		var levens  = clj_fuzzy.metrics.levenshtein(sdx, sdx_gram);
        levens  = 1 - (levens / sdx_gram.length);
		if (levens > score && levens >= Config.listen.threashold){
      logger('orange', 'Compréhension au plus proche: '+rules.grammar[i]);
      score = levens;
		  match = rules.tags[i];
		}
	}

	// Prise en compte du générique
	if (!match) {
		for (var i=0; i < rules.grammar.length; i++){
			if (rules.grammar[i] == '*') {
  		 	match = rules.tags[i] + ':' + sentence.toLowerCase();
				break;
			}
		}
	}
	return match ? match : null;
}


function getTag(sentence, rules, callback) {

		var tag = is_grammar(sentence, rules);
		if (tag) return callback(tag);

		restart_askme(rules);
}


var askme = exports.askme = function(options){

  is_askme.active = true;
  is_askme.options = options;

	silence()
	.then( function() {
    if (options.tts) {
      Avatar.speak(options.tts, () => {
          start_listen();
      });
    } else {
      start_listen();
    }
	})
	.catch(function(err) {
    logger('orange', 'Le dialogue s\'est intérrompu.', () => {
			end(true, true);
		});
	})
}


function restart_askme(){
    Avatar.speak(Config.locale[Config.speech.locale].restart , function() {
  		if (is_askme.active) socket.emit('reset_token');
      start_listen();
  	});
}


var askme_done = exports.askme_done = function(){
  is_askme.active =  false;
  is_askme.options = null;
	end(true);
}
