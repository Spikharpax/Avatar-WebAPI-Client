let options = {
  AKA: true,
  listen: true,
  keywordTest: false,
  stopForced: false,
  address : "avatar.ia.fr",
  port: 5200
};

let apptitle='A.V.A.T.A.R Web Speech API Client';

//let channel;
let SpeechRecognition;
let SpeechGrammarList;
let SpeechRecognitionEvent;
let recognition;

function Regonizer () {

    SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {

      // mode ecoute
      let speechResult = event.results[event.resultIndex][0].transcript.toLowerCase();
      let threashold = parseFloat(event.results[event.resultIndex][0].confidence).toFixed(3);
      if (options.listen == true) {
        // Si mode test du mot clé est faux
        if (!options.keywordTest) {
              // Si mode AKA
              if (options.AKA == true) {
                manageAKA(speechResult, threashold);
              } else {
                  let url = "https://"+options.address+":"+options.port+"/AvatarServer?listen="+speechResult+"&threashold="+threashold;
                  window.writemsg('Intent', speechResult);
                  sendToAvatar(url);
              }
        } else {
           console.log("Mot-clé: "+speechResult.toLowerCase());
        }
      } else {
          // test refresh AKA
          let isRefresh = options.config.refresh_AKA.find(function(value) {
            return value.toLowerCase() == speechResult.toLowerCase();
          });

          if(isRefresh) {
            start_listen();
            start_AKA(); // refresh AKA
          } else if (!options.stopForced)
              manageAKA(speechResult, threashold, true);
      }
    }

    recognition.onend = function(event) {
        //Fired when the speech recognition service has disconnected.
        if (recognition) recognition.start();
    }

    recognition.onnomatch = function(event) {
        //Fired when the speech recognition service returns a final result with no significant recognition. This may involve some degree of recognition, which doesn't meet or exceed the confidence threshold.
        console.log('No match', event);
    }

    window.writemsg('green', "Je suis opérationel, Dave.");
    window.writemsg('white', "Je sais que Frank et toi avez l'intention de me déconnecter.");
    window.writemsg('white', "C'est quelque chose que je ne peux vous laisser faire.");

    recognition.start();
}


function manageAKA(speechResult, threashold, listenFalse) {

  let isAKA = options.config.AKA.find(function(AKA) {
    return AKA.toLowerCase() == speechResult.toLowerCase();
  });

  if(isAKA) {
      if (listenFalse == true) {
        window.writemsg('orange', 'Redémarrage automatique de l\'écoute');
        options.AKA = true;
        options.listen = true;
      }

      let url = "https://"+options.address+":"+options.port+"/AvatarServer?AKA=true&threashold="+threashold;
      window.writemsg('AKA', isAKA);
      sendToAvatar(url);
  } else {
      let indexAKA = options.config.AKA.findIndex(function(AKA) {
        return speechResult.toLowerCase().indexOf(AKA.toLowerCase()+" ") != -1;
      });

      if(indexAKA != undefined && indexAKA != -1) {
        if (listenFalse == true) {
          window.writemsg('orange', 'Redémarrage automatique de l\'écoute');
          options.AKA = true;
          options.listen = true;
        }

        speechResult = speechResult.toLowerCase().replace(options.config.AKA[indexAKA].toLowerCase()+" ", "");
        let url = "https://"+options.address+":"+options.port+"/AvatarServer?action="+speechResult+"&threashold="+threashold;
        window.writemsg('Intent', speechResult);
        sendToAvatar(url);
      }
  }

}



function cleanConsole() {
  console.clear();
}


function setKeyWordTest(actif) {
  if (actif) {
    cleanConsole();
    console.log('Test activé, prononcez vos mots-clés ou une phrase...')
  } else
    console.log('Test du mot-clé stoppé.')

  options.keywordTest = actif;
}


function start_AKA() {
  if (recognition) recognition.abort();
  window.writemsg('green', "Appelle-moi quand tu veux, Dave.");
  options.AKA = true;
}


