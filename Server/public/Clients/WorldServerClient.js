// WorldServerClient.js
// requires: DPD, Cesium

function WorldServerClient(viewer, dpd) {
   this.viewer = viewer;
   this.dpd = dpd;
   this.loggedIn = false;
   this.agents = []; // { id : "", viewer_entity : {}, db_entity : {}, linked_objects : [] }
   this.objects = []; // { id : "", viewer_entity : {}, db_entity : {} }
   this.me = false; // index of users agent
   this.locationAuthority = WorldServerClient.prototype.LocationAuthority.Geo;
   this.geoLocationWatchID = false;
   this.currentLocation = false;
   this.isCameraMoving = false;
   this.radius = 1000;
   this.minUploadInterval = 2000; // do not upload more often than each x millisecs
   this.currentTime = new Date();
   
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
   
   this.init();
};

/**
 *
 * ENUM for valid locationAuthorities
 */
WorldServerClient.prototype.LocationAuthority = {
   Camera : 1,   // the users controls the camera, the agent moves accordingly
   Geo: 2,      // camera and agent are adjusted to the users gps coordinates
   Agent: 3      // the agent is controlled directly by the script. camera will be adjusted accordingly
};


WorldServerClient.prototype.init = function() {
   var self = this;
   this.dpd.agents.on('changed', function(db_entity) {
      self.updateAgentInfoFromDB(db_entity);
   });
   this.dpd.objects.on('changed', function(db_entity) {
      self.updateObjectInfoFromDB(db_entity);
   });
}


/** login
 *
 * performs the login procedure for the wurrent user on the WorldServer
 */
WorldServerClient.prototype.login = function(username, password, onLogin, onLoginFailed) {
   var self = this;
   this.dpd.agents.login({username: username, password: password}, function(result, error) {
      if (error) {
         alert(error.message);
         self.loggedIn = false;
         if (typeof onLoginFailed != "undefined" && onLoginFailed != false) {
            onLoginFailed();
         }
      } else {
         self.dpd.agents.me(function(user) {
            if (user) {
               self.me = self.agents.push({viewer_entity : false, db_entity : user, linked_objects : []}) - 1; // index, not length
               self.loggedIn = true;
               if ((typeof onLogin != "undefined") && (onLogin != false)) {
                  onLogin(self.agents[self.me]);
               }
            }
         });
      }
   });
};

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
};

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
         if (self.me !== false) {
            var player = self.agents[self.me];
            if (!player.db_entity.location) {
               player.db_entity.location = {
                  coordinates: [],
                  height: 0
               }
            }
         
            player.db_entity.location.coordinates[0] = location.coords.longitude;
            player.db_entity.location.coordinates[1] = location.coords.latitude;
            dpd.agents.put(player.db_entity);
         }
         
         // query scene around the new location
         objects = self.loadObjectsNear(location.coords, self.radius);
         agents = self.loadAgentsNear(location.coords, self.radius);
      }
     
      if (typeof callback != "undefined")
         callback(location);
   });
};

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
   if (this.me === false)
      return;
   var location = this.viewer.camera.positionCartographic;
   var player = this.agents[this.me];
   // update info of database-object
   player.db_entity.location.coordinates[0] = Cesium.Math.toDegrees(location.longitude); // TODO: toDegrees() necessary?
   player.db_entity.location.coordinates[1] = Cesium.Math.toDegrees(location.latitude);
   player.db_entity.location.height = location.height;
   // update info of viewer object
   player.viewer_entity.location = player.db_entity.location;

   if (forceSync || !this.uploadBlocked ) {
      // upload changed position to db
      dpd.agents.put(player.db_entity);
      this.uploadBlocked = true;
         // query scene around the new location
      var location_deg = {
         longitude: Cesium.Math.toDegrees(location.longitude),
         latitude: Cesium.Math.toDegrees(location.latitude)
      }
      objects = this.loadObjectsNear(location_deg, radius);
      agents = this.loadAgentsNear(location_deg, radius);
   }
};

