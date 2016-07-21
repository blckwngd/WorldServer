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

### Prerequisites

You need to install the following pieces of Software:
- NodeJS (https://nodejs.org)
- Deployd (https://www.deployd.com) - we run deployd as node module, but still need the dpd tool.
- MongoDB (https://mongodb.org) if you want to run a local database

Additionally, you need the following node modules:
- deployd
- fs
- https


### Setup encryption

The server of the application is based on deployd, which uses NodeJS and MongoDB.
You need to adjust your Deployd RunScript in order to use dpd via https, which is necessary for client side hardware access from JavaScript.
To do so, generate your SSL Keyfile (key.pem) and adjust the following lines to you runscript (by default located in 'Server' directory):

	var options = {
		...
		key: fs.readFileSync('your_key.pem'),
		cert: fs.readFileSync('your_cert.pem')
	};
  
As a quick start, an unsigned certificate and key file for 'localhost' are provided.


### MongoDB

1. Create a data directory for your mongo instance, i.e. /worldserver_db

2. Start the mongo daemon:

	mongod --dbpath /worldserver_db
	
3. Set up your database using the following commands:

	mongorestore -h localhost:27017 -d worldserver ".\WorldServer\Database"

4. Adjust your runscript (i.e. Server\run_local.js)

	var server = deployd({
	  ...
	  db: {
		host: 'localhost',
		port: YOUR_PORT,
		name: 'worldserver'
	  },
	  ...
	});

5. generate your App Key

From the main directory, run

	dpd keygen

To generate your key. Please remember not to commit the file .dpd/keys.json to the repository!
You can view the generated key by

	dpd showkey

You will need it later.


## How to run

When your environment is properly set up, navigate to the Server directory execute the proper runscript:

	node run_local.js

When the server is running, you can access it from your webbrowser, i.e. via https://localhost:5000/
You can access the dashboard via https://localhost:5000/dashboard using the previously generated key.