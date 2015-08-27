var whapi = require("whatsapi");
var fs = require("fs");
var http = require("http")
var stream = require("stream").Transform
var events = require("events");


var hadLinebreak = true;
var pluginList;

var homegroup;

global.settings;
global.bot = new events.EventEmitter();
global.print = function print(text, linebreak, format) {
    linebreak = typeof linebreak !== "undefined"? linebreak : true;
    format = typeof format !== "undefined" ? format : true;

    if (format) {
        if (!hadLinebreak) {
            process.stdout.write("\n\r")
        }

        var d = new Date()
        var h = (d.getHours() < 10 ? "0" : "") + d.getHours()
        var m = (d.getMinutes() < 10 ? "0" : "") + d.getMinutes()
        var s = (d.getSeconds() < 10 ? "0" : "") + d.getSeconds()
        process.stdout.write("[" + h + ":" + m + ":" + s + "] ")
    }

    process.stdout.write(text + (linebreak ? "\n\r" : " "))
    hadLinebreak = linebreak
};

/**
 * INITIALIZATION
 */
// LOAD SETTINGS
try {
    settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'))
} catch (err) {
    print("could not load settings file");
    process.exit();
}
print("Settings loaded");
// LOAD PLUGINS
try {
    pluginList = fs.readdirSync("plugins")
} catch (err) {
    pluginList = false;
    print("Could not load contents of plugin folder");
    process.exit();
}
if (pluginList) {
    if (pluginList.length == 0) {
        print("No plugins found")
    }
    else {
        for (var i = 0; i < pluginList.length; i++) {
            print("Loading " + pluginList[i] + "...")

            try {
                require("./plugins/" + pluginList[i])
            } catch (err) {
                print("Plugin " + pluginList[i] + " crashed with the following error:")
                console.log(err.stack);
            }
        }
    }

    print("All plugins loaded")
}
print("Plugins loaded");
//WHATSAPI INIT
var wa = whapi.createAdapter({
    msisdn: settings["telnumber"], // phone number with country code
    username: settings["displayname"], // your name on WhatsApp
    password: settings["whatsapp_pass"], // WhatsApp password
    ccode: '44' // country code
});

wa.connect(function connected(err) {
    if (err) { console.log(err); return; }
    print('Connected');
    // Now login
    wa.login(logged);
});

function logged(err) {
    if (err) { console.log(err); return; }
    print('Logged in to WA server');
    wa.sendIsOnline();
    print("Getting groups");

    wa.requestGroupsList(function(err, groups) {
        groups.forEach(function(g) {
            print('Name: ' + g.subject + ', Participants: ' + g.participants.length);

            //recognize main beta group
            if(g.groupId == settings["group_id"]){
                homegroup = g;
                //console.log(g);
                //console.log(homegroup);
                print("Found squadbot's home group");
            }
        });

        if(!homegroup) {
            print("could not find group...")
            process.exit();
        }

        wa.on('receivedMessage', function(message) {
            parseMessage(message);
            wa.sendMessageReceipt(message);
        });

        wa.on("receivedLocation", function(loc) {
            bot.emit("location", loc)
        });
    });

}

/*
 API FUNCTIONS
 */
function parseMessage(msg) {
    if (msg.body.substring(0, 1) == "!" || msg.body.substring(0, 1) == "/") {
        var parts = msg.body.substring(1).split(" ");
        bot.emit("command", parts[0].toLowerCase(), parts.slice(1))
    } else {
        bot.emit("message", msg.body, msg);
    }
}

function handleReceivedEvents(id, emitter, err, deleteTmp) {
    if (err) {
        console.log(err.message);
        return; 
    }
    
    emitter.emit("send")
    
    wa.on("clientReceived", function(args) {
        if (args.id == id) {
            emitter.emit(args.type, args.from, args.time)
        }
    })
    
    if (deleteTmp) {
        fs.unlink("tmp", function() {})
    }
}

var sendMessage = function(msg) {
    emitter = new events.EventEmitter();
    
    try {
        wa.sendMessage(settings["group_id"], msg, function(err, id) {handleReceivedEvents(id, emitter, err)});
    } catch (err) {
        emitter.emit("error", err)
    } 
    
    return emitter
};

var sendImage = function(image, caption) {
    emitter = new events.EventEmitter();
    
    try {
        if (image.substring(0, 7) == "http://") {
            http.request(image, function(response) {
    			var data = new stream()
    			
    			response.on("data", function(chunk) {
    				data.push(chunk)
    			})
    			
    			response.on("end", function() { 
    				fs.writeFileSync("tmp.jpg", data.read())
                    
                    wa.sendImage(settings["group_id"], "./tmp.jpg", typeof caption === "string" ? caption : undefined, function(err, id) {
                        handleReceivedEvents(id, emitter, err, true)
                    });
    			});
    		}).end()
        }
        else {
            wa.sendImage(settings["group_id"], image, typeof caption === "string" ? caption : undefined, function(err, id) {
                handleReceivedEvents(id, emitter, err)
            });
        }
        
        
    } catch (err) {
        emitter.emit("error", err)
    } 
    
    return emitter
};

var getMembers = function (callback) {
    wa.requestGroupInfo(settings["group_id"], function(err, group) {
        if (!err) {
            try {
                callback(group.participants)
            } catch (err) {
                console.log(err.stack);
            }
        }
    });
};

global.api = {
    "send": sendMessage,
    "sendMessage": sendMessage, // Alias
    "sendImage": sendImage,
    "getMembers": getMembers,
    "getName": function(id) {return id.split("@")[0]} // TODO
};