/** onCameraMoveStart
 *
 * this callback is executed whenever the viewers camera starts moving
 */
WorldServerClient.prototype.onCameraMoveStart = function() {
   // callback code
};


/** onCameraMove
 *
 * this callback is executed on each tick while the viewers camera is moving
 */
WorldServerClient.prototype.onCameraMove = function() {
   if (this.locationAuthority == WorldServerClient.prototype.LocationAuthority.Camera) {
      this.updateAgentLocationFromCamera(false);
   }
};

/** onCameraMoveEnd
 *
 * this callback is executed whenever the viewers camera stops moving
 */
WorldServerClient.prototype.onCameraMoveEnd = function() {
   if (this.locationAuthority == WorldServerClient.prototype.LocationAuthority.Camera) {
      // force sync of the new position to the backend, since this is the final position
      this.updateAgentLocationFromCamera(true);
   }
};

/** setLocation
 *
 * helper function to easily adjust the players position
 * pass location in degrees
 */
WorldServerClient.prototype.setOwnLocation = function(longitude, latitude, height) {
   if (this.me === false) {
      return;
   }
   this.agents[this.me].db_entity.location = {
      type: "Point",
      coordinates: [longitude, latitude],
      height: height
   };
   dpd.agents.put(this.agents[this.me].db_entity);
   this.updateAgentInfoFromDB(this.agents[this.me]); // TODO: ugly: this will repeat many steps
};

/*
 * queries for game objects near a specific position
 */
WorldServerClient.prototype.loadObjectsNear = function(coordinates, maxDistance) {
   var coords = [coordinates.longitude,coordinates.latitude];
   var self = this;
   this.dpd.objects.get(
      {
         location : {"$near":{"$maxDistance":maxDistance,"$geometry":{type:"Point",coordinates:coords}}}, 
         isrelative:false
      },
      function(objects, error) { //Use dpd.js to access the API
         for (var i in objects) {
            self.updateObjectInfoFromDB(objects[i]);
         }
      });
};


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
            self.updateAgentInfoFromDB(agents[i]);
         }
      });
}



/*
 * adjusts the visual representation of a game agent (player) on the 3d map, i.e. its position
 */
WorldServerClient.prototype.updateAgentInfoFromDB = function(db_agent) {
   if (!this.viewer) // no graphical representation => nothing to do
      return;
   if (typeof db_agent == "undefined") {
      console.log("ERR: AGENT IS UNDEFINED");
      return;
   }
   
   // check if agent is already loaded
   var agent = false;
   for (var i in this.agents) {
      if (this.agents[i].id == db_agent.id) {
         agent = this.agents[i];
      }
   }
   if (agent == false) {
      // create a new agent
      agent = {
         id : db_agent.id,
         db_entity : db_agent,
         viewer_entity : viewer.entities.add({
            name : db_agent.username,
            id : db_agent.id,
            position : Cesium.Cartesian3.fromDegrees(db_agent.location.coordinates[0], db_agent.location.coordinates[1], db_agent.location.height),
            point : {
               color : Cesium.Color.BLUE, // default: WHITE
               pixelSize : 25, // default: 1
               outlineColor : Cesium.Color.YELLOW, // default: BLACK
               outlineWidth : 1 // default: 0
            },
            label : {
                text : "AGENT: " + db_agent.username,
                description : "<i>" + db_agent.username + "</i>",
                fillColor : Cesium.Color.RED,
                outlineColor : Cesium.Color.WHITE,
                outlineWidth : 1,
                style : Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset : new Cesium.Cartesian2(0.0, -20),
                pixelOffsetScaleByDistance : new Cesium.NearFarScalar(1.5e2, 3.0, 1.5e7, 0.5),
                translucencyByDistance : new Cesium.NearFarScalar(1.5, 1.0, 1.5e3, 0.0)
            }
         })
      };
      this.agents.push(agent);
      if (typeof this.onAgentCreated != "undefined") this.onAgentCreated (agent);
      
   } else {
      // already loaded. adjustment of position & co
      agent.viewer_entity.position = Cesium.Cartesian3.fromDegrees(db_agent.location.coordinates[0], db_agent.location.coordinates[1], db_agent.location.height);
      agent.db_entity.location = db_agent.location;
      agent.db_entity.orientation = db_agent.orientation;
      if (typeof this.onAgentUpdated != "undefined") this.onAgentUpdated (agent);
   }
   
}

