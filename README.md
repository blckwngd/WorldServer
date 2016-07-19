# WorldServer

## What is WorldServer

WorldServer is a backend for augmented reality applications.
It provides a standardized interface to define and interact with virtual objects in real world spaces.
WorldServer can be used to build real-time, real-world multiplayer games (think Pokemon Go), to enrich your environment with localized information (i.e. from wikipedia), or to interact with real-world objects using virtual layers (i.e. control smart-home devices using gestures, and view their current state as an overlay over the real world).

The example for this project is the virtual dimension of the Darknet, taken from Daniel Suarez´ books Daemon and Freedom.

Everybody can run their own servers and agents to define and interact with virtual objects. Thus, WorldServer is the AR equivalent to OpenSimulator.

WorldServer is independent from a specific viewer or client. Viewers can be implemented for Webbrowsers, Microsoft Hololens or smartphones.
However, several demo viewers are provided as a starting point.

Each viewer can be connected to multiple Servers, so that mixed content from several sources can be accessed simultaneously.


## Why WorldServer

## Architecture

## How to install

### Deployd

The server of the application is based on deployd, which uses NodeJS and MongoDB.
You need to adjust your Deployd RunScript in order to use dpd via https, which is necessary for client side hardware access from JavaScript.
To do so, generate your SSL Keyfile (key.pem) and change the following lines to you RunScript (by default located in the installation directory of deployd, under node_modules\deployd\bin\dpd):

  var options = {
	 port: port,
	 env: 'development',
	 db: {host: host, port: mongoPort, name: dbname},
	 key: fs.readFileSync('C:\\key.pem'),
	 cert: fs.readFileSync('C:\\cert.pem')
  };
  
an example RunScript is located in the directory 'Setup'.
