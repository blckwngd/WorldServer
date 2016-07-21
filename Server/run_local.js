// run_local.js
var deployd = require('deployd'),
	fs = require('fs');

var server = deployd({
  port: process.env.PORT || 5000,
  env: 'production',
  db: {
    host: 'localhost',
    port: 27017,
    name: 'worldserver'
  },
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
});

server.listen();

server.on('listening', function() {
  console.log("Server is listening on port " + this.options.port);
});

server.on('error', function(err) {
  console.error(err);
  process.nextTick(function() { // Give the server a chance to return an error
    process.exit();
  });
});
