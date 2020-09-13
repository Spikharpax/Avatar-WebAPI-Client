let recorder;

function captureMicrophone(callback) {
    navigator.mediaDevices.getUserMedia({audio: true, echoCancellation:true})
    .then(function (mic) {
      callback(mic)
    })
    .catch(function(error) {
        window.writemsg('Error', "Je suis désolé Dave, je ne peux pas accéder à ton microphone");
        window.start_listen();
    });
}


function stopIntercomCallback() {

    if(!recorder || !recorder.getBlob()) {
      if (recorder) recorder.destroy();
      recorder = null;
      return;
    }
    var blob = recorder.getBlob();
    var file = new File([blob], "intercom.wav", {
        type: 'audio/wav'
    });
    xhr('/AvatarIntercom', file, function(res) {});

    recorder.microphone.stop();
    recorder.microphone = null;
    recorder.destroy();
    recorder = null;
}



function xhr(url, data, callback) {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
        if (request.readyState == 4 && request.status == 200) {
            callback(request.responseText);
        }
    };
    /*request.upload.onprogress = function(event) {
        console.log ('Upload Progress ' + Math.round(event.loaded / event.total * 100) + "%");
    };*/
    request.open('POST', url);
    var formData = new FormData();
    formData.append('file', data);
    request.send(formData);
}


function startIntercom () {

    let Config = getConfig();

    captureMicrophone(function(microphone) {
        recorder = RecordRTC(microphone, {
            type: 'audio/wav',
            recorderType: StereoAudioRecorder,
            numberOfAudioChannels: 2,
            checkForInactiveTracks: true,
            sampleRate: 44100,
            disableLogs: !Config.intercom.debug,
            bufferSize: 4096
        });
        recorder.startRecording();
        window.writemsg('green', "Communication établie, je t'écoute, Dave...");

        var max_seconds = Config.intercom.silence;
        var stopped_speaking_timeout;
        var speechEvents = hark(microphone, {});

        speechEvents.on('speaking', function() {
            if(recorder.getBlob()) return;
            clearTimeout(stopped_speaking_timeout);
        });

        speechEvents.on('stopped_speaking', function() {
            if(recorder.getBlob()) return;
            stopped_speaking_timeout = setTimeout(function() {
                speechEvents.stop();
                speechEvents = null
                stopIntercom();
            }, max_seconds * 1000);
        });

        recorder.microphone = microphone;
    });
}


function stopIntercom () {
    recorder.stopRecording(stopIntercomCallback);
};
