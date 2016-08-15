// WorldServerClient.js
// requires: DPD, Cesium

function WorldServerClient(viewer, dpd) {
   this.viewer = viewer;
   this.dpd = dpd;
   this.loggedIn = false;
   this.agents = [];
   this.objects = [];
   this.me = false;
   this.locationAuthority = WorldServerClient.prototype.LocationAuthority.Geo;
   this.geoLocationWatchID = false;
   this.currentLocation = false;
   this.isCameraMoving = false;
   this.minUploadInterval = 2000; // do not upload more often than each x millisecs
   
   // user callbacks
   this.onObjectCreaed = null;
   this.onAgentCreaed = null;
   this.onObjectChanged = null;
   this.onAgentChanged = null;
   
   var self = this;
   
   if (this.viewer) {
      // movement detection of player cam - START //
      this.viewer.camera.moveStart.addEventListener( function() {
         self.isCameraMoving = true;
         self.onCameraMoveStart();
      });
      this.viewer.camera.moveEnd.addEventListener( function() {
         self.isCameraMoving = false;
         self.onCameraMoveEnd();
      });
      viewer.scene.postRender.addEventListener(function() {
         if(self.isCameraMoving) { self.onCameraMove(); }
      });
   }
   window.setInterval(function() {
      self.uploadBlocked = false;
   }, this.minUploadInterval);
};

/**
 *
 * ENUM for valid locationAuthorities
 */
WorldServerClient.prototype.LocationAuthority = {
   Camera : 1,	// the users controls the camera, the agent moves accordingly
   Geo: 2,		// camera and agent are adjusted to the users gps coordinates
   Agent: 3		// the agent is controlled directly by the script. camera will be adjusted accordingly
};

/** login
 *
 * performs the login procedure for the wurrent user on the WorldServer
 */
WorldServerClient.prototype.login = function(username, password) {
   var self = this;
   this.dpd.agents.login({username: username, password: password}, function(result, error) {
      if (error) {
        alert(error.message);
        self.loggedIn = false;
      } else {
         self.dpd.agents.me(function(user) {
           if (user) {
             self.me = user;
             self.loggedIn = true;
           }
         });
      }
   });
}

/** setLocationAuthority
 *
 * sets the active locationAuthority to Camera / Geo / Agent
 * i.e. if locationAuthority is set to Camera, and the cam is moved in the viewer, the agent location will be adjusted accordingly
 */
WorldServerClient.prototype.setLocationAuthority = function(locationAuthority) {
   this.locationAuthority = locationAuthority;
   
   if (locationAuthority == WorldServerClient.prototype.LocationAuthority.Geo) {
      this.enableGeoLocation();
   }
}

/** enableGeoLocation
 *
 * enables JavaScripts built-in geolocation functionality to track the users position.
 * when the location changes, other elements are updated accordingly.
 * a custom callback can be provided to inform the viewer when the location has changed.
 */
WorldServerClient.prototype.enableGeoLocation = function(callback) {
   this.locationAuthority = WorldServerClient.prototype.LocationAuthority.Geo;
   
   var self = this; // cheat on closure
   this.geoLocationWatchID = navigator.geolocation.watchPosition(function(location) {
      
      if (self.locationAuthority == WorldServerClient.prototype.LocationAuthority.Geo) {
         // update stored location
         self.currentLocation = location;
         
         if (self.viewer) {
            // update camera
            self.viewer.camera.setView({
                destination : Cesium.Cartesian3.fromDegrees(location.coords.longitude, location.coords.latitude, 1.5),
                orientation: {
                    heading : Cesium.Math.toRadians(0.0), // north, default value is 0.0 (north)
                    pitch : Cesium.Math.toRadians(0),    // straight
                    roll : 0.0                             // default value
                }
            });
         }
         
         // update agent
         if (self.me) {
            if (!self.me.location) {
               self.me.location = {
                  coordinates: [],
                  height: 0
               }
            }
            self.me.location.coordinates[0] = location.coords.longitude;
            self.me.location.coordinates[1] = location.coords.latitude;
            dpd.agents.put(me);
         }
         
         // query scene around the new location
         objects = self.loadObjectsNear(location.coords, radius);
         agents = self.loadAgentsNear(location.coords, radius);
      }
     
      if (typeof callback != "undefined")
         callback(location);
   });
}

