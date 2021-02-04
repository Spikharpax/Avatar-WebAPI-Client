const scanIP = require('evilscan');
const CronJob = require('cron').CronJob;
const udp = require('dgram');
const path = require('path');
const join = path.join;
const io = require('socket.io-client');
const {exec} = require('child_process');
const FFplay = require('ffplay');
const fs = require('fs-extra');
const _ = require('underscore');
const ss = require('socket.io-stream');
const {ipcRenderer} = require('electron');

var UDPcron;
var disconnected;
var countdisconnected = 0;
var checkReconnected;
var playerStream;

var init = function(){
  global.Avatar = Avatar;
  Avatar.Config = require('./config.js').init();
  Avatar.SpeakManager = require('./speak.js').init();
  Avatar.Listen = require('./listen.js');
  return Avatar;
}


var connect = function () {
  welcomeInfo('orange', 'Scanning Network, please wait...');
	if ((Config.http.server.ip).length == 0 || Config.http.server.ip == 'XXX.XXX.XXX.XXX') {
		// UDP Connect
		UDPconnect();
	} else {
		UDPconnect(Config.http.server.ip, function () {
			// HHTTP Connect
			HTTPconnect();
		});
	}
}


var UDPconnect = function (serverIP, callback) {

	var WifiIP = [];
	var options = {
		target: ((serverIP && (serverIP.toLowerCase() != 'localhost' && serverIP != 'XXX.XXX.XXX.XXX')) ? serverIP : Config.UDP.target),
		port: Config.http.server.port,
		status:'O' // Timeout, Refused, Open, Unreachable
	};

	var scanner = new scanIP(options);
	scanner.on('result',function(data) {
		WifiIP.push(data);
	});
	scanner.on('error',function(err) {
      welcomeInfo('Error', 'Wifi scan error: '+((err && err.length > 0) ? err : ""));
	});

	scanner.on('done',function() {
		if (WifiIP && WifiIP.length > 0) {
			if (!serverIP) {
				if (WifiIP.length > 1)
          			welcomeInfo('orange', 'More than one Avatar Server was found in the Network. Take the first one...');
            sendPingToServer(WifiIP[0]);
			} else {
				var found;
				for(s in WifiIP) {
					if (WifiIP[s].ip == serverIP) {
						callback();
						found = true;
						break;
					}
				}
				if (!found) {
          welcomeInfo('orange', 'IP: ' + WifiIP[0])
					sendPingToServer(WifiIP[0]);
        }
			}
		} else {
      welcomeInfo('orange', 'No Avatar Server in the Network. New test in '+Config.UDP.restart+' secs...');
      UDPScanRestart();
		}
	});
	scanner.run();
}


var UDPScanRestart = function () {
	if (UDPcron) UDPcron.stop();

	var d = new Date();
	var s = d.getSeconds()+Config.UDP.restart;
	d.setSeconds(s);

	UDPcron = new CronJob(d, function(done) {
		if (UDPcron) {
		  UDPcron.stop();
		  UDPcron = null;
		}
		UDPconnect();
	}, null, true);

}


var sendPingToServer = function (server) {

	var client = udp.createSocket('udp4');
  let oldIP = Config.http.server.ip;

	client.on('message',function(msg,infos){
    if (checkReconnected) {
      checkReconnected.stop();
      checkReconnected = null;
    }
		writeProperties(function(prop, callback) {
        Config.http.server.ip = prop.http.server.ip = infos.address;
        callback(prop);
      }, function () {
        if (server.ip != oldIP)
          welcomeInfo('green', 'Property file updated. New Avatar Server: '+infos.address);
        HTTPconnect(infos.address.toString());
		});
		client.close();
	});

	var msg = "AvatarClientPing:fixe:"+Config.client;
	//sending msg
	client.send(msg, 0, msg.length , Config.UDP.port, server.ip,function(err){
  	  if(err) {
        welcomeInfo('Error', 'Unable to ping Avatar Server: '+(err ? err : ""));
  		  client.close();
      }
      checkReconnect(10);
	});

}

