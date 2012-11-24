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

    // This is overwritten by inline script in layout.utml

    Pump.config = {};

    // A social activity.

    Pump.Activity = Backbone.Model.extend({
        initialize: function() {
            var act = this,
                parts = ['actor', 'object', 'target', 'generator', 'provider', 'location'],
                arrays = ['to', 'cc', 'bto', 'bcc'];

            _.each(parts, function(part) {
                var raw = act.get(part);
                if (raw) {
                    act[part] = new Pump.ActivityObject(raw);
                }
            });

            _.each(arrays, function(arr) {
                var raw = act.get(arr);
                if (raw) {
                    act[arr] = new Pump.ActivityObjectBag(raw);
                }
            });

            act.on("change", function(act) {
                _.each(parts, function(part) {
                    var raw = act.get(part);
                    if (act[part]) {
                        act[part].set(raw);
                    } else if (raw) {
                        act[part] = new Pump.ActivityObject(raw);
                    }
                });
                _.each(arrays, function(arr) {
                    var raw = act.get(arr);
                    if (act[arr]) {
                        act[arr].set(raw);
                    } else if (raw) {
                        act[arr] = new Pump.ActivityObject(raw);
                    }
                });
            });
        },
        toJSON: function() {

            var act = this,
                parts = ['actor', 'object', 'target', 'generator', 'provider', 'location'],
                arrays = ['to', 'cc', 'bto', 'bcc'],
                json = _.clone(act.attributes);

            _.each(parts, function(part) {
                if (_.has(act, part)) {
                    json[part] = act[part].toJSON();
                }
            });

            _.each(arrays, function(arr) {
                if (_.has(act, arr)) {
                    json[arr] = act[arr].toJSON();
                }
            });

            return json;
        },
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

    Pump.ActivityStream = Backbone.Collection.extend({
        model: Pump.Activity,
        parse: function(response) {
            return response.items;
        }
    });

    Pump.UserStream = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed";
        }
    });

    Pump.UserMajorStream = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed/major";
        }
    });

    Pump.UserMinorStream = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed/minor";
        }
    });

    Pump.UserInbox = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox";
        }
    });

    Pump.UserMajorInbox = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox/major";
        }
    });

    Pump.UserMinorInbox = Pump.ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox/minor";
        }
    });

    Pump.ActivityObject = Backbone.Model.extend({
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
        objectType: "person"
    });

    Pump.ActivityObjectStream = Backbone.Collection.extend({
        model: Pump.ActivityObject,
        parse: function(response) {
            return response.items;
        }
    });

    // Unordered, doesn't have an URL

    Pump.ActivityObjectBag = Backbone.Collection.extend({
        model: Pump.ActivityObject
    });

    Pump.PeopleStream = Backbone.Collection.extend({
        model: Pump.Person,
        parse: function(response) {
            return response.items;
        }
    });

    Pump.UserFollowers = Pump.PeopleStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/followers";
        }
    });

    Pump.UserFollowing = Pump.PeopleStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/following";
        }
    });

    Pump.UserFavorites = Pump.ActivityObjectStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/favorites";
        }
    });

    Pump.User = Backbone.Model.extend({
        idAttribute: "nickname",
        initialize: function() {
            this.profile = new Pump.Person(this.get("profile"));
            this.on("change", function(user) {
                user.profile.set(user.get("profile"));
            });
            this.profile.isNew = function() { return false; };
        },
        isNew: function() {
            // Always PUT
            return false;
        },
        url: function() {
            return "/api/user/" + this.get("nickname");
        },
        getStream: function() {
            return new Pump.UserStream([], {user: this});
        },
        getMajorStream: function() {
            return new Pump.UserMajorStream([], {user: this});
        },
        getMinorStream: function() {
            return new Pump.UserMinorStream([], {user: this});
        },
        getInbox: function() {
            return new Pump.UserInbox([], {user: this});
        },
        getMajorInbox: function() {
            return new Pump.UserMajorInbox([], {user: this});
        },
        getMinorInbox: function() {
            return new Pump.UserMinorInbox([], {user: this});
        },
        getFollowersStream: function() {
            return new Pump.UserFollowers([], {user: this});
        },
        getFollowingStream: function() {
            return new Pump.UserFollowing([], {user: this});
        },
        getFavorites: function() {
            return new Pump.UserFavorites([], {user: this});
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
        templateName: null,
        parts: null,
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
                        view.$el.trigger("pump.rendered");
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

            main.partial = function(name) {
                var template;
                if (!_.has(partials, name)) {
                    // XXX: Put partials in the parts array of the
                    // view to avoid this shameful sync call
                    partials[name] = getTemplateSync(name);
                }
                template = partials[name];
                if (!template) {
                    throw new Error("No template for " + name);
                }
                return template(main);
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
            "click #profile-dropdown": "profileDropdown"
        },
        postNoteModal: function() {
            var view = this,
                modalView;

            if (view.postNote) {
                modalView = view.postNote;
            } else {
                modalView = new Pump.PostNoteModal({});
                $("body").append(modalView.el);
                view.postNote = modalView;
            }

            // Once it's rendered, show the modal

            modalView.$el.one("pump.rendered", function() {
                modalView.$("#modal-note").modal('show');
            });

            modalView.render();
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

    Pump.MainContent = Pump.TemplateView.extend({
        templateName: 'main',
        el: '#content'
    });

    Pump.LoginContent = Pump.TemplateView.extend({
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
                    var nav;
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.currentUser = new Pump.User(data);
                    nav = new Pump.UserNav({el: ".navbar-inner .container",
                                            model: Pump.currentUser});
                    nav.render();
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

    Pump.RegisterContent = Pump.TemplateView.extend({
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
                    var nav;
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.currentUser = new Pump.User(data);
                    nav = new Pump.UserNav({el: ".navbar-inner .container",
                                            model: Pump.currentUser});
                    nav.render();
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
                    url: "/api/users",
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

    Pump.UserPageContent = Pump.TemplateView.extend({
        templateName: 'user',
        modelName: "profile",
        parts: ["profile-block",
                "major-stream-headless",
                "sidebar-headless",
                "major-activity-headless",
                "minor-activity-headless",
                "responses",
                "reply"],
        el: '#content'
    });

    Pump.InboxContent = Pump.TemplateView.extend({
        templateName: 'inbox',
        modelName: "user",
        parts: ["major-stream",
                "sidebar",
                "major-activity",
                "minor-activity",
                "responses",
                "reply"],
        el: '#content'
    });

    Pump.MajorActivityView = Pump.TemplateView.extend({
        templateName: 'major-activity',
        parts: ["responses",
                "reply"],
        model: Pump.Activity,
        events: {
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject",
            "click .comment": "openComment"
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.get("object")
                }),
                stream = Pump.currentUser.getStream();

            stream.create(act, {success: function(act) {
                view.$(".favorite")
                    .removeClass("favorite")
                    .addClass("unfavorite")
                    .html("Unlike <i class=\"icon-thumbs-down\"></i>");
            }});
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.get("object")
                }),
                stream = Pump.currentUser.getStream();

            stream.create(act, {success: function(act) {
                view.$(".unfavorite")
                    .removeClass("unfavorite")
                    .addClass("favorite")
                    .html("Like <i class=\"icon-thumbs-up\"></i>");
            }});
        },
        openComment: function() {
            var view = this,
                form = new Pump.CommentForm({model: view.model});

            form.$el.on("pump.rendered", function() {
                view.$(".replies").append(form.el);
            });

            form.render();
        }
    });

    Pump.CommentForm = Pump.TemplateView.extend({
        templateName: 'comment-form',
        tagName: "div",
        className: "row comment-form",
        model: Pump.Activity,
        events: {
            "submit .post-comment": "saveComment"
        },
        saveComment: function() {
            var view = this,
                text = view.$('textarea[name="content"]').val(),
                orig = view.model.get("object"),
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
                stream = Pump.currentUser.getStream();

            view.startSpin();

            stream.create(act, {success: function(act) {

                var object = new Pump.ActivityObject(act.get("object")),
                    repl;

                object.set("author", new Pump.Person(act.get("actor")));

                repl = new Pump.ReplyView({model: object});

                // These get stripped for "posts"; re-add it

                repl.$el.on("pump.rendered", function() {

                    view.stopSpin();

                    view.$el.replaceWith(repl.$el);
                });

                repl.render();

            }});

            return false;
        }
    });

    Pump.MajorObjectView = Pump.TemplateView.extend({
        templateName: 'major-object',
        parts: ["responses", "reply"],
        model: Pump.ActivityObject
    });

    Pump.MajorPersonView = Pump.TemplateView.extend({
        templateName: 'major-person',
        model: Pump.Person,
        modelName: 'person'
    });

    Pump.ReplyView = Pump.TemplateView.extend({
        templateName: 'reply',
        model: Pump.ActivityObject,
        modelName: 'reply'
    });

    Pump.MinorActivityView = Pump.TemplateView.extend({
        templateName: 'minor-activity',
        model: Pump.Activity
    });

    Pump.ProfileBlock = Pump.TemplateView.extend({
        templateName: 'profile-block',
        model: Pump.Person,
        modelName: 'profile'
    });

    Pump.FavoritesContent = Pump.TemplateView.extend({
        templateName: 'favorites',
        modelName: "profile",
        parts: ["profile-block",
                "object-stream",
                "major-object",
                "responses",
                "reply"],
        el: '#content'
    });

    Pump.FollowersContent = Pump.TemplateView.extend({
        templateName: 'followers',
        modelName: "profile",
        parts: ["profile-block",
                "people-stream",
                "major-person"],
        el: '#content'
    });

    Pump.FollowingContent = Pump.TemplateView.extend({
        templateName: 'following',
        modelName: "profile",
        parts: ["profile-block",
                "people-stream",
                "major-person"],
        el: '#content'
    });

    Pump.ActivityContent = Pump.TemplateView.extend({
        templateName: 'activity-content',
        modelName: "activity",
        el: '#content'
    });

    Pump.SettingsContent = Pump.TemplateView.extend({
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

    Pump.AccountContent = Pump.TemplateView.extend({
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

    Pump.PostNoteModal = Pump.TemplateView.extend({

        tagName: "div",
        className: "modal-holder",
        templateName: 'post-note',
        events: {
            "click #send-note": "postNote"
        },
        postNote: function(ev) {
            var view = this,
                text = view.$('#post-note #note-content').val(),
                act = new Pump.Activity({
                    verb: "post",
                    object: {
                        objectType: "note",
                        content: text
                    }
                }),
                stream = Pump.currentUser.getStream();

            view.startSpin();
            
            stream.create(act, {success: function(act) {
                view.$("#modal-note").modal('hide');
                view.stopSpin();
                view.$('#note-content').val("");
                // Reload the current page
            }});
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
            }

            return false;
        }
    });

    Pump.Router = Backbone.Router.extend({

        routes: {
            "":                       "home",    
            ":nickname":              "profile",   
            ":nickname/favorites":    "favorites",  
            ":nickname/following":    "following",  
            ":nickname/followers":    "followers",  
            ":nickname/activity/:id": "activity",
            "main/settings":          "settings",
            "main/account":           "account",
            "main/register":          "register",
            "main/login":             "login"
        },

        setTitle: function(view, title) {
            view.$el.one("pump.rendered", function() {
                $("title").html(title + " - " + Pump.config.site);
            });
        },

        register: function() {
            var content = new Pump.RegisterContent();

            this.setTitle(content, "Register");

            content.render();
        },

        login: function() {
            var content = new Pump.LoginContent();

            this.setTitle(content, "Login");

            content.render();
        },

        settings: function() {
            var content = new Pump.SettingsContent({model: Pump.currentUser.profile });

            this.setTitle(content, "Settings");

            content.render();
        },

        account: function() {
            var content = new Pump.AccountContent({model: Pump.currentUser});

            this.setTitle(content, "Account");

            content.render();
        },

        "home": function() {
            var router = this,
                pair = Pump.getUserCred();

            if (pair) {
                var user = Pump.currentUser,
                    major = user.getMajorInbox(),
                    minor = user.getMinorInbox();

                // XXX: parallelize

                user.fetch({success: function(user, response) {
                    major.fetch({success: function(major, response) {
                        minor.fetch({success: function(minor, response) {
                            var content = new Pump.InboxContent({model: user,
                                                                 data: {major: major,
                                                                        minor: minor}
                                                                });
                            router.setTitle(content, "Home");
                            content.$el.one("pump.rendered", function() {
                                content.$(".activity.major").each(function(i) {
                                    var id = $(this).attr("id"),
                                        act = major.get(id);
                                    var aview = new Pump.MajorActivityView({el: this, model: act});
                                });
                                content.$(".activity.minor").each(function(i) {
                                    var id = $(this).attr("id"),
                                        act = minor.get(id);
                                    var aview = new Pump.MinorActivityView({el: this, model: act});
                                });
                            });
                            content.render();
                        }});
                    }});
                }});
            } else {
                var content = new Pump.MainContent();
                router.setTitle(content, "Welcome");
                content.render();
            }
        },

        profile: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname}),
                major = user.getMajorStream(),
                minor = user.getMinorStream();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                major.fetch({success: function(major, response) {
                    minor.fetch({success: function(minor, response) {
                        var profile = user.profile,
                            content = new Pump.UserPageContent({model: profile,
                                                                data: { major: major,
                                                                        minor: minor }});

                        
                        router.setTitle(content, profile.get("displayName"));

                        content.$el.one("pump.rendered", function() {

                            // Helper view for the profile block

                            var block = new Pump.ProfileBlock({el: content.$(".profile-block"),
                                                               model: profile});

                            // Helper view for each major activity

                            content.$(".activity.major").each(function(i) {
                                var id = $(this).attr("id"),
                                    act = major.get(id);
                                var aview = new Pump.MajorActivityView({el: this, model: act});
                            });

                            // Helper view for each minor activity

                            content.$(".activity.minor").each(function(i) {
                                var id = $(this).attr("id"),
                                    act = minor.get(id);
                                var aview = new Pump.MinorActivityView({el: this, model: act});
                            });
                        });
                        content.render();
                    }});
                }});
            }});
        },

        favorites: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname}),
                favorites = user.getFavorites();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var profile = user.profile;
                favorites.fetch({success: function(major, response) {
                    var content = new Pump.FavoritesContent({model: profile,
                                                             data: { objects: favorites }});
                    router.setTitle(content, nickname + " favorites");
                    content.$el.one("pump.rendered", function() {

                        // Helper view for the profile block

                        var block = new Pump.ProfileBlock({el: content.$(".profile-block"),
                                                           model: profile});

                        // Helper view for each object

                        content.$(".object.major").each(function(i) {
                            var id = $(this).attr("id"),
                                obj = favorites.get(id);

                            var aview = new Pump.MajorObjectView({el: this, model: obj});
                        });
                    });
                    content.render();
                }});
            }});
        },

        followers: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname}),
                followers = user.getFollowersStream();

            user.fetch({success: function(user, response) {
                followers.fetch({success: function(followers, response) {
                    var profile = user.profile,
                        content = new Pump.FollowersContent({model: profile,
                                                             data: {people: followers }});
                    router.setTitle(content, nickname + " followers");
                    content.$el.one("pump.rendered", function() {

                        // Helper view for the profile block

                        var block = new Pump.ProfileBlock({el: content.$(".profile-block"),
                                                           model: profile});

                        // Helper view for each person

                        content.$(".person.major").each(function(i) {
                            var id = $(this).attr("id"),
                                person = followers.get(id);

                            var aview = new Pump.MajorPersonView({el: this, model: person});
                        });
                    });
                    content.render();
                }});
            }});
        },

        following: function(nickname) {
            var router = this,
                user = new Pump.User({nickname: nickname}),
                following = user.getFollowingStream();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                following.fetch({success: function(following, response) {
                    var profile = user.profile,
                        content = new Pump.FollowingContent({model: profile,
                                                             data: {people: following}});

                    router.setTitle(content, nickname + " following");
                    content.$el.one("pump.rendered", function() {

                        // Helper view for the profile block

                        var block = new Pump.ProfileBlock({el: content.$(".profile-block"),
                                                           model: profile});

                        // Helper view for each person

                        content.$(".person.major").each(function(i) {
                            var id = $(this).attr("id"),
                                person = following.get(id);

                            var aview = new Pump.MajorPersonView({el: this, model: person});
                        });
                    });
                    content.render();
                }});
            }});
        },

        activity: function(nickname, id) {
            var router = this,
                act = new Pump.Activity({uuid: id, userNickname: nickname});

            act.fetch({success: function(act, response) {
                var content = new Pump.ActivityContent({model: act});

                router.setTitle(content, act.content);
                content.render();
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

    $(document).ready(function() {

        var bv,
            nav,
            content;

        bv = new Pump.BodyView({router: Pump.router});

        nav = new Pump.AnonymousNav({el: ".navbar-inner .container"});

        // Initialize a view for the current content. Not crazy about this.

        if ($("#content #login").length > 0) {
            content = new Pump.LoginContent();
        } else if ($("#content #registration").length > 0) {
            content = new Pump.RegisterContent();
        } else if ($("#content #user").length > 0) {
            content = new Pump.UserPageContent({});
        } else if ($("#content #inbox").length > 0) {
            content = new Pump.InboxContent({});
        }

        $("abbr.easydate").easydate();

        Backbone.history.start({pushState: true, silent: true});

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

                    var nav, sp, continueTo;

                    Pump.currentUser = user;
                    nav = new Pump.UserNav({el: ".navbar-inner .container",
                                            model: Pump.currentUser});

                    nav.render();

                    // If we're on the login page, and there's a current
                    // user, redirect to the actual page

                    switch (window.location.pathname) {
                    case "/main/login":
                        content = new Pump.LoginContent();
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
