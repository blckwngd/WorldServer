emit('agents:changed', this);
// check if objects are attached
var currentAgent = this; // fool the closure

dpd.objects.get({owner: this.id}, function(objectsToUpdate) {
    
    for (var i=0; i<objectsToUpdate.length; i++) {
        objectsToUpdate[i].location = currentAgent.location;
        emit('objects:changed', objectsToUpdate[i]);
    }
});