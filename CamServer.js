var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var raspicam = require("raspicam");
var util = require("util");
var cv = require("opencv");
var fs = require("fs");

// This is the number the CamServer will be listening on.
const portNum = 3500;
// The is the directory where we will store the saved pictures.
const savedImageDir = "/home/pi/Pictures";
// The colour we will "circle" any detected faces.
const faceColour = [0, 255, 0];
// The thickness we we will "circle" any detected faces.
const faceThickness = 3;

app.set('port', (process.env.PORT || portNum));
app.use('/', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Additional middleware which will set headers that we need on each request.
app.use(function(req, res, next) {
    // Set permissive CORS header - this allows this server to be used only as
    // an API server in conjunction with something like webpack-dev-server.
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Disable caching so we'll always geSt the latest comments.
    res.setHeader('Cache-Control', 'no-cache');
    next();
});

/*
* Take a picture and then execute the provided callback when the picture is saved
* to disk.
*/
takePicture = function(argCallBack) {
  var dir = "/home/pi/Pictures";
  var file = util.format("%s/%d.png", dir, Date.now())

  var camera = new raspicam({
  	mode: "photo",
  	output: file,
    ifx: "none",
  	timeout: 0 // take the picture immediately
  });

  camera.on("started", function( err, timestamp ){
  	console.log("photo started at " + timestamp );
  });

  camera.on("read", function( err, timestamp, filename ){
    // The read event is fired multiple times - for temporary saved pictures
    // where the fielname contains "~" - we're not interested in these.
    if(filename.indexOf("~") === -1)
    {
      // the read event is fired for temporary pictures - we're not interested in this.
      console.log("photo image captured with filename: " + filename );
      // If we don't explicitly stop after this then we run into problems with more
      // read events being fired the more pictures we take.
      camera.stop();

      // Execute the callback with the newly saved picture.
      argCallBack(file);
    }
  });

  camera.start();
}

/*
* Check if the provided image contains any faces or not. The original image will be
* updated so that detected faces are circled. If the image does not contain any faces then
* the image is deleted.
*/
detectFaces = function(argImage) {
  cv.readImage(argImage, function(err, im){
    if (err) throw err;
    if (im.width() < 1 || im.height() < 1) throw new Error('Image has no size');
    // NOTE: You must make sure these xml files exist.
    // Can also supply the xml file directly: "./data/haarcascade_frontalface_alt.xml",
    im.detectObject(cv.FACE_CASCADE, {}, function(err, faces){
      if (err) throw err;

      if(faces.length === 0) {
          // delete if we dont have any faces.
          console.log('Delete %s - no faces', argImage);
          fs.unlinkSync(argImage);
      }
      else {
        console.log('Image %s contains %d faces', argImage, faces.length);
        // Loop through any of the detected faces and circle these.
        for (var i = 0; i < faces.length; i++){
          var face = faces[i];
          im.ellipse(face.x + face.width / 2, face.y + face.height / 2, face.width / 2, face.height / 2, faceColour, faceThickness);
        }

        // Overwrite the original file so that it now contains the circled faces.
        im.save(argImage);
      }
    });
  });
}


/*
* Set up the get request for taking a picture.
*/
app.get('/api/camera/takepic', function(req, res) {
  takePicture(detectFaces);
});


/*
* Entry point for the server to start listening
*/
app.listen(app.get('port'), function() {
  try {
    console.log('Cam server listening: http://localhost:%d/', app.get('port'));
  } catch (e) {
    console.log('Exception: %s', e.message);
  } finally {

  }
});