function remote(cmd, callback) {

    exec(cmd, (err, _stdout, stderr) => {
        if (err)
          console.log("Unable to execute the command");
        if (callback) callback();
    });

}


var restart = function() {

	let cmd = path.resolve (__dirname+"/lib/nircmd/nircmd");
	exec(cmd+' win close title "'+Config.name+' v'+Config.version+'"', (err, stdout, stderr) => {
		let cmd = path.resolve (__dirname+"/../../../restart.vbs");
		exec(cmd);
    let state = ipcRenderer.sendSync('quit');
	});
}


function checkReconnect(timeout) {
  if (checkReconnected) {
    checkReconnected.stop();
    checkReconnected = null;
  }
  let d = new Date();
  let s = d.getSeconds()+timeout;
  d.setSeconds(s);
  checkReconnected = new CronJob(d, function(done) {
      restart();
  }, null, true);

}


var HTTPconnect = function (serverIp) {

	if (Config.client.length == 0)
    return welcomeInfo('Error', 'Unable to connect to the Avatar Server. The client has no name in the property file');

  let player;
  let records = [];
	socket = io.connect('http://' + ((serverIp) ? serverIp : Config.http.server.ip) + ':' + Config.http.server.port, {forceNew: true, autoConnect: true, reconnection: true, reconnectionDelay: 15000, reconnectionAttempts: Infinity})
		.on('connect_error', function(err) {
      welcomeInfo('orange', 'Avatar Server not started');
		})
		.on('connect', function() {
			socket.emit('client_connect', Config.client, "", "", Config.speech.server_speak, Config.listen.loop_mode);
		})
		.on('disconnect', function() {
			Avatar.Listen.logger('orange', "Dave, la base ne répond plus.");
			//restart();
		})
		.on('reconnect_attempt', function () {
      Avatar.Listen.logger('orange', "J'essaye de rétablir la communication...");
      // redémarrage auto si connection perdu
      checkReconnect(30);

      if (!disconnected)
        disconnected = true;
      else
        countdisconnected += 1;

      // tentatives maximales de reconnection
      if (countdisconnected == 10)
        restart();
		})
		.on('connected', function() {
      if (!disconnected)
        welcomeInfo('green', 'Connected to Avatar Server on port: '+Config.http.server.port.toString());
			else {
        Avatar.Listen.logger('green', "Tout va bien. J'ai réussi à rétablir la communication, Dave.");
        disconnected = false;
        countdisconnected = 0;

        if (checkReconnected) {
          checkReconnected.stop();
          checkReconnected = null;
        }
      }
		})
		.on('current', function(room, callback) {
			if (!callback) return console.log('Get current needs a callback function');
			// Si 2 micros sont trop près, pour éviter les interférences
			if (room == Config.client)
				callback();
			else
        Avatar.Listen.logger('orange', 'Je suis désolé Dave, '+room+" est en train d'écouter et il a la priorité.");
		})
		.on('mute', function(qs, callback) {
      Avatar.Listen.force_silence(function() {
        if (qs.sync)
          socket.emit('callback', callback);
      });
		})
		.on('askme', function(options) {
			Avatar.Listen.askme(options);
		})
		.on('stop_record', function() {
			Avatar.Listen.stopListen(true);
		})
		.on('askme_done', function() {
			Avatar.Listen.askme_done();
		})
		.on('speak', function(qs, callback) {
			if (qs.sync)
  			Avatar.speak( qs.tts, function() {
					socket.emit('callback', callback);
			  });
		  else
				Avatar.speak(qs.tts);
		})
		.on('client_speak', function(tts, callback, stopSpeak) {
			   Avatar.speak(tts, callback);
		})
		.on('callback_client_speak', function(callback) {
			   if (callback) callback();
		})
		.on('end', function(full, callback) {
			if (callback) callback();
			Avatar.Listen.end(full);
		})
		.on('start_listen', function() {
			Avatar.Listen.AKA();
		})
		.on('listen_again', function() {
			Avatar.Listen.start_listen();
		})
		.on('reset_volume', function(level_micro) {
			if (!level_micro)
				level_micro = Config.microphone.level_micro;
			Avatar.Listen.reset_volume(level_micro);
		})
		.on('speaker_volume', function(level_speaker) {
		  if (!level_speaker)
				level_speaker = Config.speaker.default;
			Avatar.Listen.change_speaker_volume(level_speaker);
		})
    .on('add_grammar', function (sentence) {/* No way */})
    .on('ConfidenceByNoise', function(threashold) {/* no way */})
		.on('keyPress', function(qs) {/* no way */})
		.on('keyDown', function(qs) {/* no way */})
		.on('keyUp', function(qs) {/* no way */})
		.on('keyText', function(qs) {/* no way */})
		.on('restart', function() {
			restart();
		})
		.on('play', function(qs, callback) {

     if (qs.play.indexOf('SERVERURL') != -1) {
       qs.play = qs.play.replace('SERVERURL','http://'+Config.http.server.ip+':'+Config.http.server.port);
       player = new FFplay(qs.play, null, function() {
         player = null;
         if (qs.sync)
             socket.emit('callback', callback);
       });
       return;
     }

     if (qs.play.indexOf('%URL%') != -1) {
       qs.play = qs.play.replace('%URL%','');
       playerStream = new FFplay(qs.play, null, function() {
         if (qs.sync)
             socket.emit('callback', callback);
       });
       return;
     }

		 if(qs.play.indexOf('%TRANSFERT%') != -1) {
        fs.ensureDirSync(join(__dirname , 'transfert'));
				if (qs.play.split('/').length > 1)
					qs.play = join(__dirname, 'transfert', _.last(qs.play.split('/')));
        else
					qs.play = qs.play.replace('%TRANSFERT%',join(__dirname, 'transfert'));
			}

			if (qs.play.indexOf('%CD%') != -1)
				qs.play = qs.play.replace('%CD%', path.resolve(__dirname));

			qs.play = path.normalize(qs.play);
      if (fs.existsSync(qs.play)) {
        player = new FFplay(qs.play, null, function() {
          player = null;
          if (qs.sync)
              socket.emit('callback', callback);
        });
      } else {
        Avatar.Listen.logger('orange', 'Le fichier '+qs.play+' n\'existe pas. Copiez-le d\'abord ou corrige son chemin, Dave.');
        if (qs.sync)
            socket.emit('callback', callback);
      }
		})
    .on('pause', function(qs, callback) {
      if (playerStream) {
         playerStream.stop(function() {
           playerStream = null;
           if (qs.sync)
               socket.emit('callback', callback);
         });
      } else
        Avatar.Listen.logger('orange', 'Je ne joue aucune musique, Dave');
    })
    .on('resume', function(qs) {
      if (player)
         player.resume(function() {
           if (qs.sync)
               socket.emit('callback', callback);
         });
      else
        Avatar.Listen.logger('orange', 'Je ne joue aucune musique, Dave');
    })
    .on('activate', function(qs) {/* no way */})
		.on('run', function(qs, callback) {
			if (qs.run.indexOf('%CD%') != -1)
				qs.run = qs.run.replace('%CD%', path.resolve(__dirname));

			if (qs.sync)
				remote(qs.run, function() {
					socket.emit('callback', callback);
				});
			else
			   remote(qs.run);
		})
		.on('notts', function(qs) {/*No way*/})
		.on('listen', function(qs) {
      Avatar.Listen.OnOffListen(qs.listen)
		})
		.on('context', function(qs) {/*No way*/})
		.on('grammar', function(qs) {/*No way*/})
		.on('intercom', function(to) {
			Avatar.Listen.intercom(to);
		})
		.on('init_intercom', function(from) {
      Avatar.Listen.logger('white', 'Communication entrante de '+from);
			records = [];
		})
    .on('receive_data', function(qs, callback) {
			receiveStream (qs, function() {
				if (qs.sync)
					socket.emit('callback', callback);
			});
		})
		.on('send_intercom', function(from, data) {
			if (data === 'end') {
				if (records){
            fs.ensureDirSync(join(__dirname, "intercom"));
            let file = join(__dirname, "intercom", 'intercom-from-'+from+'.wav');
						fs.writeFile(file, toBuffer(records));
						clean_wav(from, file, function (wav) {
              if (!Config.speech.server_speak) {
                let intercomPlayer = new FFplay(wav, null, function() {
                  intercomPlayer = null;
                });
              } else {
                socket.emit('play_intercom_newclient', wav, Config.client);
              }
						});
				} else {
          Avatar.Listen.logger('orange', 'Communication sans message reçue de '+from);
          Avatar.Listen.end(true);
				}
      } else {
				records.push(data);
			}
		});

    ss(socket).on('get_intercom', function(file, stream) {
			fs.createReadStream(file).pipe(stream);
		});

    global.socket = socket;

    // Init Listen
    Avatar.Listen.init();
}