/**
 * updateAgentLocationFromCamera
 *
 * syncs the current agents location to the cameras location.
 * if possible or explicitely requested, the changes are synchronized to the backend
 * should only be called when locationAuthority is set to "Camera"
 */
WorldServerClient.prototype.updateAgentLocationFromCamera = function(forceSync) {
   if (!this.viewer)
      return;
   var location = this.viewer.camera.positionCartographic;
   if (this.me) {
      this.me.location.coordinates[0] = Cesium.Math.toDegrees(location.longitude); // TODO: toDegrees() necessary?
      this.me.location.coordinates[1] = Cesium.Math.toDegrees(location.latitude);
      this.me.location.height = location.height;
      
      if (forceSync || !this.uploadBlocked ) {
		 // upload changed position to db
         dpd.agents.put(this.me);
         this.uploadBlocked = true;
         // query scene around the new location
		 var location_deg = {
			 longitude: Cesium.Math.toDegrees(location.longitude),
			 latitude: Cesium.Math.toDegrees(location.latitude)
		 }
         objects = this.loadObjectsNear(location_deg, radius);
         agents = this.loadAgentsNear(location_deg, radius);
      }
   }
}

/** onCameraMoveStart
 *
 * this callback is executed whenever the viewers camera starts moving
 */
WorldServerClient.prototype.onCameraMoveStart = function() {
   // callback code
}


/** onCameraMove
 *
 * this callback is executed on each tick while the viewers camera is moving
 */
WorldServerClient.prototype.onCameraMove= function() {
   if (this.locationAuthority == WorldServerClient.prototype.LocationAuthority.Camera) {
      this.updateAgentLocationFromCamera(false);
   }
}

/** onCameraMoveEnd
 *
 * this callback is executed whenever the viewers camera stops moving
 */
WorldServerClient.prototype.onCameraMoveEnd = function() {
   if (this.locationAuthority == WorldServerClient.prototype.LocationAuthority.Camera) {
      // force sync of the new position to the backend, since this is the final position
      this.updateAgentLocationFromCamera(true);
   }
}


/*
 * queries for game objects near a specific position
 */
WorldServerClient.prototype.loadObjectsNear = function(coordinates, maxDistance) {
   var coords = [coordinates.longitude,coordinates.latitude];
   var self = this;
   this.dpd.objects.get(
      {
         location : {"$near":{"$maxDistance":maxDistance,"$geometry":{type:"Point",coordinates:coords}}}
      },
      function(objects, error) { //Use dpd.js to access the API
         for (var i in objects) {
            var object = objects[i];
            self.updateObjectInfoOnMap(object);
         }
      });
}


/*
 * queries for agents near a specific position
 */
WorldServerClient.prototype.loadAgentsNear = function(coordinates, maxDistance) {
   var coords = [coordinates.longitude,coordinates.latitude];
   var self = this;
   this.dpd.agents.get(
      {
         location : {"$near":{"$maxDistance":maxDistance,"$geometry":{type:"Point",coordinates:coords}}}
      },
      function(agents, error) { //Use dpd.js to access the API
         for (var i in agents) {
            var agent = agents[i];
            self.updateAgentInfoOnMap(agent);
         }
      });
}



/*
 * adjusts the visual representation of a game agent (player) on the 3d map, i.e. its position
 */
WorldServerClient.prototype.updateAgentInfoOnMap = function(agent) {
   if (!this.viewer) // no graphical representation => nothing to do
      return;
   if (typeof agent == "undefined") {
      console.log("ERR: AGENT IS UNDEFINED");
      return;
   }
   // check if agent is already loaded
   var entity = viewer.entities.getById(agent.id);
   if (typeof entity == "undefined") {
      entity = {
         name : agent.username,
         id : agent.id,
         position : Cesium.Cartesian3.fromDegrees(agent.location.coordinates[0], agent.location.coordinates[1], agent.location.height),
         point : {
            color : Cesium.Color.BLUE, // default: WHITE
            pixelSize : 25, // default: 1
            outlineColor : Cesium.Color.YELLOW, // default: BLACK
            outlineWidth : 1 // default: 0
         },
         label : {
             text : "AGENT: " + agent.username,
             description : "<i>" + agent.username + "</i>",
             fillColor : Cesium.Color.RED,
             outlineColor : Cesium.Color.WHITE,
             outlineWidth : 1,
             style : Cesium.LabelStyle.FILL_AND_OUTLINE,
             pixelOffset : new Cesium.Cartesian2(0.0, -20),
             pixelOffsetScaleByDistance : new Cesium.NearFarScalar(1.5e2, 3.0, 1.5e7, 0.5),
             translucencyByDistance : new Cesium.NearFarScalar(1.5, 1.0, 1.5e3, 0.0)
         }
      };
      if (typeof this.onAgentUpdated != "undefined") this.onAgentCreated (entity);
      viewer.entities.add(entity);
   } else {
      // already loaded. adjustment of position & co
      entity.position = Cesium.Cartesian3.fromDegrees(agent.location.coordinates[0], agent.location.coordinates[1], agent.location.height);
      if (typeof this.onAgentUpdated != "undefined") this.onAgentUpdated (entity);
   }
   
}

