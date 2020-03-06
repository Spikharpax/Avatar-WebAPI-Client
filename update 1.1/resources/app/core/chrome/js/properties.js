let opened;
let propertiesSave = {};
let Config;

document.getElementById('properties').addEventListener('click', function(){
    if (!opened) {
     Config = window.getConfig();
     if (Config) {
       opened = true;
       completeForm();
       document.getElementById('properties-form').style.visibility = "visible";
     } else {
       window.writemsg('orange', "Tu devrais attendre que je sois complétement initialisé, Dave.");
     }
   }
});


document.getElementById('voice-test').addEventListener('click', function(){

  let volume = document.getElementById('voice-volume').value;
  let speed = document.getElementById('voice-speed').value;
  let speech = document.getElementById('speech-voice-test').value;
  speech = speech ? speech : "Cette voix me va bien. Tu ne trouves pas?";

  let menuVoice = document.getElementById('menu-voices');
  for(var i=0; i < menuVoice.childNodes.length;i++) {
      let child = menuVoice.childNodes[i];
      if (child.toggled) {
        window.testVoice(speech, child.value, speed, volume);
        break;
      }
  }
})


document.getElementById('voices-list').addEventListener('click', function() {

  if (document.getElementById('voice-current').value != 'Par défaut' && document.getElementById('voices-list').value.indexOf(document.getElementById('voice-current').value) == -1) {
    document.getElementById('voice-current').value = 'Par défaut';
  }

})


document.getElementById('voice-set-current').addEventListener('click', function() {

  let menuVoice = document.getElementById('menu-voices');
  for(var i=0; i < menuVoice.childNodes.length;i++) {
      let child = menuVoice.childNodes[i];
      if (child.toggled) {
        if (document.getElementById('voices-list').value.indexOf(child.value) == -1) {
          let tblvoices = document.getElementById('voices-list').value.join('|');
          tblvoices = (tblvoices.length > 0) ? tblvoices+'|'+child.value: child.value;
          document.getElementById('voices-list').value = tblvoices.split('|');
        }
        document.getElementById('voice-current').value = child.value;
        break;
      }
  }

})


document.getElementById('keyword-test').addEventListener('click', function(){
    if (document.getElementById('keyword-test').toggled)
        window.setKeyWordTest(true);
    else
        window.setKeyWordTest(false);
})


document.getElementById('voice-add').addEventListener('click', function(){

  let menuVoice = document.getElementById('menu-voices');
  for(var i=0; i < menuVoice.childNodes.length;i++) {
      let child = menuVoice.childNodes[i];
      if (child.toggled) {
        if (document.getElementById('voices-list').value.indexOf(child.value) == -1) {
          let tblvoices = document.getElementById('voices-list').value.join('|');
          tblvoices = (tblvoices.length > 0) ? tblvoices+'|'+child.value: child.value;
          document.getElementById('voices-list').value = tblvoices.split('|');
        }
        break;
      }
  }
})