var streamBuffers = require('stream-buffers');
var toBuffer = function(records){
  var osb = new streamBuffers.WritableStreamBuffer({
    initialSize: (100 * 1024),   // start at 100 kilobytes.
    incrementAmount: (10 * 1024) // grow by 10 kilobytes each time buffer overflows.
  });
  for(var i = 0 ; i < records.length ; i++) {
    osb.write(new Buffer.from(records[i], 'binary'));
  }
  osb.end();
  return osb.getContents();
}


function clean_wav (from, wav, callback) {

  var dir = join(__dirname, 'intercom');
  var wav_clean = join(dir, 'intercom-from-'+from+'-clean.wav');
  var cmd = join(__dirname, '/lib/sox/sox');
	cmd = cmd+' -q '+wav+' '+ wav_clean;
	var child = exec(cmd, function (err, stdout, stderr) {
		if (err) {
      Avatar.Listen.logger('Error', "Je n'ai pas pu nettoyer la communication reçue, Dave.");
      Avatar.Listen.end(true);
		}
	});

	if (child)
		child.stdout.on("close", function() {
			setTimeout(function(){
        fs.removeSync(wav);
				try {
					callback(wav_clean);
				} catch(ex){
          Avatar.Listen.logger('Error', "Je n'ai pas pu nettoyer la communication reçue, Dave.");
          Avatar.Listen.end(true);
				}
			}, 200);
		});

}


var receiveStream = function (data, callback) {

	let webroot = path.resolve(__dirname);
	fs.ensureDirSync(webroot + '/transfert/');

	let stream = ss.createStream();
	ss(socket).emit('get_data', data.src, stream);

	stream.pipe(fs.createOutputStream( webroot + '/transfert/' + data.dest));
	stream.on('end', function (data) {
		callback ();
	});

}


var writeProperties = function (doexec, callback) {
	let file = path.normalize(__dirname + '/../Avatar.config');
  let properties = fs.readJsonSync(file, { throws: false });
  doexec(properties, function (prop) {
    fs.writeJsonSync(file, prop);
  	callback();
  })
}


var mute = function () {
	socket.emit('mute');
}


var unmute = function () {
	socket.emit('unmute');
}


var isConnected = function (){
	return (!disconnected) ? true : false;
}



var Avatar = {
  'init'      : init,
  'connect'  : connect,
  'connected' : isConnected,
  "remote": remote,
  'mute' : mute,
  'unmute' : unmute
}

// Exports Avatar
exports.init = init;
