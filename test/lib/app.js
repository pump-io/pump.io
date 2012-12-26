var Step = require("step"),
    cluster = require("cluster"),
    mod = require("../../lib/app"),
    fs = require("fs"),
    path = require("path"),
    Dispatch = require("../../lib/dispatch"),
    makeApp = mod.makeApp;

var tc = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "config.json")));

var config = {driver: tc.driver,
              params: tc.params,
              sockjs: false,
              nologger: true},
    app = null,
    i,
    parts,
    worker;

process.env.NODE_ENV = "test";

for (i = 2; i < process.argv.length; i++) {
    parts = process.argv[i].split("=");
    config[parts[0]] = parts[1];
}

config.port = parseInt(config.port, 10);

if (cluster.isMaster) {
    worker = cluster.fork();
    worker.on("message", function(msg) {
        console.dir(msg);
        switch (msg.cmd) {
        case "error":
        case "listening":
            process.send(msg);
            break;
        default:
            break;
        }
    });
    Dispatch.start();
} else {
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
                process.send({cmd: "error", value: err});
            } else {
                process.send({cmd: "listening"});
            }
        }
    );
}