console.log("agents.onPut");

// does agent have messages in its outbox?
if (Array.isArray (this.outbox)) {
    for (var i in this.outbox) {
        console.log("handling message #", i);
        handleOutboxMessage (this, this.outbox[i]);
    }
    // remove message(s) from outbox
    console.log("flushing outbox");
    this.outbox = [];
    
    emit('agentChanged', this);
}



function handleOutboxMessage (curAgent, message) {
    // agent is sending out a message
    if (typeof message.recipients == "undefined")
        message.recipients = "*";
    if (message.recipients == "*") {
        // message is a broadcast
        if (typeof message.radius != "number")
            message.radius = 100; // default message radius: 100m
        else if (message.radius < 0)
            message.radius = 100;
        else if (message.radius > 10000) // max radius: 10km
            message.radius = 10000;
        // query agents in the given radius
		dpd.agents.get(
            {location : {"$near":{"$maxDistance":message.radius,"$geometry":curAgent.location}}},
			function(agents, error) { //Use dpd.js to access the API
				console.log("Agents in area: ", agents);
				for (var j in agents) {
                    if (agents[j].id != curAgent.id) {
                        // send message to agent
                        if (!Array.isArray(agents[i].inbox)) {
                            agents[j].inbox = [];
                        }
                        var msg = message;
                        msg.sender = curAgent.id;
                        agents[j].inbox.push(msg);
                        console.log("message sent to agent " + agents[j].id);
                    }
				}
				console.log("done sending to nearby agents");
			}
        );
    } else {
        // message goes to specific agent[s]
        if (Array.isArray(message.recipients)) {
            for (var i in message.recipients) {
                // send message to agent
                if (!Array.isArray(agents[j].inbox)) {
                    agents[j].inbox = [];
                }
                var msg = message;
                msg.sender = curAgent.id;
                agents[j].inbox.push(msg);
                console.log("message sent to agent " + agents[j].id);
            }
        }
    }
}