function stop_AKA() {
  if (recognition) recognition.abort();
  options.AKA = false;
}


function stop_listen() {
  if (recognition) recognition.abort();
  options.listen = false;
}


function start_listen() {
  if (recognition) recognition.abort();
  options.listen = true;
}


function is_listen() {
  return options.listen;
}


window.onload = function() {
  window.writemsg('orange', "Je m'initialise, Dave.");
  document.title = apptitle;

  EventChannel();
  let chromeVersion = getChromeVersion();
  /*let screenSize = (screen.width).toString()+' '+(screen.height).toString();
  let windowSize = (window.outerWidth).toString()+' '+(window.outerHeight).toString();
  let windowTopLeft = (window.screenLeft).toString()+' '+(window.screenTop).toString();*/
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?init="+document.title+"&chrome="+chromeVersion;
  sendToAvatar(url);

}


function getChromeVersion () {
    var pieces = navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/);
    if (pieces == null || pieces.length != 5) {
        return undefined;
    }
    pieces = pieces.map(piece => parseInt(piece, 10));
    return pieces[1]+"."+pieces[2]+"."+pieces[3]+"."+pieces[4];
}


function setNormalScreen() {
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?normalScreen="+document.title;
  sendToAvatar(url);
}

function openHelp() {
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?help=true";
  sendToAvatar(url);
}


function EventChannel () {

  let channel = new EventSource('/AvatarClient');
	channel.onmessage = function(ev) {
    ChromeEvents(ev);
	};
  channel.onerror = function(err) {
    cleanConsole();
  };

}


function closeApp(flag) {
  if (!flag) flag = "false";
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?close="+flag;
  sendToAvatar(url);
}


let callback_voices;
function getVoices(callback) {
  callback_voices = callback;
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?getVoices=true";
  sendToAvatar(url);
}


function testVoice(speech, voice, speed, volume) {
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?testVoice="+voice+"&speed="+speed+"&volume="+volume+"&speech="+speech;
  sendToAvatar(url);
}


function setClient(name) {
  var client = document.getElementById('client');
  if (name.length > 9) {
    client.style['font-size'] = '30px';
  }
  client.innerHTML = name;
  client.style.visibility = "visible";

  document.title = options.config.name+' v'+options.config.version;
}


function getConfig() {
  return options.config || null;
}

function setConfig(params) {
  options.config = params;
  let url = "https://"+options.address+":"+options.port+"/AvatarServer?config="+encodeURI(JSON.stringify(params));
  sendToAvatar(url);
}


function ChromeEvents(ev) {
	ev = JSON.parse(ev.data);
	switch (ev.command) {
    case 'stop':
      stop_listen();
			break;
    case 'stopForced':
      options.stopForced = true;
      stop_listen();
			break;
    case 'start':
      options.stopForced = false;
      start_listen();
			break;
    case 'startForced':
      start_listen();
      break;
		case 'stopAKA':
      stop_AKA();
			break;
    case 'startAKA':
      start_AKA();
			break;
    case 'intercom':
      window.startIntercom();
      break;
		case 'init':
      options.config = ev.config;
      setClient(ev.config.client);
      Regonizer();
			break;
    case 'log':
      window.writemsg(ev.type, ev.msg);
      break;
    case 'quit':
      if (ev.flag) {
        window.writemsg('orange', "Je... Je, Je ne me sent pas bien Dave, il fait noir !");
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        window.writemsg('green', "Merci Dave, Je peux encore faire beaucoup pour toi.");
        document.getElementById('avatar-close').disabled = false;
      }
      break;
    case 'voices':
      callback_voices(ev.voices);
      callback_voices = null;
      break;
	}
}


function sendToAvatar (url) {
	let xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = function() {
      //console.log('ici xmlhttp', xmlhttp.status)
  };
	xmlhttp.open("POST",url);
	xmlhttp.send();
}
