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
              firehose: false,
              sockjs: false,
              noCDN: true,
              debugClient: true,
              nologger: true},
    app = null,
    i,
    parts,
    worker;

process.env.NODE_ENV = "test";

for (i = 2; i < process.argv.length; i++) {
    parts = process.argv[i].split("=");
    config[parts[0]] = JSON.parse(parts[1]);
}

config.port = parseInt(config.port, 10);

if (cluster.isMaster) {
    worker = cluster.fork();
    worker.on("message", function(msg) {
        switch (msg.cmd) {
        case "error":
        case "listening":
        case "credkilled":
            process.send(msg);
            break;
        default:
            break;
        }
    });
    Dispatch.start();
    process.on("message", function(msg) {
        switch (msg.cmd) {
        case "killcred":
            worker.send(msg);
            break;
        }
    });
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

    // This is to simulate losing the credentials of a remote client
    // It's hard to do without destroying the database values directly,
    // so we essentially do that.

    process.on("message", function(msg) {
        switch (msg.cmd) {
        case "killcred":
            Step(
                function() {
                    var client = require("../../lib/model/client"),
                        Client = client.Client;
                    Client.search({webfinger: msg.webfinger}, this);
                },
                function(err, results) {
                    if (err) throw err;
                    if (!results || results.length !== 1) {
                        throw new Error("Bad results");
                    }
                    results[0].del(this);
                },
                function(err) {
                    if (err) {
                        process.send({cmd: "credkilled", error: err.message, webfinger: msg.webfinger});
                    } else {
                        process.send({cmd: "credkilled", webfinger: msg.webfinger});
                    }
                }
            );
        }
    });
}
