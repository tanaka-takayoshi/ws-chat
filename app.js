
/**
 * Module dependencies.
 */

var express = require('express')
  , io = require('socket.io')
  , routes = require('./routes');

var app = module.exports = express.createServer();

/**
 * Global variables
 */
// latest 100 messages
var history = [ ];
// list of currently connected clients (users)
var clients = [ ];

/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Array with some colors
var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
colors.sort(function(a,b) { return Math.random() > 0.5; } );

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

var socket = io.listen(app);
var count = 0;
socket.of('/chat').on('connection', function(client) {
  var index = clients.push(client) - 1;
  var userName = false;
  var userColor = false;

  console.log((new Date()) + ' Connection accepted.');

  // send back chat history
  if (history.length > 0) {
	client.send(JSON.stringify( { type: 'history', data: history} ));
  }
  
  client.on('user', function(message) {
    // remember user name
	userName = htmlEntities(message);
	// get random color and send it back to the user
	userColor = colors.shift();
	client.send(JSON.stringify({ type:'color', data: userColor }));
	console.log((new Date()) + ' User is known as: ' + userName
				+ ' with ' + userColor + ' color.');
  });
  
  client.on('message', function(message) {
    console.log((new Date()) + ' Received Message from '
                            + userName + ': ' + message);
	
	// we want to keep history of all sent messages
	var obj = {
		time: (new Date()).getTime(),
		text: htmlEntities(message),
		author: userName,
		color: userColor
	};
	history.push(obj);
	history = history.slice(-100);

	// broadcast message to all connected clients
	var json = JSON.stringify({ type:'message', data: obj });
	client.broadcast.send(json);
	client.send(json);
  });
  
  client.on('disconnect', function() {
    if (userName !== false && userColor !== false) {
            console.log((new Date()) + " Peer "
                + client.remoteAddress + " disconnected.");
            // remove user from the list of connected clients
            clients.splice(index, 1);
            // push back user's color to be reused by another user
            colors.push(userColor);
        }
  });
});
