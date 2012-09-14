var Step = require("step"),
    mod = require("../../lib/app"),
    makeApp = mod.makeApp;

var config = {driver: "memory",
              params: {},
              nologger: true},
    app = null;

process.env.NODE_ENV = "test";

config.hostname = process.argv[2],
config.port = parseInt(process.argv[3], 10);

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
