var Step = require("step"),
    mod = require("../../lib/app"),
    makeApp = mod.makeApp;

var config = {driver: "memory",
              params: {},
              nologger: true},
    app = null,
    i,
    parts;

process.env.NODE_ENV = "test";

for (i = 2; i < process.argv.length; i++) {
    parts = process.argv[i].split("=");
    config[parts[0]] = parts[1];
}

config.port = parseInt(config.port, 10);

Step(
    function() {
        makeApp(config, this);
    },
    function(err, res) {
        if (err) throw err;
        app = res;
        app.run(this);
    },
    function(err) {
        if (err) {
            process.send({tag: "error", value: err});
        } else {
            process.send({tag: "listening"});
        }
    }
);
