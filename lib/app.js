// app.js
//
// main function for activity pump application
//
// Copyright 2011-2012, StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var auth = require("connect-auth"),
    Step = require("step"),
    databank = require("databank"),
    express = require("express"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    Logger = require("bunyan"),
    uuid = require("node-uuid"),
    api = require("../routes/api"),
    web = require("../routes/web"),
    webfinger = require("../routes/webfinger"),
    clientreg = require("../routes/clientreg"),
    dialback = require("../routes/dialback"),
    oauth = require("../routes/oauth"),
    schema = require("./schema").schema,
    HTTPError = require("./httperror").HTTPError,
    Provider = require("./provider").Provider,
    URLMaker = require("./urlmaker").URLMaker,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var makeApp = function(config, callback) {

    var params,
        port = config.port || 31337,
        hostname = config.hostname || "127.0.0.1",
        address = config.address || hostname,
        log,
        db;

    if (config.logfile) {
        log = new Logger({
            name: "pump.io",
	    serializers: {
		req: Logger.stdSerializers.req,
		res: Logger.stdSerializers.res
	    },
            streams: [{path: config.logfile}]
        });
    } else if (config.nologger) {
        log = new Logger({
            name: "pump.io",
	    serializers: {
		req: Logger.stdSerializers.req,
		res: Logger.stdSerializers.res
	    },
            streams: [{path: "/dev/null"}]
        });
    } else {
        log = new Logger({
            name: "pump.io",
	    serializers: {
		req: Logger.stdSerializers.req,
		res: Logger.stdSerializers.res
	    },
            streams: [{stream: process.stderr}]
        });
    }
    
    log.info("Initializing pump.io");

    // Initiate the DB

    if (_(config).has("params")) {
        params = config.params;
    } else {
        params = {};
    }

    if (_(params).has("schema")) {
        _.extend(params.schema, schema);
    } else {
        params.schema = schema;
    }

    db = Databank.get(config.driver, params);

    // Connect...

    log.info("Connecting to databank with driver '"+config.driver+"'");

    db.connect({}, function(err) {

        var useHTTPS = _(config).has('key'),
            useBounce = _(config).has('bounce') && config.bounce,
            app,
            bounce,
            requestLogger = function(log) {
                return function(req, res, next) {
                    var weblog = log.child({"req_id": uuid.v4(), component: "web"});
	            var end = res.end;
                    req.log = log;
	            res.end = function(chunk, encoding) {
                        res.end = end;
                        res.end(chunk, encoding);
                        weblog.info({req: req, res: res});
	            };
	            next();
                };
            };

        if (err) {
            log.error(err);
            callback(err, null);
            return;
        }

        if (useHTTPS) {
            log.info("Setting up HTTPS server.");
            app = express.createServer({key: fs.readFileSync(config.key),
                                        cert: fs.readFileSync(config.cert)});

            if (useBounce) {
                log.info("Setting up micro-HTTP server to bounce to HTTPS.");
                bounce = express.createServer(function(req, res, next) {
                    var host = req.header('Host');
                    res.redirect('https://'+host+req.url, 301);
                });
            }

        } else {
            log.info("Setting up HTTP server.");
            app = express.createServer();
        }

        // Configuration

        app.configure(function() {

            // Templates are in public
            app.set("views", __dirname + "/../public/template");
            app.set("view engine", "utml");
            app.use(requestLogger(log));
            app.use(express.bodyParser());
            app.use(express.cookieParser());
            app.use(express.query());
            app.use(express.methodOverride());
            app.use(express.session({secret: (config.secret || "pump.io")}));
            app.use(express.favicon());

            app.provider = new Provider();

            app.use(function(req, res, next) { 
                res.local("site", (config.site) ? config.site : "pump.io");
                res.local("owner", (config.owner) ? config.owner : "Anonymous");
                res.local("ownerurl", (config.ownerURL) ? config.ownerURL : false);
                // Initialize null
                res.local("remoteUser", null);
                res.local("user", null);
                res.local("client", null);
                res.local("nologin", false);
                next();
            });

            app.use(auth([auth.Oauth({name: "client",
                                      oauth_provider: app.provider,
                                      oauth_protocol: (useHTTPS) ? 'https' : 'http',
                                      authenticate_provider: null,
                                      authorize_provider: null,
                                      authorization_finished_provider: null
                                     }),
                          auth.Oauth({name: "user",
                                      oauth_provider: app.provider,
                                      oauth_protocol: (useHTTPS) ? 'https' : 'http',
                                      authenticate_provider: oauth.authenticate,
                                      authorize_provider: oauth.authorize,
                                      authorization_finished_provider: oauth.authorizationFinished
                                     })
                         ]));

            app.use(app.router);

            app.use(express["static"](__dirname + "/../public"));

        });

        app.error(function(err, req, res, next) {
            if (err instanceof HTTPError) {
                if (req.xhr || req.originalUrl.substr(0, 5) === '/api/') {
                    res.json({error: err.message}, err.code);
                } else if (req.accepts("html")) {
                    res.render("error", {status: err.code, error: err, title: "Error"});
                } else {
                    res.writeHead(err.code, {"Content-Type": "text/plain"});
                    res.end(err.message);
                }
            } else {
                next(err);
            }
        });

        // Routes

        api.addRoutes(app);
        webfinger.addRoutes(app);
        dialback.addRoutes(app);
        clientreg.addRoutes(app);

        // Use "noweb" to disable Web site (API engine only)

        if (!_(config).has("noweb") || !config.noweb) {
            web.addRoutes(app);
        } else {
            // A route to show the API doc at root
            app.get("/", function(req, res, next) {

                var ghm = require("github-flavored-markdown");

                Step(
                    function() {
                        fs.readFile(path.join(__dirname, "..", "API.md"), this);
                    },
                    function (err, data) {
                        var html, markdown;
                        if (err) {
                            next(err);
                        } else {
                            markdown = data.toString();
                            html = ghm.parse(markdown);
                            res.render("doc", {html: html, title: "API"});
                        }
                    }
                );
            });
        }

        DatabankObject.bank = db;

        URLMaker.hostname = hostname;
        URLMaker.port = port;

        if (_(config).has('serverUser')) {
            app.on('listening', function() {
                process.setuid(config.serverUser);
            });
        }

        app.run = function(callback) {
            var self = this,
                removeListeners = function() {
                    self.removeListener("listening", listenSuccessHandler);
                    self.removeListener("err", listenErrorHandler);
                },
                listenErrorHandler = function(err) {
                    removeListeners();
                    log.error(err);
                    callback(err);
                },
                listenSuccessHandler = function() {
                    var removeBounceListeners = function() {
                        bounce.removeListener("listening", bounceSuccess);
                        bounce.removeListener("err", bounceError);
                    },
                        bounceError = function(err) {
                            removeBounceListeners();
                            log.error(err);
                            callback(err);
                        },
                        bounceSuccess = function() {
                            log.info("Finished setting up bounce server.");
                            removeBounceListeners();
                            callback(null);
                        };
                    
                    log.info("Finished setting up main server.");

                    removeListeners();
                    if (useBounce) {
                        bounce.on("error", bounceError);
                        bounce.on("listening", bounceSuccess);
                        bounce.listen(80, hostname);
                    } else {
                        callback(null);
                    }
                };
            this.on("error", listenErrorHandler);
            this.on("listening", listenSuccessHandler);
            log.info("Listening on "+port+" for host " + address);
            this.listen(port, address);
        };

        callback(null, app);
    });
};

exports.makeApp = makeApp;
