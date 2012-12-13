// pump.js
//
// Gigantoscript for the pump.io client UI
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

// XXX: this module has grown bit by bit, and needs to be broken up
// or I'm going to go crazy. Maybe models, views, and router + setup?
// Also consider requireJS and AMD

var Pump = (function(_, $, Backbone) {

    var searchParams = function(str) {
        var params = {},
            pl     = /\+/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
            pairs;

        if (!str) {
            str = window.location.search;
        }
        
        pairs = str.substr(1).split("&");

        _.each(pairs, function(pairStr) {
            var pair = pairStr.split("=", 2),
                key = decode(pair[0]),
                value = (pair.length > 1) ? decode(pair[1]) : null;
            
            params[key] = value;
        });

        return params;
    };

    var getContinueTo = function() {
        var sp = searchParams(),
            continueTo = (_.has(sp, "continue")) ? sp["continue"] : null;
        if (continueTo && continueTo.length > 0 && continueTo[0] == "/") {
            return continueTo;
        } else {
            return "";
        }
    };

    // Override backbone sync to use OAuth

    Backbone.sync = function(method, model, options) {

        var getValue = function(object, prop) {
            if (!(object && object[prop])) return null;
            return _.isFunction(object[prop]) ? object[prop]() : object[prop];
        };

        var methodMap = {
            'create': 'POST',
            'update': 'PUT',
            'delete': 'DELETE',
            'read':   'GET'
        };

        var type = methodMap[method];

        // Default options, unless specified.

        options = options || {};

        // Default JSON-request options.
        var params = {type: type, dataType: 'json'};

        // Ensure that we have a URL.

        if (!options.url) {
            params.url = (type == 'POST') ? getValue(model.collection, 'url') : getValue(model, 'url');
            if (!params.url || !_.isString(params.url)) { 
                throw new Error("No URL");
            }
        }

        // Ensure that we have the appropriate request data.
        if (!options.data && model && (method == 'create' || method == 'update')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(model.toJSON());
        }

        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !Backbone.emulateJSON) {
            params.processData = false;
        }

        Pump.ensureCred(function(err, cred) {
            var pair;
            if (err) {
                Pump.error("Error getting OAuth credentials.");
            } else {
                params = _.extend(params, options);

                params.consumerKey = cred.clientID;
                params.consumerSecret = cred.clientSecret;

                pair = Pump.getUserCred();

                if (pair) {
                    params.token = pair.token;
                    params.tokenSecret = pair.secret;
                }

                params = Pump.oauthify(params);

                $.ajax(params);
            }
        });

        return null;
    };

    var Pump = {};

    // When errors happen, and you don't know what to do with them,
    // send them here and I'll figure it out.

    Pump.error = function(err) {
        console.log(err);
    };

    Pump.oauthify = function(options) {

        if (options.url.indexOf(':') == -1) {
            if (options.url.substr(0, 1) == '/') {
                options.url = window.location.protocol + '//' + window.location.host + options.url;
            } else {
                options.url = window.location.href.substr(0, window.location.href.lastIndexOf('/') + 1) + options.url;
            }
        }

        var message = {action: options.url,
                       method: options.type,
                       parameters: [["oauth_version", "1.0"],
                                    ["oauth_consumer_key", options.consumerKey]]};

        if (options.token) {
            message.parameters.push(["oauth_token", options.token]);
        }

        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message,
                                   {consumerSecret: options.consumerSecret,
                                    tokenSecret: options.tokenSecret});

        var header =  OAuth.getAuthorizationHeader("OAuth", message.parameters);

        options.headers = {Authorization: header};

        return options;
    };

    // This is overwritten by inline script in layout.utml

    Pump.config = {};

    // A little bit of model sugar
    // Create Model attributes for our object-y things

    Pump.Model = Backbone.Model.extend({

        activityObjects: [],
        activityObjectBags: [],
        activityObjectStreams: [],
        activityStreams: [],
        peopleStreams: [],
        people: [],

        initialize: function() {

            var obj = this,
                neverNew = function() { // XXX: neverNude
                    return false;
                },
                initer = function(obj, model) {
                    return function(name) {
                        var raw = obj.get(name);
                        if (raw) {
                            obj[name] = new model(raw);
                            obj[name].isNew = neverNew;
                        }
                        obj.on("change:"+name, function(changed) {
                            var raw = obj.get(name);
                            if (obj[name] && obj[name].set) {
                                obj[name].set(raw);
                            } else if (raw) {
                                obj[name] = new model(raw);
                                obj[name].isNew = neverNew;
                            }
                        });
                    };
                };

            _.each(obj.activityObjects, initer(obj, Pump.ActivityObject));
            _.each(obj.activityObjectBags, initer(obj, Pump.ActivityObjectBag));
            _.each(obj.activityObjectStreams, initer(obj, Pump.ActivityObjectStream));
            _.each(obj.activityStreams, initer(obj, Pump.ActivityStream));
            _.each(obj.peopleStreams, initer(obj, Pump.PeopleStream));
            _.each(obj.people, initer(obj, Pump.Person));

        },
        toJSON: function() {

            var obj = this,
                json = _.clone(obj.attributes),
                jsoner = function(name) {
                    if (_.has(obj, name)) {
                        if (obj[name].toCollectionJSON) {
                            json[name] = obj[name].toCollectionJSON();
                        } else {
                            json[name] = obj[name].toJSON();
                        }
                    }
                };

            _.each(obj.activityObjects, jsoner);
            _.each(obj.activityObjectBags, jsoner);
            _.each(obj.activityObjectStreams, jsoner);
            _.each(obj.activityStreams, jsoner);
            _.each(obj.peopleStreams, jsoner);
            _.each(obj.people, jsoner);

            return json;
        }
    });

    Pump.Collection = Backbone.Collection.extend({
        constructor: function(models, options) {
            var coll = this;
            // If we're being initialized with a JSON Collection, parse it.
            if (_.isObject(models) && !_.isArray(models)) {
                models = coll.parse(models);
            }
            if (_.isObject(options) && _.has(options, "url")) {
                coll.url = options.url;
                delete options.url;
            }
            Backbone.Collection.apply(this, [models, options]);
        },
        parse: function(response) {
            if (_.has(response, "url")) {
                this.url = response.url;
            }
            if (_.has(response, "totalItems")) {
                this.totalItems = response.totalItems;
            }
            if (_.has(response, "links")) {
                if (_.has(response.links, "next")) {
                    this.nextLink = response.links.next.href;
                }
                if (_.has(response.links, "prev")) {
                    this.prevLink = response.links.prev.href;
                }
            }
            if (_.has(response, "items")) {
                return response.items;
            } else {
                return [];
            }
        },
        toCollectionJSON: function() {
            var rep = {};
            if (_.has(this, "totalItems")) {
                rep.totalItems = this.totalItems;
            }
            if (_.has(this, "url")) {
                rep.url = this.url;
            }
            if (_.has(this, "models")) {
                rep.items = [];
                _.each(this.models, function(model) {
                    if (model.toJSON) {
                        rep.items.push(model.toJSON());
                    } else {
                        rep.items.push(model);
                    }
                });
            }
            return rep;
        }
    });

    // A social activity.

    Pump.Activity = Pump.Model.extend({
        activityObjects: ['actor', 'object', 'target', 'generator', 'provider', 'location'],
        activityObjectBags: ['to', 'cc', 'bto', 'bcc'],
        url: function() {
            var links = this.get("links"),
                uuid = this.get("uuid");
            if (links && _.isObject(links) && links.self) {
                return links.self;
            } else if (uuid) {
                return "/api/activity/" + uuid;
            } else {
                return null;
            }
        }
    });

    Pump.ActivityStream = Pump.Collection.extend({
        model: Pump.Activity
    });

    Pump.ActivityObject = Pump.Model.extend({
        activityObjects: ['author', 'location', 'inReplyTo'],
        activityObjectBags: ['attachments', 'tags'],
        activityObjectStreams: ['likes', 'replies', 'shares'],
        url: function() {
            var links = this.get("links"),
                uuid = this.get("uuid"),
                objectType = this.get("objectType");
            if (links &&
                _.isObject(links) && 
                _.has(links, "self") &&
                _.isObject(links.self) &&
                _.has(links.self, "href") &&
                _.isString(links.self.href)) {
                return links.self.href;
            } else if (objectType) {
                return "/api/"+objectType+"/" + uuid;
            } else {
                return null;
            }
        }
    });

    Pump.Person = Pump.ActivityObject.extend({
        objectType: "person",
        activityObjectStreams: ['favorites', 'lists'],
        peopleStreams: ['followers', 'following'],
        initialize: function() {
            Pump.Model.prototype.initialize.apply(this, arguments);
        }
    });

    Pump.ActivityObjectStream = Pump.Collection.extend({
        model: Pump.ActivityObject
    });

    // Unordered, doesn't have an URL

    Pump.ActivityObjectBag = Backbone.Collection.extend({
        model: Pump.ActivityObject
    });

    Pump.PeopleStream = Pump.ActivityObjectStream.extend({
        model: Pump.Person
    });

    Pump.User = Pump.Model.extend({
        idAttribute: "nickname",
        people: ['profile'],
        initialize: function() {
            var user = this;

            Pump.Model.prototype.initialize.apply(this, arguments);

            if (this.profile) {
                this.profile.isNew = function() { return false; };
            }

            // XXX: maybe move some of these to Person...?
            user.inbox =       new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/inbox"});
            user.majorInbox =  new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/inbox/major"});
            user.minorInbox =  new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/inbox/minor"});
            user.stream =      new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/feed"});
            user.majorStream = new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/feed/major"});
            user.minorStream = new Pump.ActivityStream([], {url: "/api/user/" + user.get("nickname") + "/feed/minor"});

            user.on("change:nickname", function() {
                user.inbox.url       = "/api/user/" + user.get("nickname") + "/inbox";
                user.majorInbox.url  = "/api/user/" + user.get("nickname") + "/inbox/major";
                user.minorInbox.url  = "/api/user/" + user.get("nickname") + "/inbox/minor";
                user.stream.url      = "/api/user/" + user.get("nickname") + "/feed";
                user.majorStream.url = "/api/user/" + user.get("nickname") + "/feed/major";
                user.minorStream.url = "/api/user/" + user.get("nickname") + "/feed/minor";
            });
        },
        isNew: function() {
            // Always PUT
            return false;
        },
        url: function() {
            return "/api/user/" + this.get("nickname");
        }
    });

    Pump.currentUser = null; // XXX: load from server...?

    Pump.templates = {};

    Pump.TemplateError = function(template, data, err) {
        Error.captureStackTrace(this, Pump.TemplateError);
        this.name     = "TemplateError";
        this.template = template;
        this.data     = data;
        this.wrapped  = err;
        this.message  = ((_.has(template, "templateName")) ? template.templateName : "unknown-template") + ": " + err.message;
    };

    Pump.TemplateError.prototype = new Error();
    Pump.TemplateError.prototype.constructor = Pump.TemplateError;

    Pump.TemplateView = Backbone.View.extend({
        initialize: function(options) {
            var view = this,
                source = (_.has(view, "collection")) ? view.collection :
                         (_.has(view, "model")) ? view.model : null;

            if (source && _.isFunction(source.on)) {
                source.on("change", function(options) {
                    // When a change has happened, re-render
                    view.render();
                });
            }
        },
        setElement: function(element, delegate) {
            Backbone.View.prototype.setElement.apply(this, arguments);
            if (element) {
                this.ready();
            }
        },
        templateName: null,
        parts: null,
        ready: function() {
            // Do nothing by default
        },
        render: function() {
            var view = this,
                getTemplate = function(name, cb) {
                    var url;
                    if (_.has(Pump.templates, name)) {
                        cb(null, Pump.templates[name]);
                    } else {
                        $.get('/template/'+name+'.utml', function(data) {
                            var f;
                            try {
                                f = _.template(data);
                                f.templateName = name;
                                Pump.templates[name] = f;
                            } catch (err) {
                                cb(err, null);
                                return;
                            }
                            cb(null, f);
                        });
                    }
                },
                getTemplateSync = function(name) {
                    var f, data, res;
                    if (_.has(Pump.templates, name)) {
                        return Pump.templates[name];
                    } else {
                        res = $.ajax({url: '/template/'+name+'.utml',
                                      async: false});
                        if (res.readyState === 4 &&
                            ((res.status >= 200 && res.status < 300) || res.status === 304)) {
                            data = res.responseText;
                            f = _.template(data);
                            f.templateName = name;
                            Pump.templates[name] = f;
                        }
                        return f;
                    }
                },
                runTemplate = function(template, data, cb) {
                    var html;
                    try {
                        html = template(data);
                    } catch (err) {
                        cb(new Pump.TemplateError(template, data, err), null);
                        return;
                    }
                    cb(null, html);
                },
                setOutput = function(err, html) {
                    if (err) {
                        Pump.error(err);
                    } else {
                        view.$el.html(html);
                        // Let sub-classes do post-rendering setup
                        view.ready();
                        // Let others see that we're done
                        view.$el.trigger("ready", view);
                        // Update relative to the new code view
                        view.$("abbr.easydate").easydate();
                    }
                },
                main = {
                    config: Pump.config,
                    data: {},
                    template: {},
                    page: {}
                },
                pc,
                modelName = view.modelName || view.options.modelName || "model",
                partials,
                cnt;

            main.data[modelName] = (!view.model) ? {} : ((view.model.toJSON) ? view.model.toJSON() : view.model);

            if (_.has(view.options, "data")) {
                _.each(view.options.data, function(obj, name) {
                    if (obj.toJSON) {
                        main.data[name] = obj.toJSON();
                    } else {
                        main.data[name] = obj;
                    }
                });
            }

            if (Pump.currentUser && !_.has(main.data, "user")) {
                main.data.user = Pump.currentUser.toJSON();
            }

            main.partial = function(name, locals) {
                var template, scoped;
                if (locals) {
                    scoped = _.clone(locals);
                    _.extend(scoped, main);
                } else {
                    scoped = main;
                }
                if (!_.has(partials, name)) {
                    console.log("Didn't preload template " + name + " so fetching sync");
                    // XXX: Put partials in the parts array of the
                    // view to avoid this shameful sync call
                    partials[name] = getTemplateSync(name);
                }
                template = partials[name];
                if (!template) {
                    throw new Error("No template for " + name);
                }
                return template(scoped);
            };

            // XXX: set main.page.title

            // If there are sub-parts, we do them in parallel then
            // do the main one. Note: only one level.

            if (view.parts) {
                pc = 0;
                cnt = _.keys(view.parts).length;
                partials = {};
                _.each(view.parts, function(templateName) {
                    getTemplate(templateName, function(err, template) {
                        if (err) {
                            Pump.error(err);
                        } else {
                            pc++;
                            partials[templateName] = template;
                            if (pc >= cnt) {
                                getTemplate(view.templateName, function(err, template) {
                                    runTemplate(template, main, setOutput);
                                });
                            }
                        }
                    });
                });
            } else {
                getTemplate(view.templateName, function(err, template) {
                    runTemplate(template, main, setOutput);
                });
            }
            return this;
        },
        stopSpin: function() {
            this.$(':submit').prop('disabled', false).spin(false);
        },
        startSpin: function() {
            this.$(':submit').prop('disabled', true).spin(true);
        },
        showAlert: function(msg, type) {
            var view = this;

            if (view.$(".alert").length > 0) {
                view.$(".alert").remove();
            }

            type = type || "error";

            view.$("legend").after('<div class="alert alert-'+type+'">' +
                                   '<a class="close" data-dismiss="alert" href="#">&times;</a>' +
                                   '<p class="alert-message">'+ msg + '</p>' +
                                   '</div>');
            
            view.$(".alert").alert();
        },
        showError: function(msg) {
            this.showAlert(msg, "error");
        },
        showSuccess: function(msg) {
            this.showAlert(msg, "success");
        }
    });

    Pump.AnonymousNav = Pump.TemplateView.extend({
        tagName: "div",
        className: "nav",
        templateName: 'nav-anonymous'
    });

    Pump.UserNav = Pump.TemplateView.extend({
        tagName: "div",
        className: "nav",
        modelName: "user",
        templateName: 'nav-loggedin',
        events: {
            "click #logout": "logout",
            "click #post-note-button": "postNoteModal",
            "click #post-picture-button": "postPictureModal",
            "click #profile-dropdown": "profileDropdown"
        },
        postNoteModal: function() {
            var profile = Pump.currentUser.profile,
                lists = profile.lists,
                following = profile.following;

            lists.fetch({success: function() {
                following.fetch({success: function() {
                    Pump.showModal(Pump.PostNoteModal, {data: {user: Pump.currentUser}});
                }});
            }});
            return false;
        },
        postPictureModal: function() {
            var profile = Pump.currentUser.profile,
                lists = profile.lists,
                following = profile.following;

            lists.fetch({success: function() {
                following.fetch({success: function() {
                    Pump.showModal(Pump.PostPictureModal, {data: {user: Pump.currentUser}});
                }});
            }});
            return false;
        },
        profileDropdown: function() {
            $('#profile-dropdown').dropdown();
        },
        logout: function() {
            var view = this,
                options,
                onSuccess = function(data, textStatus, jqXHR) {
                    var an;
                    Pump.currentUser = null;

                    Pump.setNickname(null);
                    Pump.setUserCred(null, null);

                    an = new Pump.AnonymousNav({el: ".navbar-inner .container"});
                    an.render();

                    // Reload to clear authenticated stuff

                    Pump.router.navigate(window.location.pathname+"?logout=true", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    showError(errorThrown);
                },
                showError = function(msg) {
                    Pump.error(msg);
                };

            options = {
                contentType: "application/json",
                data: "",
                dataType: "json",
                type: "POST",
                url: "/main/logout",
                success: onSuccess,
                error: onError
            };

            Pump.ensureCred(function(err, cred) {
                var pair;
                if (err) {
                    showError("Couldn't get OAuth credentials. :(");
                } else {
                    options.consumerKey = cred.clientID;
                    options.consumerSecret = cred.clientSecret;
                    pair = Pump.getUserCred();

                    if (pair) {
                        options.token = pair.token;
                        options.tokenSecret = pair.secret;
                    }

                    options = Pump.oauthify(options);
                    $.ajax(options);
                }
            });
        }
    });

    Pump.ContentView = Pump.TemplateView.extend({
        addMajorActivity: function(act) {
            // By default, do nothing
        },
        addMinorActivity: function(act) {
            // By default, do nothing
        }
    });

    Pump.MainContent = Pump.ContentView.extend({
        templateName: 'main',
        el: '#content'
    });

    Pump.LoginContent = Pump.ContentView.extend({
        templateName: 'login',
        el: '#content',
        events: {
            "submit #login": "doLogin"
        },
        "doLogin": function() {
            var view = this,
                params = {nickname: view.$('#login input[name="nickname"]').val(),
                          password: view.$('#login input[name="password"]').val()},
                options,
                continueTo = getContinueTo(),
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                onSuccess = function(data, textStatus, jqXHR) {
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.currentUser = new Pump.User(data);
                    Pump.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                 model: Pump.currentUser});
                    Pump.nav.render();
                    // XXX: reload current data
                    view.stopSpin();
                    Pump.router.navigate(continueTo, true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    view.stopSpin();
                    type = jqXHR.getResponseHeader("Content-Type");
                    if (type && type.indexOf("application/json") !== -1) {
                        response = JSON.parse(jqXHR.responseText);
                        view.showError(response.error);
                    } else {
                        view.showError(errorThrown);
                    }
                };

            view.startSpin();

            options = {
                contentType: "application/json",
                data: JSON.stringify(params),
                dataType: "json",
                type: "POST",
                url: "/main/login",
                success: onSuccess,
                error: onError
            };

            Pump.ensureCred(function(err, cred) {
                if (err) {
                    view.showError("Couldn't get OAuth credentials. :(");
                } else {
                    options.consumerKey = cred.clientID;
                    options.consumerSecret = cred.clientSecret;
                    options = Pump.oauthify(options);
                    $.ajax(options);
                }
            });

            return false;
        }
    });

    Pump.RegisterContent = Pump.ContentView.extend({
        templateName: 'register',
        el: '#content',
        events: {
            "submit #registration": "register"
        },
        register: function() {
            var view = this,
                params = {nickname: view.$('#registration input[name="nickname"]').val(),
                          password: view.$('#registration input[name="password"]').val()},
                repeat = view.$('#registration input[name="repeat"]').val(),
                email = (Pump.config.requireEmail) ? view.$('#registration input[name="email"]').val() : null,
                options,
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                onSuccess = function(data, textStatus, jqXHR) {
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.currentUser = new Pump.User(data);
                    Pump.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                 model: Pump.currentUser});
                    Pump.nav.render();
                    // Leave disabled
                    view.stopSpin();
                    // XXX: one-time on-boarding page
                    Pump.router.navigate("", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    view.stopSpin();
                    type = jqXHR.getResponseHeader("Content-Type");
                    if (type && type.indexOf("application/json") !== -1) {
                        response = JSON.parse(jqXHR.responseText);
                        view.showError(response.error);
                    } else {
                        view.showError(errorThrown);
                    }
                };

            if (params.password !== repeat) {

                view.showError("Passwords don't match.");

            } else if (!NICKNAME_RE.test(params.nickname)) {

                view.showError("Nicknames have to be a combination of 1-64 letters or numbers and ., - or _.");

            } else if (params.password.length < 8) {

                view.showError("Password must be 8 chars or more.");

            } else if (/^[a-z]+$/.test(params.password.toLowerCase()) ||
                       /^[0-9]+$/.test(params.password)) {

                view.showError("Passwords have to have at least one letter and one number.");

            } else if (Pump.config.requireEmail && (!email || email.length === 0)) {

                view.showError("Email address required.");

            } else {

                if (Pump.config.requireEmail) {
                    params.email = email;
                }

                view.startSpin();

                options = {
                    contentType: "application/json",
                    data: JSON.stringify(params),
                    dataType: "json",
                    type: "POST",
                    url: "/main/register",
                    success: onSuccess,
                    error: onError
                };

                Pump.ensureCred(function(err, cred) {
                    if (err) {
                        view.showError("Couldn't get OAuth credentials. :(");
                    } else {
                        options.consumerKey = cred.clientID;
                        options.consumerSecret = cred.clientSecret;
                        options = Pump.oauthify(options);
                        $.ajax(options);
                    }
                });
            }

            return false;
        }
    });

    Pump.UserPageContent = Pump.ContentView.extend({
        templateName: 'user',
        parts: ["profile-block",
                "user-content-activities",
                "major-stream-headless",
                "sidebar-headless",
                "major-activity-headless",
                "minor-activity-headless",
                "responses",
                "reply",
                "profile-responses",
                "activity-object-list",
                "activity-object-collection"
               ],
        el: '#content',
        addMajorActivity: function(act) {
            var view = this,
                model = this.model,
                aview;

            if (act.actor.id != model.get("id")) {
                return;
            }

            aview = new Pump.MajorActivityHeadlessView({model: act});
            aview.$el.one("ready", function() {
                aview.$el.hide();
                view.$("#major-stream").prepend(aview.$el);
                aview.$el.slideDown('slow');
            });
            aview.render();
        },
        addMinorActivity: function(act) {
            var view = this,
                model = this.model,
                aview;

            if (act.actor.id != model.get("id")) {
                return;
            }

            aview = new Pump.MinorActivityHeadlessView({model: act});

            aview.$el.one("ready", function() {
                aview.$el.hide();
                view.$("#minor-stream").prepend(aview.$el);
                aview.$el.slideDown('slow');
            });
            aview.render();
        },
        ready: function() {

            var view = this,
                profile = view.options.data.profile,
                major = view.options.data.major,
                minor = view.options.data.minor;

            if (!view.profileBlock) {
                view.profileBlock = new Pump.ProfileBlock({model: profile});
            }

            view.profileBlock.setElement(view.$("#profile-block"));
            
            if (!view.userContent) {
                view.userContent = new Pump.ActivitiesUserContent({data: {minor: minor,
                                                                          major: major}});
            }

            view.userContent.setElement(view.$("#user-content"));
        }
    });

    Pump.ActivitiesUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-activities',
        parts: ["major-stream-headless",
                "sidebar-headless",
                "major-activity-headless",
                "minor-activity-headless",
                "responses",
                "reply",
                "profile-responses",
                "activity-object-list",
                "activity-object-collection"],
        el: '#user-content',
        ready: function() {
            var view = this,
                major = view.options.data.major,
                minor = view.options.data.minor;

            if (!view.majorStreamView) {
                view.majorStreamView = new Pump.MajorStreamHeadlessView({collection: major});
            }

            view.majorStreamView.setElement(view.$("#major-stream"));
                                                             
            if (!view.minorStreamView) {
                view.minorStreamView = new Pump.MinorStreamHeadlessView({collection: minor});
            }

            view.minorStreamView.setElement(view.$("#sidebar"));
        }
    });

    Pump.MajorStreamHeadlessView = Pump.TemplateView.extend({
        templateName: 'major-stream-headless',
        modelName: 'major',
        parts: ["major-activity-headless",
                "responses",
                "reply",
                "activity-object-list",
                "activity-object-collection"],
        ready: function() {
            var view = this,
                collection = this.collection;

            collection.each(function(activity) {
                var $el = view.$("div[data-activity-id='"+activity.id+"']"),
                    aview;

                if ($el.length > 0) {
                    aview = new Pump.MajorActivityHeadlessView({model: activity});
                    aview.setElement($el);
                }
            });
        }
    });

    Pump.MinorStreamHeadlessView = Pump.TemplateView.extend({
        templateName: 'sidebar',
        modelName: 'minor',
        parts: ["minor-activity-headless"],
        ready: function() {

            var view = this,
                collection = this.collection;

            collection.each(function(activity) {
                var $el = view.$("div[data-activity-id='"+activity.id+"']"),
                    aview;

                if ($el.length > 0) {
                    aview = new Pump.MinorActivityHeadlessView({model: activity});
                    aview.setElement($el);
                }
            });
        }
    });

    Pump.MajorStreamView = Pump.TemplateView.extend({
        templateName: 'major-stream',
        modelName: 'major',
        parts: ["major-activity",
                "responses",
                "reply",
                "activity-object-list",
                "activity-object-collection"],
        ready: function() {
            var view = this,
                collection = this.collection;

            collection.each(function(activity) {
                var $el = view.$("div[data-activity-id='"+activity.id+"']"),
                    aview;

                if ($el.length > 0) {
                    aview = new Pump.MajorActivityView({model: activity});
                    aview.setElement($el);
                }
            });
        }
    });

    Pump.MinorStreamView = Pump.TemplateView.extend({
        templateName: 'sidebar',
        modelName: 'minor',
        parts: ["minor-activity"],
        ready: function() {

            var view = this,
                collection = this.collection;

            collection.each(function(activity) {
                var $el = view.$("div[data-activity-id='"+activity.id+"']"),
                    aview;

                if ($el.length > 0) {
                    aview = new Pump.MinorActivityView({model: activity});
                    aview.setElement($el);
                }
            });
        }
    });

    Pump.InboxContent = Pump.ContentView.extend({
        templateName: 'inbox',
        modelName: "user",
        parts: ["major-stream",
                "sidebar",
                "major-activity",
                "minor-activity",
                "responses",
                "reply",
                "activity-object-list",
                "activity-object-collection"],
        el: '#content',
        addMajorActivity: function(act) {
            var view = this,
                aview;
            if (view && view.$(".activity.major")) {
                aview = new Pump.MajorActivityView({model: act});
                aview.$el.one("ready", function() {
                    aview.$el.hide();
                    view.$("#major-stream").prepend(aview.$el);
                    aview.$el.slideDown('slow');
                });
                aview.render();
            }
        },
        addMinorActivity: function(act) {
            var view = this,
                aview;
            aview = new Pump.MinorActivityView({model: act});

            aview.$el.one("ready", function() {
                aview.$el.hide();
                view.$("#minor-stream").prepend(aview.$el);
                aview.$el.slideDown('slow');
            });
            aview.render();
        },
        ready: function() {
            var view = this,
                major = view.options.data.major,
                minor = view.options.data.minor;

            if (!view.majorStreamView) {
                view.majorStreamView = new Pump.MajorStreamView({collection: major});
            }

            view.majorStreamView.setElement(view.$("#major-stream"));
                                                             
            if (!view.minorStreamView) {
                view.minorStreamView = new Pump.MinorStreamView({collection: minor});
            }

            view.minorStreamView.setElement(view.$("#sidebar"));
        }
    });

    Pump.MajorActivityView = Pump.TemplateView.extend({
        templateName: 'major-activity',
        parts: ["responses",
                "reply"],
        modelName: "activity",
        events: {
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject",
            "click .share": "shareObject",
            "click .unshare": "unshareObject",
            "click .comment": "openComment"
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.object.toJSON()
                }),
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".favorite")
                    .removeClass("favorite")
                    .addClass("unfavorite")
                    .html("Unlike <i class=\"icon-thumbs-down\"></i>");
                Pump.addMinorActivity(act);
            }});
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.object.toJSON()
                }),
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".unfavorite")
                    .removeClass("unfavorite")
                    .addClass("favorite")
                    .html("Like <i class=\"icon-thumbs-up\"></i>");
                Pump.addMinorActivity(act);
            }});
        },
        shareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "share",
                    object: view.model.object.toJSON()
                }),
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".share")
                    .removeClass("share")
                    .addClass("unshare")
                    .html("Unshare <i class=\"icon-remove\"></i>");
                Pump.addMajorActivity(act);
            }});
        },
        unshareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unshare",
                    object: view.model.object.toJSON()
                }),
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".unshare")
                    .removeClass("unshare")
                    .addClass("share")
                    .html("Share <i class=\"icon-share-alt\"></i>");
                Pump.addMinorActivity(act);
            }});
        },
        openComment: function() {
            var view = this,
                form = new Pump.CommentForm({model: view.model});

            form.$el.one("ready", function() {
                view.$(".replies").append(form.el);
            });

            form.render();
        }
    });

    // For the user page

    Pump.MajorActivityHeadlessView = Pump.MajorActivityView.extend({
        template: "major-activity-headless"
    });

    Pump.CommentForm = Pump.TemplateView.extend({
        templateName: 'comment-form',
        tagName: "div",
        className: "row comment-form",
        events: {
            "submit .post-comment": "saveComment"
        },
        saveComment: function() {
            var view = this,
                text = view.$('textarea[name="content"]').val(),
                orig = view.model.object.toJSON(),
                act = new Pump.Activity({
                    verb: "post",
                    object: {
                        objectType: "comment",
                        content: text,
                        inReplyTo: {
                            objectType: orig.objectType,
                            id: orig.id
                        }
                    }
                }),
                stream = Pump.currentUser.stream;

            view.startSpin();

            stream.create(act, {success: function(act) {

                var object = act.object,
                    repl;

                object.set("author", act.actor); 

                repl = new Pump.ReplyView({model: object});

                // These get stripped for "posts"; re-add it

                repl.$el.one("ready", function() {

                    view.stopSpin();

                    view.$el.replaceWith(repl.$el);
                });

                repl.render();

                Pump.addMinorActivity(act);

            }});

            return false;
        }
    });

    Pump.MajorObjectView = Pump.TemplateView.extend({
        templateName: 'major-object',
        parts: ["responses", "reply"]
    });

    Pump.ReplyView = Pump.TemplateView.extend({
        templateName: 'reply',
        modelName: 'reply'
    });

    Pump.MinorActivityView = Pump.TemplateView.extend({
        templateName: 'minor-activity',
        modelName: "activity"
    });

    Pump.MinorActivityHeadlessView = Pump.MinorActivityView.extend({
        templateName: 'minor-activity-headless'
    });

    Pump.PersonView = Pump.TemplateView.extend({
        events: {
            "click .follow": "followProfile",
            "click .stop-following": "stopFollowingProfile"
        },
        followProfile: function() {
            var view = this,
                act = {
                    verb: "follow",
                    object: view.model.toJSON()
                },
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".follow")
                    .removeClass("follow")
                    .removeClass("btn-primary")
                    .addClass("stop-following")
                    .html("Stop following");
            }});
        },
        stopFollowingProfile: function() {
            var view = this,
                act = {
                    verb: "stop-following",
                    object: view.model.toJSON()
                },
                stream = Pump.currentUser.stream;

            stream.create(act, {success: function(act) {
                view.$(".stop-following")
                    .removeClass("stop-following")
                    .addClass("btn-primary")
                    .addClass("follow")
                    .html("Follow");
            }});
        }
    });

    Pump.MajorPersonView = Pump.PersonView.extend({
        templateName: 'major-person',
        modelName: 'person'
    });

    Pump.ProfileBlock = Pump.PersonView.extend({
        templateName: 'profile-block',
        modelName: 'profile'
    });

    Pump.FavoritesContent = Pump.ContentView.extend({
        templateName: 'favorites',
        modelName: "profile",
        parts: ["profile-block",
                "user-content-favorites",
                "object-stream",
                "major-object",
                "responses",
                "reply",
                "profile-responses",
                "activity-object-list",
                "activity-object-collection"],
        el: '#content'
    });

    Pump.FavoritesUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-favorites',
        modelName: "profile",
        parts: ["object-stream",
                "major-object",
                "responses",
                "reply",
                "profile-responses",
                "activity-object-collection"],
        el: '#user-content'
    });

    Pump.FollowersContent = Pump.ContentView.extend({
        templateName: 'followers',
        modelName: "profile",
        parts: ["profile-block",
                "user-content-followers",
                "people-stream",
                "major-person",
                "profile-responses"],
        el: '#content'
    });

    Pump.FollowersUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-followers',
        modelName: "profile",
        parts: ["people-stream",
                "major-person",
                "profile-responses"],
        el: '#user-content'
    });

    Pump.FollowingContent = Pump.ContentView.extend({
        templateName: 'following',
        modelName: "profile",
        parts: ["profile-block",
                'user-content-following',
                "people-stream",
                "major-person",
                "profile-responses"],
        el: '#content'
    });

    Pump.FollowingUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-following',
        modelName: "profile",
        parts: ["people-stream",
                "major-person",
                "profile-responses"],
        el: '#user-content'
    });

    Pump.ListsContent = Pump.ContentView.extend({
        templateName: 'lists',
        modelName: "profile",
        parts: ["profile-block",
                'user-content-lists',
                "list-menu",
                "list-menu-item",
                "profile-responses"],
        el: '#content'
    });

    Pump.ListsUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-lists',
        modelName: "profile",
        parts: ["list-menu",
                "list-menu-item",
                "list-content-lists"],
        el: '#user-content'
    });

    Pump.ListMenu = Pump.TemplateView.extend({
        templateName: "list-menu",
        modelName: "profile",
        parts: ["list-menu-item"],
        el: '.list-menu-block',
        events: {
            "click .new-list": "newList"
        },
        newList: function() {
            Pump.showModal(Pump.NewListModal, {data: {user: Pump.currentUser}});
        }
    });

    Pump.ListMenuItem = Pump.TemplateView.extend({
        templateName: "list-menu-item",
        modelName: "listItem",
        tagName: "ul",
        className: "list-menu-wrapper"
    });

    Pump.ListsListContent = Pump.TemplateView.extend({
        templateName: 'list-content-lists',
        modelName: "profile",
        el: '#list-content'
    });

    Pump.ListContent = Pump.ContentView.extend({
        templateName: 'list',
        modelName: "profile",
        parts: ["profile-block",
                "profile-responses",
                'user-content-list',
                "list-content-list",
                "people-stream",
                "major-person",
                "list-menu",
                "list-menu-item"
               ],
        el: '#content'
    });

    Pump.ListUserContent = Pump.TemplateView.extend({
        templateName: 'user-content-list',
        modelName: "profile",
        parts: ["people-stream",
                "list-content-list",
                "major-person",
                "list-menu-item",
                "list-menu"
               ],
        el: '#user-content'
    });

    Pump.ListListContent = Pump.TemplateView.extend({
        templateName: 'list-content-list',
        modelName: "profile",
        parts: ["people-stream",
                "major-person"],
        el: '#list-content'
    });

    Pump.ActivityContent = Pump.ContentView.extend({
        templateName: 'activity-content',
        modelName: "activity",
        el: '#content'
    });

    Pump.SettingsContent = Pump.ContentView.extend({
        templateName: 'settings',
        el: '#content',
        modelName: "profile",
        events: {
            "submit #settings": "saveSettings"
        },
        saveSettings: function() {

            var view = this,
                user = Pump.currentUser,
                profile = user.profile;

            view.startSpin();

            profile.save({"displayName": this.$('#realname').val(),
                          "location": { objectType: "place", 
                                        displayName: this.$('#location').val() },
                          "summary": this.$('#bio').val()},
                         {
                             success: function(resp, status, xhr) {
                                 user.set("profile", profile);
                                 view.showSuccess("Saved settings.");
                                 view.stopSpin();
                             },
                             error: function(model, error, options) {
                                 view.showError(error.message);
                                 view.stopSpin();
                             }
                         });

            return false;
        }
    });

    Pump.AccountContent = Pump.ContentView.extend({
        templateName: 'account',
        el: '#content',
        modelName: "user",
        events: {
            "submit #account": "saveAccount"
        },
        saveAccount: function() {
            var view = this,
                user = Pump.currentUser,
                password = view.$('#password').val(),
                repeat = view.$('#repeat').val();

            if (password !== repeat) {

                view.showError("Passwords don't match.");

            } else if (password.length < 8) {

                view.showError("Password must be 8 chars or more.");

            } else if (/^[a-z]+$/.test(password.toLowerCase()) ||
                       /^[0-9]+$/.test(password)) {

                view.showError("Passwords have to have at least one letter and one number.");

            } else {

                view.startSpin();

                user.save("password",
                          password,
                          {
                              success: function(resp, status, xhr) {
                                  view.showSuccess("Saved.");
                                  view.stopSpin();
                              },
                              error: function(model, error, options) {
                                  view.showError(error.message);
                                  view.stopSpin();
                              }
                          }
                         );
            }
            
            return false;
        }
    });

    Pump.AvatarContent = Pump.ContentView.extend({
        templateName: 'avatar',
        el: '#content',
        modelName: "profile"
    });

    Pump.ObjectContent = Pump.ContentView.extend({
        templateName: 'object',
        modelName: "object",
        parts: ["responses",
                "reply",
                "activity-object-collection"],
        el: '#content'
    });

    Pump.PostNoteModal = Pump.TemplateView.extend({

        tagName: "div",
        className: "modal-holder",
        templateName: 'post-note',
        ready: function() {
            var view = this;
            view.$('#note-content').wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });
            view.$("#note-to").select2();
            view.$("#note-cc").select2();
        },
        events: {
            "click #send-note": "postNote"
        },
        postNote: function(ev) {
            var view = this,
                text = view.$('#post-note #note-content').val(),
                to = view.$('#post-note #note-to').val(),
                cc = view.$('#post-note #note-cc').val(),
                act = new Pump.Activity({
                    verb: "post",
                    object: {
                        objectType: "note",
                        content: text
                    }
                }),
                stream = Pump.currentUser.stream,
                strToObj = function(str) {
                    var colon = str.indexOf(":"),
                        type = str.substr(0, colon),
                        id = str.substr(colon+1);
                    return new Pump.ActivityObject({
                        id: id,
                        objectType: type
                    });
                };

            if (to && to.length > 0) {
                act.to = new Pump.ActivityObjectBag(_.map(to, strToObj));
            }

            if (cc && cc.length > 0) {
                act.cc = new Pump.ActivityObjectBag(_.map(cc, strToObj));
            }

            view.startSpin();
            
            stream.create(act, {success: function(act) {
                view.$("#modal-note").modal('hide');
                view.stopSpin();
                Pump.resetWysihtml5(view.$('#note-content'));
                // Reload the current page
                Pump.addMajorActivity(act);
            }});
        }
    });

    Pump.PostPictureModal = Pump.TemplateView.extend({
        tagName: "div",
        className: "modal-holder",
        templateName: 'post-picture',
        events: {
            "click #send-picture": "postPicture"
        },
        ready: function() {
            var view = this;

            view.$("#picture-to").select2();
            view.$("#picture-cc").select2();

            view.$('#picture-description').wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });

            if (view.$("#picture-fineupload").length > 0) {
                view.$("#picture-fineupload").fineUploader({
                    request: {
                        endpoint: "/main/upload"
                    },
                    text: {
                        uploadButton: '<i class="icon-upload icon-white"></i> Picture file'
                    },
                    template: '<div class="qq-uploader">' +
                        '<pre class="qq-upload-drop-area"><span>{dragZoneText}</span></pre>' +
                        '<div class="qq-upload-button btn btn-success">{uploadButtonText}</div>' +
                        '<ul class="qq-upload-list"></ul>' +
                        '</div>',
                    classes: {
                        success: 'alert alert-success',
                        fail: 'alert alert-error'
                    },
                    autoUpload: false,
                    multiple: false,
                    validation: {
                        allowedExtensions: ["jpeg", "jpg", "png", "gif", "svg", "svgz"],
                        acceptFiles: "image/*"
                    }
                }).on("complete", function(event, id, fileName, responseJSON) {

                    var stream = Pump.currentUser.stream,
                        to = view.$('#post-picture #picture-to').val(),
                        cc = view.$('#post-picture #picture-cc').val(),
                        strToObj = function(str) {
                            var colon = str.indexOf(":"),
                                type = str.substr(0, colon),
                                id = str.substr(colon+1);
                            return new Pump.ActivityObject({
                                id: id,
                                objectType: type
                            });
                        },
                        act = new Pump.Activity({
                            verb: "post",
                            object: responseJSON.obj
                        });

                    if (to && to.length > 0) {
                        act.to = new Pump.ActivityObjectBag(_.map(to, strToObj));
                    }

                    if (cc && cc.length > 0) {
                        act.cc = new Pump.ActivityObjectBag(_.map(cc, strToObj));
                    }

                    stream.create(act, {success: function(act) {
                        view.$("#modal-picture").modal('hide');
                        view.stopSpin();
                        view.$("#picture-fineupload").fineUploader('reset');
                        Pump.resetWysihtml5(view.$('#picture-description'));
                        view.$('#picture-title').val("");
                        // Reload the current content
                        Pump.addMajorActivity(act);
                    }});
                }).on("error", function(event, id, fileName, reason) {
                    view.showError(reason);
                });
            }
        },
        postPicture: function(ev) {
            var view = this,
                description = view.$('#post-picture #picture-description').val(),
                title = view.$('#post-picture #picture-title').val(),
                params = {};

            if (title) {
                params.title = title;
            }

            // XXX: HTML

            if (description) {
                params.description = description;
            }

            view.$("#picture-fineupload").fineUploader('setParams', params);

            view.startSpin();

            view.$("#picture-fineupload").fineUploader('uploadStoredFiles');

        }
    });

    Pump.NewListModal = Pump.TemplateView.extend({

        tagName: "div",
        className: "modal-holder",
        templateName: 'new-list',
        ready: function() {
            var view = this;
            view.$('#list-description').wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });
        },
        events: {
            "click #save-new-list": "saveNewList"
        },
        saveNewList: function() {
            var view = this,
                description = view.$('#new-list #list-description').val(),
                name = view.$('#new-list #list-name').val(),
                act,
                stream = Pump.currentUser.stream;

            if (!name) {
                view.showError("Your list must have a name.");
            } else {

                // XXX: any other validation? Check uniqueness here?

                // XXX: to/cc ?

                act = new Pump.Activity({
                    verb: "create",
                    object: new Pump.ActivityObject({
                        objectType: "collection",
                        objectTypes: ["person"],
                        displayName: name,
                        content: description
                    })
                });
                
                view.startSpin();

                stream.create(act, {success: function(act) {
                    var aview;

                    view.$(".pump-modal").modal('hide');
                    view.stopSpin();
                    Pump.resetWysihtml5(view.$('#list-description'));
                    view.$('#list-name').val("");

                    // it's minor

                    Pump.addMinorActivity(act);

                    if ($("#list-menu-inner").length > 0) {
                        aview = new Pump.ListMenuItem({model: act.object});
                        aview.$el.one("ready", function() {
                            var el = aview.$("li");
                            el.hide();
                            $("#list-menu-inner").prepend(el);
                            el.slideDown('fast');
                            // Go to the new list page
                            Pump.router.navigate(act.object.get("url"), true);
                        });
                        aview.render();
                    }
                }});
            }

            return false;
        }
    });

    Pump.BodyView = Backbone.View.extend({
        initialize: function(options) {
            this.router = options.router;
            _.bindAll(this, "navigateToHref");
        },
        el: "body",
        events: {
            "click a": "navigateToHref"
        },
        navigateToHref: function(ev) {
            var el = (ev.srcElement || ev.currentTarget),
                pathname = el.pathname, // XXX: HTML5
                here = window.location;

            if (!el.host || el.host === here.host) {
                this.router.navigate(pathname, true);
                return false;
            } else {
                return true;
            }
        }
    });

    Pump.modals = {};

    Pump.showModal = function(Cls, options, callback) {

        var modalView,
            templateName = Cls.prototype.templateName;

        if (!callback) {
            callback = options;
            options = {};
        }

        // If we've got it attached already, just show it
        if (_.has(Pump.modals, templateName)) {
            modalView = Pump.modals[templateName];
            modalView.$(".pump-modal").modal('show');
        } else {
            // Otherwise, create a view
            modalView = new Cls(options);
            $("body").append(modalView.el);
            Pump.modals[templateName] = modalView;
            // When it's ready, show immediately
            modalView.$el.one("ready", function() {
                modalView.$(".pump-modal").modal('show');
            });
            // render it (will fire "ready")
            modalView.render();
        }
    };

    Pump.resetWysihtml5 = function(el) {
        var fancy = el.data('wysihtml5');
        if (fancy && fancy.editor && fancy.editor.clear) {
            fancy.editor.clear();
        }
        $(".wysihtml5-command-active", fancy.toolbar).removeClass("wysihtml5-command-active");
        return el;
    };

    Pump.addMajorActivity = function(act) {
        if (Pump.content) {
            Pump.content.addMajorActivity(act);
        }
    };

    Pump.addMinorActivity = function(act) {
        if (Pump.content) {
            Pump.content.addMinorActivity(act);
        }
    };

    Pump.setContent = function(options, callback) {

        var View = options.view,
            title = options.title;

        // XXX: double-check this

        Pump.content = new View(options);

        Pump.router.setTitle(Pump.content, title);
        
        Pump.content.render();
    };

    Pump.setUserContent = function(options, callback) {

        var view,
            contentView = options.contentView,
            userContentView = options.userContentView,
            title = options.title,
            id = options.model.get("id");

        delete options.contentView;
        delete options.userContentView;
        delete options.title;
        
        Pump.content = new contentView(options);
        Pump.router.setTitle(Pump.content, title);

        if ($("#user-content").length > 0 && $("#profile-block").attr("data-profile-id") == id) {

            Pump.userContent = new userContentView(options);

            view = Pump.userContent;
            
        } else {
            
            view = Pump.content;

            view.$el.one("ready", function() {

                // Helper view for the profile block

                var block = new Pump.ProfileBlock({el: Pump.content.$("#profile-block"),
                                                   model: options.model});

                Pump.userContent = new userContentView(_.extend({el: Pump.content.$("#user-content")}, options));
            });
        }

        view.$el.one("ready", function() {
            callback(view);
        });

        view.render();
    };

    Pump.setListContent = function(options, callback) {

        var view,
            contentView = options.contentView,
            userContentView = options.userContentView,
            listContentView = options.listContentView,
            title = options.title,
            id = options.model.get("id");

        if ($("#list-content").length > 0 && $("#list-menu").attr("data-profile-id") == id) {

            Pump.content = new contentView(options);
            Pump.userContent = new userContentView(options);
            Pump.listContent = new listContentView(options);

            Pump.router.setTitle(Pump.content, title);

            view = Pump.listContent;
            
            view.$el.one("ready", function() {
                callback(view);
            });

            view.render();

        } else {
            Pump.setUserContent(options, function(view) {
                Pump.listMenu    = new Pump.ListMenu(_.extend({el: view.$("#list-menu")}, options));
                Pump.listContent = new listContentView(_.extend({el: view.$("#list-content")}, options));
                callback(Pump.listContent);
            });
        }
    };

    Pump.content = null;
    Pump.userContent = null;
    Pump.listContent = null;

    Pump.Router = Backbone.Router.extend({

        routes: {
            "":                       "home",    
            ":nickname":              "profile",   
            ":nickname/favorites":    "favorites",  
            ":nickname/following":    "following",  
            ":nickname/followers":    "followers",  
            ":nickname/activity/:id": "activity",
            ":nickname/lists":        "lists",
            ":nickname/list/:uuid":   "list",
            ":nickname/:type/:uuid":  "object",
            "main/settings":          "settings",
            "main/account":           "account",
            "main/avatar":            "avatar",
            "main/register":          "register",
            "main/login":             "login"
        },

        setTitle: function(view, title) {
            view.$el.one("ready", function() {
                $("title").html(title + " - " + Pump.config.site);
            });
        },

        register: function() {
            Pump.setContent({view: Pump.RegisterContent,
                             title: "Register"});
        },

        login: function() {
            Pump.setContent({view: Pump.LoginContent,
                             title: "Login"});
        },

        settings: function() {
            Pump.setContent({view: Pump.SettingsContent,
                             model: Pump.currentUser.profile,
                             title: "Settings"});
        },

        account: function() {
            Pump.setContent({view: Pump.AccountContent,
                             model: Pump.currentUser,
                             title: "Account"});
        },

        avatar: function() {
            Pump.setContent({view: Pump.AvatarContent,
                             model: Pump.currentUser.profile,
                             title: "Avatar"});
        },

        "home": function() {
            var pair = Pump.getUserCred();

            if (pair) {
                var user = Pump.currentUser,
                    major = user.majorInbox,
                    minor = user.minorInbox;

                // XXX: parallelize

                major.fetch({success: function(major, response) {
                    minor.fetch({success: function(minor, response) {
                        Pump.setContent({view: Pump.InboxContent,
                                         data: {major: major,
                                                minor: minor},
                                         title: "Home"});
                    }});
                }});
            } else {
                Pump.setContent({view: Pump.MainContent,
                                 title: "Welcome"});
            }
        },

        profile: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname}),
                major = user.majorStream,
                minor = user.minorStream;

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                major.fetch({success: function(major, response) {
                    minor.fetch({success: function(minor, response) {
                        var profile = user.profile,
                            options = {contentView: Pump.UserPageContent,
                                       userContentView: Pump.ActivitiesUserContent,
                                       title: profile.get("displayName"),
                                       model: profile,
                                       data: { major: major,
                                               minor: minor }};

                        Pump.setUserContent(options, function(view) {
                            // Do nothing!
                        });
                    }});
                }});
            }});
        },

        favorites: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname});

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var profile = user.profile,
                    favorites = profile.favorites;
                favorites.fetch({success: function(major, response) {
                    var options = {
                        contentView: Pump.FavoritesContent,
                        userContentView: Pump.FavoritesUserContent,
                        title: nickname + " favorites",
                        model: profile,
                        data: { objects: favorites }
                    };
                    Pump.setUserContent(options, function(view) {
                        view.$(".object.major").each(function(i) {
                            var id = $(this).attr("id"),
                                obj = favorites.get(id);

                            var aview = new Pump.MajorObjectView({el: this, model: obj});
                        });
                    });
                }});
            }});
        },

        followers: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname});

            user.fetch({success: function(user, response) {
                var followers = user.profile.followers;
                followers.fetch({success: function(followers, response) {
                    var profile = user.profile,
                        options = {contentView: Pump.FollowersContent,
                                   userContentView: Pump.FollowersUserContent,
                                   title: nickname + " followers",
                                   model: profile,
                                   data: {people: followers }};

                    Pump.setUserContent(options, function(view) {
                        view.$(".person.major").each(function(i) {
                            var id = $(this).attr("id"),
                                person = followers.get(id);

                            var aview = new Pump.MajorPersonView({el: this, model: person});
                        });
                    });
                }});
            }});
        },

        following: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname});

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var following = user.profile.following;
                following.fetch({success: function(following, response) {
                    var profile = user.profile,
                        options = {contentView: Pump.FollowingContent,
                                   userContentView: Pump.FollowingUserContent,
                                   title: nickname + " following",
                                   model: profile,
                                   data: {people: following }};

                    Pump.setUserContent(options, function(view) {
                        view.$(".person.major").each(function(i) {
                            var id = $(this).attr("id"),
                                person = following.get(id);

                            var aview = new Pump.MajorPersonView({el: this, model: person});
                        });
                    });
                }});
            }});
        },

        lists: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname});

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var lists = user.profile.lists;
                lists.fetch({success: function(lists, response) {
                    var profile = user.profile,
                        options = {contentView: Pump.ListsContent,
                                   userContentView: Pump.ListsUserContent,
                                   listContentView: Pump.ListsListContent,
                                   title: nickname + " lists",
                                   model: profile,
                                   data: {lists: lists}};

                    Pump.setListContent(options, function(view) {
                        // Nothing to do!
                    });
                }});
            }});
        },

        list: function(nickname, uuid) {

            var router = this,
                user = new Pump.User({nickname: nickname}),
                list = new Pump.ActivityObject({links: {self: {href: "/api/collection/"+uuid}}});

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var lists = user.profile.lists;
                lists.fetch({success: function(lists, response) {
                    list.fetch({success: function(list, response) {
                        var profile = user.profile,
                            options = {contentView: Pump.ListContent,
                                       userContentView: Pump.ListUserContent,
                                       listContentView: Pump.ListListContent,
                                       title: nickname + " - list -" + list.get("displayName"),
                                       model: profile,
                                       data: {lists: lists,
                                              list: list}};

                        Pump.setListContent(options, function(view) {
                            Pump.userContent.$("#list-menu .active").removeClass("active");
                            Pump.userContent.$("#list-menu li[data-list-id='"+list.id+"']").addClass("active");
                        });
                    }});
                }});
            }});
        },

        activity: function(nickname, id) {
            var router = this,
                act = new Pump.Activity({uuid: id, userNickname: nickname});

            act.fetch({success: function(act, response) {
                Pump.content = new Pump.ActivityContent({model: act});

                router.setTitle(Pump.content, act.content);
                Pump.content.render();
            }});
        },
        
        object: function(nickname, type, uuid) {
            var router = this,
                obj = new Pump.ActivityObject({uuid: uuid, objectType: type, userNickname: nickname});

            obj.fetch({success: function(obj, response) {

                Pump.content = new Pump.ObjectContent({model: obj});
                
                router.setTitle(Pump.content, obj.displayName || obj.objectType + "by" + nickname);

                Pump.content.render();
            }});
        }
    });

    Pump.router = new Pump.Router();

    Pump.clientID = null;
    Pump.clientSecret = null;
    Pump.nickname = null;
    Pump.token = null;
    Pump.secret = null;
    Pump.credReq = null;

    Pump.setNickname = function(userNickname) {
        Pump.nickname = userNickname;
        if (localStorage) {
            localStorage['cred:nickname'] = userNickname;
        }
    };

    Pump.getNickname = function() {
        if (Pump.nickname) {
            return Pump.nickname;
        } else if (localStorage) {
            return localStorage['cred:nickname'];
        } else {
            return null;
        }
    };

    Pump.getCred = function() {
        if (Pump.clientID) {
            return {clientID: Pump.clientID, clientSecret: Pump.clientSecret};
        } else if (localStorage) {
            Pump.clientID = localStorage['cred:clientID'];
            Pump.clientSecret = localStorage['cred:clientSecret'];
            if (Pump.clientID) {
                return {clientID: Pump.clientID, clientSecret: Pump.clientSecret};
            } else {
                return null;
            }
        } else {
            return null;
        }
    };

    Pump.getUserCred = function(nickname) {
        if (Pump.token) {
            return {token: Pump.token, secret: Pump.secret};
        } else if (localStorage) {
            Pump.token = localStorage['cred:token'];
            Pump.secret = localStorage['cred:secret'];
            if (Pump.token) {
                return {token: Pump.token, secret: Pump.secret};
            } else {
                return null;
            }
        } else {
            return null;
        }
    };

    Pump.setUserCred = function(userToken, userSecret) {
        Pump.token = userToken;
        Pump.secret = userSecret;
        if (localStorage) {
            localStorage['cred:token'] = userToken;
            localStorage['cred:secret'] = userSecret;
        }
        return;
    };

    Pump.ensureCred = function(callback) {
        var cred = Pump.getCred();
        if (cred) {
            callback(null, cred);
        } else if (Pump.credReq) {
            Pump.credReq.success(function(data) {
                callback(null, {clientID: data.client_id,
                                clientSecret: data.client_secret});
            });
            Pump.credReq.error(function() {
                callback(new Error("error getting credentials"), null);
            });
        } else {
            Pump.credReq = $.post("/api/client/register",
                                  {type: "client_associate",
                                   application_name: Pump.config.site + " Web",
                                   application_type: "web"},
                                  function(data) {
                                      Pump.credReq = null;
                                      Pump.clientID = data.client_id;
                                      Pump.clientSecret = data.client_secret;
                                      if (localStorage) {
                                          localStorage['cred:clientID'] = Pump.clientID;
                                          localStorage['cred:clientSecret'] = Pump.clientSecret;
                                      }
                                      callback(null, {clientID: Pump.clientID,
                                                      clientSecret: Pump.clientSecret});
                                  },
                                  "json");
            Pump.credReq.error(function() {
                callback(new Error("error getting credentials"), null);
            });
        }
    };

    Pump.wysihtml5Tmpl = {
        "emphasis": function(locale) {
            return "<li>" +
                "<div class='btn-group'>" +
                "<a class='btn' data-wysihtml5-command='bold' title='"+locale.emphasis.bold+"'><i class='icon-bold'></i></a>" +
                "<a class='btn' data-wysihtml5-command='italic' title='"+locale.emphasis.italic+"'><i class='icon-italic'></i></a>" +
                "<a class='btn' data-wysihtml5-command='underline' title='"+locale.emphasis.underline+"'>_</a>" +
                "</div>" +
                "</li>";
        }
    };

    Pump.setupWysiHTML5 = function() {

        // Set wysiwyg defaults

        $.fn.wysihtml5.defaultOptions["font-styles"] = false;
        $.fn.wysihtml5.defaultOptions["image"] = false;
        $.fn.wysihtml5.defaultOptions["customTemplates"] = Pump.wysihtml5Tmpl;
    };

    $(document).ready(function() {

        Pump.bodyView = new Pump.BodyView({router: Pump.router});
        Pump.nav = new Pump.AnonymousNav({el: ".navbar-inner .container"});

        // Initialize a view for the current content. Not crazy about this.

        if ($("#content #login").length > 0) {
            Pump.content = new Pump.LoginContent();
        } else if ($("#content #registration").length > 0) {
            Pump.content = new Pump.RegisterContent();
        } else if ($("#content #user").length > 0) {
            Pump.content = new Pump.UserPageContent({});
        } else if ($("#content #inbox").length > 0) {
            Pump.content = new Pump.InboxContent({});
        }

        $("abbr.easydate").easydate();

        Backbone.history.start({pushState: true, silent: true});

        Pump.setupWysiHTML5();

        Pump.ensureCred(function(err, cred) {

            var user, nickname, pair;

            if (err) {
                Pump.error(err.message);
                return;
            }

            nickname = Pump.getNickname();

            if (nickname) {

                user = new Pump.User({nickname: nickname});

                // FIXME: this only has client auth; get something with user auth (direct?)

                user.fetch({success: function(user, response) {

                    var sp, continueTo;

                    Pump.currentUser = user;
                    Pump.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                 model: Pump.currentUser});

                    Pump.nav.render();

                    // If we're on the login page, and there's a current
                    // user, redirect to the actual page

                    switch (window.location.pathname) {
                    case "/main/login":
                        Pump.content = new Pump.LoginContent();
                        continueTo = getContinueTo();
                        Pump.router.navigate(continueTo, true);
                        break;
                    case "/":
                        Pump.router.home();
                        break;
                    }
                }});
            }
        });
    });


    return Pump;

})(window._, window.$, window.Backbone);