/*
 * adjusts the visual representation of a game object on the 3d map, i.e. its position
 */
WorldServerClient.prototype.updateObjectInfoFromDB = function(db_object) {
   if (!this.viewer) // no graphical representation => nothing to do
      return;
      
   // check if object is already loaded
   var object = false;
   for (var i=0; i<this.objects.length; i++) {
      if (this.objects[i].id == db_object.id) {
         object = this.objects[i];
      }
   }
   if (object == false) {
      // create a new object
      console.log("creating new object: " + db_object.id);
      object = {
         id : db_object.id,
         db_entity : db_object,
         viewer_entity : viewer.entities.add({
            name : db_object.id,
            id : db_object.id,
            position : Cesium.Cartesian3.fromDegrees(db_object.location.coordinates[0], db_object.location.coordinates[1], db_object.location.height),
            label : {
               text : (db_object.name ? db_object.name : ("OBJECT: " + db_object.id)),
               fillColor : Cesium.Color.BLACK,
               outlineColor : Cesium.Color.WHITE,
               outlineWidth : 1,
               style : Cesium.LabelStyle.FILL_AND_OUTLINE,
               eyeOffset : new Cesium.Cartesian3(0.0, 11.0, 0.0),
               verticalOrigin : Cesium.VerticalOrigin.BOTTOM,
               translucencyByDistance : new Cesium.NearFarScalar(1.5, 1.0, 1.5e3, 0.0)
            },
            description : "<i>" + db_object.id + "</i><p>" + db_object.description + "</p>"
         })
      };
      
      if (typeof db_object.url != "undefined") {
         // draw model
         object.viewer_entity.model = {
            uri : db_object.url
         };
      } else {
         object.viewer_entity.polyline = {
         positions : [
            Cesium.Cartesian3.fromDegrees(db_object.location.coordinates[0], db_object.location.coordinates[1], 0.0),
            Cesium.Cartesian3.fromDegrees(db_object.location.coordinates[0], db_object.location.coordinates[1], 10.0),
         ],
         width : 5,
         material : new Cesium.PolylineGlowMaterialProperty({color: Cesium.Color.RED})
        }
      }
      if (typeof this.onObjectCreated != "undefined") this.onObjectCreated (object);
      this.objects.push(object);
   } else {
      // already loaded. adjustment of position & co
      console.log("updating existing object: " + object.db_entity.name);
      object.viewer_entity.position = Cesium.Cartesian3.fromDegrees(db_object.location.coordinates[0], db_object.location.coordinates[1], db_object.location.height);
      // TODO: update size and orientation in viewer
      object.db_entity.location = db_object.location;
      object.db_entity.orientation = db_object.orientation;
      object.db_entity.scale = db_object.scale;
      object.db_entity.name = db_object.name;
      object.db_entity.description = db_object.description;
      object.viewer_entity.name = db_object.name;
      object.viewer_entity.description = db_object.description; 
      if (typeof this.onObjectUpdated != "undefined") this.onObjectUpdated (object);
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
   if (this.me === false) {
      console.log("WorldServerClient.pushObject: you must be logged in to do this");
      return;
   }
   var uuid = this.agents[this.me].id + uid; // each unique object can only be created once by one agent
   // we don´t care about adding the new object to the scene here. this will be done as soon as it is pushed back to us from the server
   var db_entity = {
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
   dpd.objects.post (db_entity, function(res, error) {
      if (typeof error != "undefined")
         console.log("WorldServerClient.pushObject: ERROR in post: ", error);
      result = res;
   });
   return result;
}
