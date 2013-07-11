// app.js
//
// main function for activity pump application
//
// Copyright 2011-2012, E14N https://e14n.com/
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

var urlparse = require("url").parse,
    auth = require("connect-auth"),
    Step = require("step"),
    databank = require("databank"),
    express = require("express"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    Logger = require("bunyan"),
    uuid = require("node-uuid"),
    DialbackClient = require("dialback-client"),
    api = require("../routes/api"),
    web = require("../routes/web"),
    shared = require("../routes/shared"),
    webfinger = require("../routes/webfinger"),
    clientreg = require("../routes/clientreg"),
    oauth = require("../routes/oauth"),
    confirm = require("../routes/confirm"),
    uploads = require("../routes/uploads"),
    schema = require("./schema").schema,
    HTTPError = require("./httperror").HTTPError,
    Provider = require("./provider").Provider,
    URLMaker = require("./urlmaker").URLMaker,
    rawBody = require("./rawbody").rawBody,
    Distributor = require("./distributor"),
    pumpsocket = require("./pumpsocket"),
    Firehose = require("./firehose"),
    Mailer = require("./mailer"),
    version = require("./version").version,
    Credentials = require("./model/credentials").Credentials,
    Nonce = require("./model/nonce").Nonce,
    Image = require("./model/image").Image,
    Proxy = require("./model/proxy").Proxy,
    ActivitySpam = require("./activityspam"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    DatabankStore = require('connect-databank')(express);

var makeApp = function(config, callback) {

    var params,
        defaults = {port: 31337,
                    hostname: "127.0.0.1",
                    site: "pump.io",
                    sockjs: true,
                    debugClient: false,
                    firehose: "ofirehose.com",
                    requireEmail: false,
                    disableRegistration: false,
                    compress: false,
                    urlPort: null,
                    urlPath: null,
                    plugins: [],
                    scripts: [],
                    proxyWhitelist: [],
                    redirectToCanonical: true,
                    redirectAddressToCanonical: false,
		    clients: []},
        port,
        hostname,
        address,
        log,
        db,
        logParams = {
            name: "pump.io",
            serializers: {
                req: Logger.stdSerializers.req,
                res: Logger.stdSerializers.res,
                principal: function(principal) {
                    if (principal) {
                        return {id: principal.id, type: principal.objectType};
                    } else {
                        return {id: "<none>"};
                    }
                },
                client: function(client) {
                    if (client) {
                        return {key: client.consumer_key, title: client.title || "<none>"};
                    } else {
                        return {key: "<none>", title: "<none>"};
                    }
                }
            }
        },
        plugins = {};

    // Fill in defaults if they're not there

    config = _.defaults(config, defaults);

    port     = config.port;
    hostname = config.hostname;
    address  = config.address || config.hostname;

    if (process.getuid) {
        if (port < 1024 && process.getuid() !== 0) {
            callback(new Error("Can't listen to ports lower than 1024 on POSIX systems unless you're root."), null);
            return;
        }
    }

    if (config.logfile) {
        logParams.streams = [{path: config.logfile}];
    } else if (config.nologger) {
        logParams.streams = [{path: "/dev/null"}];
    } else {
        logParams.streams = [{stream: process.stderr}];
    }

    log = new Logger(logParams);

    log.info("Initializing pump.io");

    // Initialize plugins

    _.each(config.plugins, function(pluginName) {
        log.info({plugin: pluginName}, "Initializing plugin.");
        plugins[pluginName] = require(pluginName);
        if (_.isFunction(plugins[pluginName].initializeLog)) {
            plugins[pluginName].initializeLog(log);
        }
    });

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

    // So they can add their own types to the schema

    _.each(plugins, function(plugin, name) {
        if (_.isFunction(plugin.initializeSchema)) {
            log.info({plugin: name}, "Initializing schema.");
            plugin.initializeSchema(params.schema);
        }
    });

    db = Databank.get(config.driver, params);

    // Connect...

    log.info("Connecting to databank with driver '"+config.driver+"'");

    db.connect({}, function(err) {

        var useHTTPS = _(config).has('key'),
            useBounce = _(config).has('bounce') && config.bounce,
            app,
            io,
            bounce,
            dialbackClient,
            requestLogger = function(log) {
                return function(req, res, next) {
                    var weblog = log.child({"req_id": uuid.v4(), component: "web"});
                    var end = res.end,
                        startTime = Date.now();
                    req.log = weblog;
                    res.end = function(chunk, encoding) {
                        var rec, endTime;
                        res.end = end;
                        res.end(chunk, encoding);
                        endTime = Date.now();
                        rec = {req: req, res: res, serverTime: endTime - startTime};
                        if (_(req).has("principal")) {
                            rec.principal = req.principal;
                        }
                        if (_(req).has("client")) {
                            rec.client = req.client;
                        }
                        weblog.info(rec);
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

        app.config = config;

        if (config.smtpserver) {
            // harmless flag
            config.haveEmail = true;
            Mailer.setup(config, log);
        }

        var workers = config.workers || 1;
        var cleanupTime = 1200 * workers * 1000;
        var dbstore = new DatabankStore(db, log, cleanupTime);

        if (!_(config).has("noweb") || !config.noweb) {
            app.session = express.session({secret: (_(config).has('sessionSecret')) ? config.sessionSecret : "insecure",
                                           store: dbstore});
        }

        // Configuration

        app.configure(function() {

            var serverVersion = 'pump.io/'+version + ' express/'+express.version + ' node.js/'+process.version,
                versionStamp = function(req, res, next) {
                    res.setHeader('Server', serverVersion);
                    next();
                },
                canonicalHost = function(req, res, next) {
                    var host = req.header('Host'),
                        urlHost,
                        addressHost;

                    if (!config.redirectToCanonical || !host) {
                        next();
                        return;
                    }

                    urlHost = URLMaker.makeHost();

                    if (host == urlHost) {
                        next();
                        return;
                    }

                    if (!config.redirectAddressToCanonical) {

                        addressHost = URLMaker.makeHost(address, port);

                        if (host == addressHost) {
                            next();
                            return;
                        }
                    }

                    res.redirect(URLMaker.makeURL(req.url), 301);
                };

            // Templates are in public
            app.set("views", __dirname + "/../public/template");
            app.set("view engine", "utml");

            app.use(requestLogger(log));

            if (config.redirectToCanonical) {
                app.use(canonicalHost);
            }

            app.use(rawBody);

            app.use(express.bodyParser());
            app.use(express.cookieParser());
            app.use(express.query());
            app.use(express.methodOverride());
            app.use(express.favicon());

            if (config.compress) {
                app.use(express.compress());
            }

            app.use(versionStamp);

            app.provider = new Provider(log, config.clients);

            // Initialize scripts

            _.each(config.plugins, function(pluginName) {
                var script;
                if (_.isFunction(plugins[pluginName].getScript)) {
                    script = plugins[pluginName].getScript();
                    log.info({plugin: pluginName, script: script}, "Adding script");
                    config.scripts.push(script);
                }
            });

            app.use(function(req, res, next) {
                res.local("config", config);
                res.local("data", {});
                res.local("page", {url: req.originalUrl});
                res.local("template", {});
                // Initialize null
                res.local("principalUser", null);
                res.local("principal", null);
                res.local("user", null);
                res.local("client", null);
                res.local("nologin", false);
                res.local("version", version);
                res.local("messages", {items: []});
                res.local("notifications", {items: []});
                next();
            });

            app.use(auth([auth.Oauth({name: "client",
                                      realm: "OAuth",
                                      oauth_provider: app.provider,
                                      oauth_protocol: (useHTTPS) ? 'https' : 'http',
                                      authenticate_provider: null,
                                      authorize_provider: null,
                                      authorization_finished_provider: null
                                     }),
                          auth.Oauth({name: "user",
                                      realm: "OAuth",
                                      oauth_provider: app.provider,
                                      oauth_protocol: (useHTTPS) ? 'https' : 'http',
                                      authenticate_provider: oauth.authenticate,
                                      authorize_provider: oauth.authorize,
                                      authorization_finished_provider: oauth.authorizationFinished
                                     })
                         ]));

            app.use(express["static"](__dirname + "/../public"));

            app.use(app.router);

        });

        app.error(function(err, req, res, next) {
            log.error(err);
            if (err instanceof HTTPError) {
                if (req.xhr || req.originalUrl.substr(0, 5) === '/api/') {
                    res.json({error: err.message}, err.code);
                } else if (req.accepts("html")) {
                    res.status(err.code);
                    res.render("error", {page: {title: "Error"},
                                         error: err});
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
        clientreg.addRoutes(app);
        shared.addRoutes(app);

        if (_.has(config, "uploaddir")) {
            // Simple boolean flag
            config.canUpload = true;
            uploads.addRoutes(app);
            Image.uploadDir = config.uploaddir;
        }

        if (config.requireEmail) {
            confirm.addRoutes(app);
        }

        // Use "noweb" to disable Web site (API engine only)

        if (!_(config).has("noweb") || !config.noweb) {
            web.addRoutes(app);
        } else {
            // A route to show the API doc at root
            app.get("/", function(req, res, next) {

                var Showdown = require("showdown"),
                    converter = new Showdown.converter();

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
                            html = converter.makeHtml(markdown);
                            res.render("doc", {page: {title: "API"},
                                               html: html});
                        }
                    }
                );
            });
        }

        DatabankObject.bank = db;

        URLMaker.hostname = hostname;
        URLMaker.port = (config.urlPort) ? config.urlPort : port;
        URLMaker.path = config.urlPath;

        Distributor.log = log.child({component: "distributor"});

        Distributor.plugins = _.filter(plugins, function(plugin) {
            return _.isFunction(plugin.distributeActivity) || _.isFunction(plugin.distributeToPerson);
        });

        if (_(config).has('serverUser')) {
            app.on('listening', function() {
                process.setuid(config.serverUser);
            });
        }

        if (config.sockjs) {
            pumpsocket.connect(app, log);
        }

        if (config.firehose) {
            log.info({firehose: config.firehose}, "Setting up firehose");
            Firehose.setup(config.firehose, log);
        }

        if (config.spamhost) {
            if (!config.spamclientid ||
                !config.spamclientsecret) {
                throw new Error("Need client ID and secret for spam host");
            }
            log.info({spamhost: config.spamhost}, "Configuring spam host");
            ActivitySpam.init({
                host: config.spamhost,
                clientID: config.spamclientid,
                clientSecret: config.spamclientsecret,
                logger: log
            });
        }

        dialbackClient = new DialbackClient({
            hostname: hostname,
            bank: db,
            app: app,
            url: "/api/dialback"
        });

        Credentials.dialbackClient = dialbackClient;

        // Each worker takes a turn cleaning up, so *this* worker does
        // its cleanup once every config.workers cleanup periods

        // We set a timer so we start with an offset, instead of having
        // all workers start at almost the same time

        setTimeout(function() {
            log.info("Cleaning up old OAuth nonces");
            Nonce.cleanup();
            setInterval(function() {
                log.info("Cleaning up old OAuth nonces");
                Nonce.cleanup();
            }, cleanupTime);
        }, Math.floor(Math.random() * cleanupTime));

        Proxy.whitelist = app.config.proxyWhitelist;

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
                        bounce.listen(80, address);
                    } else {
                        callback(null);
                    }
                };
            this.on("error", listenErrorHandler);
            this.on("listening", listenSuccessHandler);
            log.info("Listening on "+port+" for host " + address);
            this.listen(port, address);
        };

        // So they can add their own routes or other stuff to the app

        _.each(plugins, function(plugin, name) {
            if (_.isFunction(plugin.initializeApp)) {
                log.info({plugin: name}, "Initializing app.");
                plugin.initializeApp(app);
            }
        });

        callback(null, app);
    });
};

exports.makeApp = makeApp;
