var fs = require("fs");
var events = require("events");
var emoji = require("./emoji");
var plugins = require("./pluginmanager");

global.bot = new events.EventEmitter()

/**
 * parses emoji strings to unicode characters
 *
 * @param msg stringe to parse emojis from
 * @returns msg string with emoji unicode chars
 */
global.encodeEmoji = function(msg) {return emoji.parse(msg) };

/**
 * Prints a fancier line to the console
 *
 * @param text
 * @param color
 */
global.print = function print(text, color) {
    var output = ""
    
    if (color) {
        output += '\033[31m'
    }
    
    var d = new Date()
    var h = (d.getHours() < 10 ? "0" : "") + d.getHours()
    var m = (d.getMinutes() < 10 ? "0" : "") + d.getMinutes()
    var s = (d.getSeconds() < 10 ? "0" : "") + d.getSeconds()
    
    output += "[" + h + ":" + m + ":" + s + "] " + text
    
    if (color) {
        output += '\033[0m'
    }
    
    console.log(output);
};


/**
 * SETTINGS (initializes settings.json)
 */
try {
    global.settings = JSON.parse(fs.readFileSync("settings.json", "utf8"))

    bot.setMaxListeners(settings["max_event_listeners"]);
} 
catch (err) {
    print("Could not load settings file", "red");
    process.exit();
}

require("./spm.js");

/**
 * Fired when the protocol is done loading
 */
bot.on("loadingProtocolDone", function() {
    print("Protocol loaded, loading plugins");
    //lets start the pluginmanager
    plugins.init(settings["plugin_folder"]);
})