function completeForm() {
  // Client
  document.getElementById('client-name').value = Config.client;
  // AKA
  document.getElementById('AKA-list').value = Config.AKA;
  // multi actions
  if (Config.separator_actions)
    document.getElementById('separator-actions-list').value = Config.separator_actions;
  // refresh AKA
  if (Config.refresh_AKA)
    document.getElementById('refresh-AKA').value = Config.refresh_AKA;
  // server speak
  document.getElementById('server-speak').toggled = Config.speech.server_speak;
  // loop-mode
  document.getElementById('loop-mode').toggled = Config.listen.loop_mode;
  // timout-listen
  document.getElementById('timout-listen').value = Config.listen.timeout;
  // timout-speak
  document.getElementById('timout-speak').value = Config.speech.timeout;
  // current-mode
  document.getElementById('current-mode').toggled = Config.listen.current;
  // set-volume
  document.getElementById('set-volume').toggled = Config.microphone.set_micro;
  // level_micro
  document.getElementById('level-micro').value = Config.microphone.level_micro;
  // IP-serveur
  document.getElementById('IP-serveur').value = Config.http.server.ip;
  // IP-port
  document.getElementById('Port-serveur').value = Config.http.server.port;
  // UDP-scan
  document.getElementById('UDP-scan').value = Config.UDP.target;
  // timeout_ready
  document.getElementById('timeout-chrome').value = Config.chrome.timeout_ready;
  // pleine-page-mode
  document.getElementById('pleine-page-mode').toggled = Config.chrome.full_screen;
  // start-list
  document.getElementById('start-list').value = Config.locale[Config.speech.locale].tts_restoreContext.split('|');
  // loop-list
  document.getElementById('loop-list').value = Config.locale[Config.speech.locale].tts_restart_restoreContext.split('|');
  // mute
  document.getElementById('stoplisten-list').value = Config.locale[Config.speech.locale].answers_forceMute.split('|');
  // endloop-list
  document.getElementById('endloop-list').value = Config.locale[Config.speech.locale].answers_thank.split('|');
  // restart
  document.getElementById('restart-list').value = Config.locale[Config.speech.locale].restart.split('|');
  // cancel
  document.getElementById('cancel-list').value = Config.locale[Config.speech.locale].tts_forceMute.split('|');
  // cancel
  document.getElementById('thanks-list').value = Config.locale[Config.speech.locale].tts_thank.split('|');
  // Intercom timeout
  document.getElementById('timeout-intercom').value = Config.intercom.silence;
  // Intercom debug
  document.getElementById('set-intercom-debug').toggled = Config.intercom.debug;

  // voice
  document.getElementById('voice-current').value = Config.voices.current;
  let list = (Config.voices.active.length == 0) ? ["Par défaut"] : Config.voices.active;
  document.getElementById('voices-list').value = list;
  document.getElementById('voice-speed').value = Config.voices.speed;
  document.getElementById('voice-volume').value = Config.voices.volume;
  document.getElementById('voice-change').value = Config.voices.changefor;
  document.getElementById('voice-list').value = Config.voices.getVoices;

  let menu = document.getElementById('voices');
  let ismenu = document.getElementsByClassName("x-menu");
  if (ismenu && ismenu.length > 0) {
    menu.removeChild();
  }

  let menuVoices = document.createElement("x-menu");
  menuVoices.setAttribute('id', 'menu-voices');
  menu.appendChild(menuVoices);

  window.getVoices(function(voices) {
    if (voices) {
      let defaultitem = document.createElement("x-menuitem");
      defaultitem.value = "Par défaut";
      defaultitem.setAttribute('id', 'voice-auto');
      let label = document.createElement("x-label");
      label.className = 'x-label-voice';
      label.innerHTML = "Par défaut";
      defaultitem.appendChild(label);
      menuVoices.appendChild(defaultitem);
      let spaceitem = document.createElement("hr");
      menuVoices.appendChild(spaceitem);

      document.getElementById("voice-auto").toggled = true;

      voices.forEach(voice => {
        if (voice.name.toLowerCase() != "microsoft julie mobile" && voice.name.toLowerCase() != "microsoft paul mobile") {
          let name = getMapping (voice.name);
          let menuitem = document.createElement("x-menuitem");
          menuitem.className = 'x-voice';
          menuitem.value = name;
          label = document.createElement("x-label");
          label.className = 'x-label-voice';
          label.innerHTML = name;
          menuitem.appendChild(label);
          menuVoices.appendChild(menuitem);
        }
      });
    }
  })
}


function getMapping (voice) {
  Config.voices.mapping.forEach(modif => {
    if (voice.toLowerCase().indexOf(modif.left.toLowerCase()) != -1 && voice.toLowerCase().indexOf(modif.right.toLowerCase()) != -1) {
      voice = modif.left+modif.include+modif.right;
    }
  });

  return voice;
}


