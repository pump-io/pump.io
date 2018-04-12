// app.js
//
// main function for activity pump application
//
// Copyright 2011-2013, E14N https://e14n.com/
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

"use strict";

var urlparse = require("url").parse,
    auth = require("connect-auth-pumpio"),
    Step = require("step"),
    databank = require("databank"),
    express = require("express"),
    methodOverride = require("method-override"),
    _ = require("lodash"),
    fs = require("fs"),
    path = require("path"),
    Logger = require("bunyan"),
    uuid = require("uuid"),
    validator = require("validator"),
    DialbackClient = require("dialback-client"),
    helmet = require("helmet"),
    multiparty = require("connect-multiparty"),
    sslConfig = require("ssl-config")("intermediate"),
    expressSession = require("express-session"),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser"),
    compression = require("compression"),
    favicon = require("serve-favicon"),
    api = require("../routes/api"),
    activitypub = require("../routes/activitypub"),
    web = require("../routes/web"),
    shared = require("../routes/shared"),
    webfinger = require("../routes/webfinger"),
    clientreg = require("../routes/clientreg"),
    oauth = require("../routes/oauth"),
    oauth2 = require("../routes/oauth2"),
    confirm = require("../routes/confirm"),
    uploads = require("../routes/uploads"),
    schema = require("./schema").schema,
    HTTPError = require("./httperror").HTTPError,
    Provider = require("./provider").Provider,
    URLMaker = require("./urlmaker").URLMaker,
    rawBody = require("./rawbody").rawBody,
    defaults = require("./defaults"),
    Distributor = require("./distributor"),
    pumpsocket = require("./pumpsocket"),
    Firehose = require("./firehose"),
    Mailer = require("./mailer"),
    version = require("./version").version,
    Upgrader = require("./upgrader"),
    Credentials = require("./model/credentials").Credentials,
    Nonce = require("./model/nonce").Nonce,
    Image = require("./model/image").Image,
    Proxy = require("./model/proxy").Proxy,
    ActivitySpam = require("./activityspam"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    DatabankStore = require("connect-databank")(expressSession),
    http = require("http"),
    https = require("https"),
    xssCheck = require("./xssblacklist"),
    cluster = require("cluster"),
    Client = require("./model/client").Client,
    User = require("./model/user").User,
    AccessToken = require("./model/accesstoken").AccessToken,
    BearerToken = require("./model/bearertoken").BearerToken,
    negotiate = require("./negotiate");

var makeApp = function(configBase, callback) {

    var params,
        port,
        hostname,
        address,
        log,
        db,
        session,
        logParams = {
            name: "pump.io",
            serializers: {
                req: Logger.stdSerializers.req,
                res: Logger.stdSerializers.res,
                err: function(err) {
                    var obj = Logger.stdSerializers.err(err);
                    // only show properties without an initial underscore
                    return _.pickBy(obj, _.filter(_.keys(obj), function(key) { return key[0] !== "_"; }));
                },
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
        plugins = {},
        config,
        warnInternalConfig = function(key) {
            log.warn("`" + key + "` is an internal config value which will be overwritten and have no effect");
        };

    // Copy the base config and insert defaults

    config = _.clone(configBase);
    config = _.defaults(config, defaults);

    port     = config.port;
    hostname = config.hostname;
    address  = config.address || config.hostname;

    config.nicknameBlacklist = require("./nicknameblacklist");

    // Throw on configs written for < 3.x

    if (config.uploaddir) throw new Error("`uploaddir` is no longer supported; see the pump.io 3.x release notes");

    if (config.enableUploads) {
        if (!config.datadir) throw new Error("Uploads enabled but no `datadir` specified");
        config.uploaddir = path.join(config.datadir, "uploads");
    }

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

    logParams.streams[0].level = config.logLevel;

    log = new Logger(logParams);

    log.debug("Initializing pump.io");

    // Warn if the user has a dumb config

    if (configBase.nicknameBlacklist) warnInternalConfig("nicknameBlacklist");
    if (configBase.canUpload) warnInternalConfig("canUpload");
    if (configBase.haveEmail) warnInternalConfig("haveEmail");
    if (!configBase.secret || configBase.secret === "my dog has fleas") {
        log.warn("`config.secret` is either unset or set to the sample value; this is very insecure and should be changed ASAP");
    }

    // Initialize plugins

    _.each(config.plugins, function(pluginName) {
        log.debug({plugin: pluginName}, "Initializing plugin.");
        plugins[pluginName] = require(pluginName);
        if (_.isFunction(plugins[pluginName].initializeLog)) {
            plugins[pluginName].initializeLog(log);
        }
    });

    // Initiate the DB

    if (config.params) {
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
            log.debug({plugin: name}, "Initializing schema.");
            plugin.initializeSchema(params.schema);
        }
    });

    db = Databank.get(config.driver, params);

    // Connect...

    log.debug("Connecting to databank with driver '"+config.driver+"'");

    db.connect({}, function(err) {

        var useHTTPS = config.key,
            useBounce = config.bounce,
            app = express(),
            appServer,
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
            log.debug("Setting up HTTPS server.");
            appServer = https.createServer({key: fs.readFileSync(config.key),
                                            cert: fs.readFileSync(config.cert),
                                            ciphers: sslConfig.ciphers,
                                            honorCipherOrder: true,
                                            secureOptions: sslConfig.minimumTLSVersion}, app);

            if (useBounce) {
                log.debug("Setting up micro-HTTP server to bounce to HTTPS.");
                bounce = http.createServer(function(req, res) {
                    var host = req.headers.host;
                    res.statusCode = 301;
                    res.setHeader("Location", "https://"+host+req.url);
                    res.end();
                });
            }

        } else {
            log.debug("Setting up HTTP server.");
            appServer = http.createServer(app);
        }

        if (cluster.worker) {
          cluster.worker.on("message", function(msg) {
              if (msg.cmd === "gracefulShutdown") {
                  log.debug("Shutting down worker due to zero-downtime restart request.");
                  appServer.close(function() {
                      db.disconnect(function() {
                          cluster.worker.disconnect();
                      });
                  });

                  // This doesn't need to be in the above callback chain because it doesn't interact with anything
                  if (useBounce) {
                      bounce.close();
                  }
              }
          });
        }

        app.config = config;

        appServer.on("close", function() {
            clearInterval(dialbackClient.cleanup);
            if (nonceCleanerInterval) {
                clearInterval(nonceCleanerInterval);
            }
            if (nonceCleanerTimeout) {
                clearTimeout(nonceCleanerTimeout);
            }
            dbstore.close();
        });

        if (config.smtpserver) {
            // harmless flag
            config.haveEmail = true;
            Mailer.setup(config, log);
        }

        var workers = config.workers || 1;

        // Each worker takes a turn cleaning up, so *this* worker does
        // its cleanup once every config.workers cleanup periods
        var dbstore = new DatabankStore(db, log, (config.cleanupSession) ? (config.cleanupSession * workers) : 0);

        if (!config.noweb) {
            session = expressSession({secret: config.secret || "insecure",
                                      store: dbstore,
                                      saveUninitialized: false,
                                      resave: false});
            // XXX this is terrible design but we're doing it for now because there's some old code that expects things to work this way
            app.sessionMiddleware = session;
        }

        // Configuration

        var expressVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "../node_modules/express/package.json"))).version,
            serverVersion = "pump.io/"+version + " express/"+expressVersion + " node.js/"+process.version,
            versionStamp = function(req, res, next) {
                res.setHeader("Server", serverVersion);
                next();
            },
            canonicalHost = function(req, res, next) {
                var host = req.header("Host"),
                    urlHost,
                    addressHost;

                if (!config.redirectToCanonical || !host) {
                    next();
                    return;
                }

                urlHost = URLMaker.makeHost();

                if (host === urlHost) {
                    next();
                    return;
                }

                if (!config.redirectAddressToCanonical) {

                    addressHost = URLMaker.makeHost(address, port);

                    if (host === addressHost) {
                        next();
                        return;
                    }
                }

                res.redirect(301, URLMaker.makeURL(req.url));
            };

        // Templates are in public
        app.set("views", path.resolve(__dirname, "../public/template"));
        app.engine("jade", require("jade").renderFile);
        app.set("view engine", "jade");

        app.use(requestLogger(log));

        if (config.redirectToCanonical) {
            app.use(canonicalHost);
        }

        app.use(rawBody);

        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({extended: true}));
        // TODO: use the multiparty API directly instead of this Connect middleware wrapper
        // Or perhaps `multer`? That's what the Express migration docs recommend
        app.use(multiparty());
        app.use(cookieParser());
        app.use(express.query());
        app.use(methodOverride());

        // ^ INPUTTY
        // v OUTPUTTY

        URLMaker.hostname = hostname;
        URLMaker.port = (config.urlPort) ? config.urlPort : port;
        URLMaker.path = config.urlPath;

        if (config.compress) {
            app.use(compression());
        }

        app.use(versionStamp);

        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    "default-src": ["'self'"],
                    "connect-src": ["'self'", (useHTTPS ? "wss://" : "ws://") + URLMaker.makeHost()],
                    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"].concat(config.noCDN ? [] : ["cdnjs.cloudflare.com"]),
                    "style-src": ["'self'", "'unsafe-inline'"].concat(config.noCDN ? [] : ["cdnjs.cloudflare.com", "maxcdn.bootstrapcdn.com"]),
                    "font-src": ["'self'"].concat(config.noCDN ? [] : ["cdnjs.cloudflare.com"]),
                    "img-src": ["*"],
                    "object-src": ["'none'"],
                    "media-src": ["*"],
                    "child-src":  ["'self'", "www.youtube.com"],
                    "frame-ancestors": ["'none'"]
                }
            },
            dnsPrefetchControl: false,
            frameguard: {action: "deny"},
            hidePoweredBy: false,
            hsts: config.hsts
        }));

        app.use(express.static(path.resolve(__dirname, "../public")));

        // Default is in public/images/favicon.ico
        // Can be overridden by a config setting

        app.use(favicon(config.favicon));

        app.provider = new Provider(log, config.clients);

        // Initialize scripts

        _.each(config.plugins, function(pluginName) {
            var script;
            if (_.isFunction(plugins[pluginName].getScript)) {
                script = plugins[pluginName].getScript();
                log.debug({plugin: pluginName, script: script}, "Adding script");
                config.scripts.push(script);
            }
        });

        // defangs interpolated data objects

        var defang = function(obj) {
            var dup = _.clone(obj);
            _.each(dup, function(value, name) {
                if (name === "displayName" && _.isString(value)) {
                    dup[name] = validator.escape(value);
                } else if (_.isFunction(value)) {
                    delete dup[name];
                } else if (_.isObject(value)) {
                    dup[name] = defang(value);
                }
            });
            return dup;
        };

        app.use(function(req, res, next) {
            res.locals.config = config;
            res.locals.data = {};
            res.locals.page = {url: req.originalUrl};
            res.locals.template = {};
            // Initialize null
            res.locals.principalUser = null;
            res.locals.principal = null;
            res.locals.user = null;
            res.locals.client = null;
            res.locals.nologin = false;
            res.locals.version = version;
            res.locals.messages = {items: []};
            res.locals.notifications = {items: []};
            res.locals.defang = defang;
            // Useful things
            res.locals.version = version;
            res.locals._ = _;
            next();
        });

        app.use(auth([auth.Oauth({name: "client",
                                  realm: "OAuth",
                                  oauth_provider: app.provider,
                                  oauth_protocol: (useHTTPS) ? "https" : "http",
                                  authenticate_provider: null,
                                  authorize_provider: null,
                                  authorization_finished_provider: null
                                 }),
                      auth.Oauth({name: "user",
                                  realm: "OAuth",
                                  oauth_provider: app.provider,
                                  oauth_protocol: (useHTTPS) ? "https" : "http",
                                  authenticate_provider: oauth.authenticate,
                                  authorize_provider: oauth.authorize,
                                  authorization_finished_provider: oauth.authorizationFinished
                                 })
                     ]));

        app.use(xssCheck.xssCheck);

        // Routes

        // It does seem to matter in which order they are put
        webfinger.addRoutes(app, session);
        api.addRoutes(app, session);
        activitypub.addRoutes(app);
        clientreg.addRoutes(app, session);
        shared.addRoutes(app, session);
        oauth2.addRoutes(app, session);

        if (config.uploaddir) {
            // Simple boolean flag
            config.canUpload = true;
            uploads.addRoutes(app, session);
            Image.uploadDir = config.uploaddir;
        }

        if (config.requireEmail) {
            confirm.addRoutes(app, session);
        }

        // Use "noweb" to disable Web site (API engine only)

        if (!config.noweb) {
            web.addRoutes(app, session);
            // We do context negotation for this unique route
            app.get("/:nickname", session, negotiate({
                "application/ld+json; profile=\"https://www.w3.org/ns/activitystreams\"": api.profileStack,
                "application/activity+json": api.profileStack,
                html: web.profileStack
            }));
        } else {
            // No web, so this always does the API route
            app.get("/:nickname", api.profileStack);
            // A route to show the API doc at root
            app.get("/", function(req, res, next) {

                var showdown = require("showdown"),
                    converter = new showdown.Converter();

                Step(
                    function() {
                        fs.readFile(path.join(__dirname, "..", "API.md"), this);
                    },
                    function(err, data) {
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

        Distributor.log = log.child({component: "distributor"});

        Distributor.plugins = _.filter(plugins, function(plugin) {
            return _.isFunction(plugin.distributeActivity) || _.isFunction(plugin.distributeToPerson);
        });

        Upgrader.log = log.child({component: "upgrader"});

        if (config.serverUser) {
            appServer.on("listening", function() {
                process.setuid(config.serverUser);
            });
        }

        if (config.sockjs) {
            pumpsocket.connect(app, appServer, log);
        }

        if (config.firehose) {
            log.debug({firehose: config.firehose}, "Setting up firehose");
            Firehose.setup(config.firehose, log);
        }

        if (config.spamhost) {
            if (!config.spamclientid ||
                !config.spamclientsecret) {
                throw new Error("Need client ID and secret for spam host");
            }
            log.debug({spamhost: config.spamhost}, "Configuring spam host");
            ActivitySpam.init({
                host: config.spamhost,
                clientID: config.spamclientid,
                clientSecret: config.spamclientsecret,
                log: log
            });
        }

        dialbackClient = new DialbackClient({
            hostname: hostname,
            bank: db,
            app: app,
            url: "/api/dialback"
        });

        Credentials.dialbackClient = dialbackClient;

        // We set a timer so we start with an offset, instead of having
        // all workers start at almost the same time

        var nonceCleanerInterval,
            nonceCleanerTimeout;

        if (config.cleanupNonce) {
            nonceCleanerTimeout = setTimeout(function() {
                log.debug("Cleaning up old OAuth nonces");
                Nonce.cleanup();
                nonceCleanerInterval = setInterval(function() {
                    log.debug("Cleaning up old OAuth nonces");
                    Nonce.cleanup();
                }, config.cleanupNonce * (config.workers || 1));
            }, Math.floor(Math.random() * config.cleanupNonce * (config.workers || 1)));
        }

        Proxy.whitelist = app.config.proxyWhitelist;

        appServer.run = function(callback) {
            var self = this,
                removeListeners = function() {
                    self.removeListener("listening", listenSuccessHandler);
                    self.removeListener("err", listenErrorHandler);
                },
                listenErrorHandler = function(err) {
                    removeListeners();
                    log.error(err);
                    cluster.worker.send({msg: "abortRestart", err});
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
                        log.debug("Finished setting up bounce server.");
                        cluster.worker.send({msg: "listening"});
                        removeBounceListeners();
                        callback(null);
                    };

                    log.debug("Finished setting up main server.");

                    removeListeners();
                    if (useBounce) {
                        bounce.on("error", bounceError);
                        bounce.on("listening", bounceSuccess);
                        bounce.listen(80, address);
                    } else {
                        if (cluster.worker) {
                            cluster.worker.send({msg: "listening"});
                        }
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
                log.debug({plugin: name}, "Initializing app.");
                plugin.initializeApp(app);
            }
        });

        app.use(function(err, req, res, next) {
            log.error({err: err, req: req}, err.message);
            if (err instanceof HTTPError) {
                if (req.xhr || req.originalUrl.substr(0, 5) === "/api/") {
                    res.status(err.code).json({error: err.message});
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



        Step(
            function() {
                // Ensure test clients
                var group = this.group();
                if (!_.isArray(config.clients) || config.clients.length === 0) {
                    group()(null);
                } else {
                    log.warn("Creating configured clients; usually only for tests");
                    _.each(config.clients, function(props) {
                        var xprops = {
                            consumer_key: props.client_id,
                            secret: props.client_secret,
                            title: props.title,
                            description: props.description,
                            host: props.host
                        };
                        var client = new Client(xprops);
                        client.save(group());
                    });
                }
            },
            function() {
                if (err) throw err;
                // Ensure test users
                var group = this.group();
                if (!_.isArray(config.users) || config.users.length === 0) {
                    group()(null);
                } else {
                    log.warn("Creating configured users; usually only for tests");
                    _.each(config.users, function(props) {
                        Step(
                            function() {
                                User.get(props.nickname, this);
                            },
                            function(err, user) {
                                if (err) {
                                    if (err.name === "NoSuchThingError") {
                                        User.create(props, this);
                                    } else {
                                        throw err;
                                    }
                                } else {
                                    user.update(props, this);
                                }
                            },
                            function(err, user) {
                                if (err) throw err;
                                var group = this.group();
                                if (!_.isArray(props.tokens) || props.tokens.length === 0) {
                                    group()(null);
                                } else {
                                    _.each(props.tokens, function(tprops) {
                                        // BearerToken or AccessToken?
                                        if (tprops.scope || !tprops.token_secret) {
                                            var bprops = _.extend(tprops, {
                                                nickname: user.nickname
                                            });
                                            BearerToken.create(bprops, group());
                                        } else {
                                            var xprops = {
                                                username: user.nickname,
                                                access_token: tprops.token,
                                                token_secret: tprops.token_secret,
                                                consumer_key: tprops.client_id
                                            };
                                            AccessToken.create(xprops, group());
                                        }
                                    });
                                }
                            },
                            group()
                        );
                    });
                }
            },
            function(err) {
                if (err) throw err;
                this(null, appServer, bounce);
            },
            callback
        );

    });
};

exports.makeApp = makeApp;