/*
 * adjusts the visual representation of a game object on the 3d map, i.e. its position
 */
WorldServerClient.prototype.updateObjectInfoOnMap = function(object) {
   if (!this.viewer) // no graphical representation => nothing to do
      return;
   // check if object is already loaded
   var entity = viewer.entities.getById(object.id);
   if (typeof entity == "undefined") {
      entity = {
         name : object.id,
         id : object.id,
         position : Cesium.Cartesian3.fromDegrees(object.location.coordinates[0], object.location.coordinates[1], object.location.height),
         label : {
             text : (object.name ? object.name : ("OBJECT: " + object.id)),
             fillColor : Cesium.Color.BLACK,
             outlineColor : Cesium.Color.WHITE,
             outlineWidth : 1,
             style : Cesium.LabelStyle.FILL_AND_OUTLINE,
			 eyeOffset : new Cesium.Cartesian3(0.0, 11.0, 0.0),
			 verticalOrigin : Cesium.VerticalOrigin.BOTTOM,
             translucencyByDistance : new Cesium.NearFarScalar(1.5, 1.0, 1.5e3, 0.0)
         },
         description : "<i>" + object.id + "</i><p>" + object.description + "</p>"
      };
      if (typeof object.url != "undefined") {
         // draw model
         entity.model = {
            uri : object.url,
            minimumPixelSize : 128,
            maximumScale : 20000
         };
      } else {
         entity.polyline = {
			positions : [
				Cesium.Cartesian3.fromDegrees(object.location.coordinates[0], object.location.coordinates[1], 0.0),
				Cesium.Cartesian3.fromDegrees(object.location.coordinates[0], object.location.coordinates[1], 10.0),
			],
			width : 5,
			material : new Cesium.PolylineGlowMaterialProperty({color: Cesium.Color.RED})
		  }
      }
      if (typeof this.onObjectCreated != "undefined") this.onObjectCreated (entity);
      viewer.entities.add(entity);
   } else {
      // already loaded. adjustment of position & co
      entity.position = Cesium.Cartesian3.fromDegrees(object.location.coordinates[0], object.location.coordinates[1], object.location.height);
      if (typeof this.ObjectUpdated != "undefined") this.onObjectUpdated (entity);
   }
}

WorldServerClient.prototype.setShadows = function(castShadows, receiveShadows) {
   for (i = 0; i < this.viewer.entities.length; ++i) {
      if (this.viewer.entities[i]) {
         this.viewer.entities[i].model.castShadows = castShadows;
         this.viewer.entities[i].model.receiveShadows = receiveShadows;
      }
    }
}

/** pushObject
 *
 * creates a new object on the WorldServer instance, or updates the existing one.
 * a unique id must be provided to prevent duplicates from multiple uploads from one agent/user
 */
WorldServerClient.prototype.pushObject = function(uid, longitude, latitude, height, name, description) {
   if (!this.me) {
      console.log("WorldServerClient.pushObject: you must be logged in to do this");
      return;
   }
   var uuid = this.me.id + uid; // each unique object can only be created once by one agent
   var object = {
      name : name,
      location : {
         type : "Point",
         coordinates : [longitude, latitude],
         height : height
      },
      description : description,
      uid : uuid
   };
   var result = null;
   // TODO: Post Handler - uid prüfen, owner eintragen, description/title escapen
   dpd.objects.post (object, function(res, error) {
      if (typeof error != "undefined")
         console.log("WorldServerClient.pushObject: ERROR in post: ", error);
      result = res;
   });
   return result;
}