$('#save').click(function(){

   // Client
   Config.client = document.getElementById('client-name').value;
   // AKA
   Config.AKA = document.getElementById('AKA-list').value;
   // multi actions
   Config.separator_actions = document.getElementById('separator-actions-list').value;
   // refresh AKA
   Config.refresh_AKA = document.getElementById('refresh-AKA').value;
   // server speak
   Config.speech.server_speak = document.getElementById('server-speak').toggled;
   // loop-mode
   Config.listen.loop_mode = document.getElementById('loop-mode').toggled;
   // timout-listen
   Config.listen.timeout = parseInt(document.getElementById('timout-listen').value);
   // timout-speak
   Config.speech.timeout = parseInt(document.getElementById('timout-speak').value);
   // current-mode
   Config.listen.current = document.getElementById('current-mode').toggled;
   // set-volume
   Config.microphone.set_micro = document.getElementById('set-volume').toggled;
   // level_micro
   Config.microphone.level_micro = parseInt(document.getElementById('level-micro').value);
   // IP-serveur
   Config.http.server.ip = document.getElementById('IP-serveur').value;
   // IP-port
   Config.http.server.port = parseInt(document.getElementById('Port-serveur').value);
   // UDP-scan
   Config.UDP.target = document.getElementById('UDP-scan').value;
   // timeout_ready
   Config.chrome.timeout_ready = parseInt(document.getElementById('timeout-chrome').value);
   // pleine-page-mode
    Config.chrome.full_screen = document.getElementById('pleine-page-mode').toggled;
   // start-list
   Config.locale[Config.speech.locale].tts_restoreContext = document.getElementById('start-list').value.join('|');
   // loop-list
   Config.locale[Config.speech.locale].tts_restart_restoreContext = document.getElementById('loop-list').value.join('|');
   // mute
   Config.locale[Config.speech.locale].answers_forceMute = document.getElementById('stoplisten-list').value.join('|');
   // endloop-list
   Config.locale[Config.speech.locale].answers_thank = document.getElementById('endloop-list').value.join('|');
   // restart
   Config.locale[Config.speech.locale].restart = document.getElementById('restart-list').value.join('|');
   // cancel
   Config.locale[Config.speech.locale].tts_forceMute = document.getElementById('cancel-list').value.join('|');
   // cancel
   Config.locale[Config.speech.locale].tts_thank = document.getElementById('thanks-list').value.join('|');
   // Intercom timeout
   Config.intercom.silence = parseInt(document.getElementById('timeout-intercom').value);
   // Intercom debug
   Config.intercom.debug = document.getElementById('set-intercom-debug').toggled;

   // voice
   Config.voices.active = document.getElementById('voices-list').value;
   Config.voices.speed = parseInt(document.getElementById('voice-speed').value);
   Config.voices.volume = parseInt(document.getElementById('voice-volume').value);
   Config.voices.changefor = document.getElementById('voice-change').value ? document.getElementById('voice-change').value : "Change de voix";
   Config.voices.getVoices = document.getElementById('voice-list').value ? document.getElementById('voice-list').value : "Donne-moi les voix disponibles";
   Config.voices.current = document.getElementById('voice-current').value;

   window.setConfig(Config);
   let notification = document.getElementById('notification');
   notification.innerHTML = "Les paramètres ont été sauvegardés";
   notification.opened = true;

});



$( function() {
  $('.properties-form').draggable({
    cursor: "move",
    handle: ".window-controls",
    containment: "body"
  });

  $(".properties-form" ).resizable({
    containment: "body",
    minWidth: 300,
    minHeight: 200
  });
});


$('#minmax-properties').click(function() {

  if (propertiesSave.max) {
    document.getElementById('properties-form').style.top = propertiesSave.top+"px";
    document.getElementById('properties-form').style.left = propertiesSave.left+"px";
    document.getElementById('properties-form').style.width = propertiesSave.width+"px";
    document.getElementById('properties-form').style.height = propertiesSave.height+"px";
    propertiesSave.max = false;

 } else {
    propertiesSave.top = document.getElementById('properties-form').offsetTop;
    propertiesSave.left = document.getElementById('properties-form').offsetLeft;
    propertiesSave.width = document.getElementById('properties-form').offsetWidth;
    propertiesSave.height = document.getElementById('properties-form').offsetHeight;
    propertiesSave.max = true;

    let width = window.innerWidth;
    let height = window.innerHeight;

    document.getElementById('properties-form').style.top = "0px";
    document.getElementById('properties-form').style.left = "0px";
    document.getElementById('properties-form').style.width = width+"px";
    document.getElementById('properties-form').style.height = height+"px";
  }
});


$('#close-properties').click(function(){
  document.getElementById('properties-form').style.visibility = "hidden";
  opened = false;
});


$('#cancel').click(function(){
  document.getElementById('properties-form').style.visibility = "hidden";
  opened = false;
});


function showTab(evt, settingType) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabform");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("xtab");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(settingType).style.display = "block";
    evt.currentTarget.className += " active";
}
