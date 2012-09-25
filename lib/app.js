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
    databank = require("databank"),
    express = require("express"),
    _ = require("underscore"),
    fs = require("fs"),
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
        db;

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

    db.connect({}, function(err) {

        var useHTTPS = _(config).has('key'),
            useBounce = _(config).has('bounce') && config.bounce,
            app,
            bounce;

        if (useHTTPS) {
            app = express.createServer({key: fs.readFileSync(config.key),
                                        cert: fs.readFileSync(config.cert)});

            if (useBounce) {
                bounce = express.createServer(function(req, res, next) {
                    var host = req.header('Host');
                    res.redirect('https://'+host+req.url, 301);
                });
            }

        } else {
            app = express.createServer();
        }

        if (err) {
            callback(err, null);
            return;
        }

        // Configuration

        app.configure(function() {

            // Templates are in public
            app.set("views", __dirname + "/../public/template");
            app.set("view engine", "utml");
            if (!_(config).has("nologger") || !config.nologger) {
                app.use(express.logger());
            }
            app.use(express.bodyParser());
            app.use(express.cookieParser());
            app.use(express.query());
            app.use(express.methodOverride());
            app.use(express.session({secret: (config.secret || "activitypump")}));
            app.use(express.favicon());

            var provider = new Provider();

            app.use(function(req, res, next) { 
                res.local("site", (config.site) ? config.site : "ActivityPump");
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
                                      oauth_provider: provider,
                                      oauth_protocol: (useHTTPS) ? 'https' : 'http',
                                      authenticate_provider: null,
                                      authorize_provider: null,
                                      authorization_finished_provider: null
                                     }),
                          auth.Oauth({name: "user",
                                      oauth_provider: provider,
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
                    callback(err);
                },
                listenSuccessHandler = function() {
                    var removeBounceListeners = function() {
                            bounce.removeListener("listening", bounceSuccess);
                            bounce.removeListener("err", bounceError);
                        },
                        bounceError = function(err) {
                            removeBounceListeners();
                            callback(err);
                        },
                        bounceSuccess = function() {
                            removeBounceListeners();
                            callback(null);
                        };
                        
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
            this.listen(port, hostname);
        };

        callback(null, app);
    });
};

exports.makeApp = makeApp;
