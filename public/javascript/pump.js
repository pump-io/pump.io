(function($, Backbone) {

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
            params.url = getValue(model, 'url');
            if (!params.url) { 
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

        ensureCred(function(err, cred) {
            var pair;
            if (err) {
                console.log("Error getting OAuth credentials.");
            } else {
                params = _.extend(params, options);

                params.consumerKey = cred.clientID;
                params.consumerSecret = cred.clientSecret;

                pair = getUserCred();

                if (pair) {
                    params.token = pair.token;
                    params.tokenSecret = pair.secret;
                }

                params = oauthify(params);

                $.ajax(params);
            }
        });

        return null;
    };

    var pumpError = function(err) {
        console.log(err);
    };

    var Activity = Backbone.Model.extend({
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

    var oauthify = function(options) {

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

    var ActivityStream = Backbone.Collection.extend({
        model: Activity,
        parse: function(response) {
            return response.items;
        }
    });

    var UserStream = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed";
        }
    });

    var UserMajorStream = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed/major";
        }
    });

    var UserMinorStream = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/feed/minor";
        }
    });

    var UserInbox = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox";
        }
    });

    var UserMajorInbox = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox/major";
        }
    });

    var UserMinorInbox = ActivityStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/inbox/minor";
        }
    });

    var Person = Backbone.Model.extend({
        url: function() {
            var links = this.get("links"),
                uuid = this.get("uuid");
            if (links && _.isObject(links) && links.self) {
                return links.self;
            } else if (uuid) {
                return "/api/person/" + uuid;
            } else {
                return null;
            }
        }
    });

    var User = Backbone.Model.extend({
        initialize: function() {
            this.profile = new Person(this.get("profile"));
        },
        url: function() {
            return "/api/user/" + this.get("nickname");
        },
        getStream: function() {
            return new UserStream([], {user: this});
        },
        getMajorStream: function() {
            return new UserMajorStream([], {user: this});
        },
        getMinorStream: function() {
            return new UserMinorStream([], {user: this});
        },
        getInbox: function() {
            return new UserInbox([], {user: this});
        },
        getMajorInbox: function() {
            return new UserMajorInbox([], {user: this});
        },
        getMinorInbox: function() {
            return new UserMinorInbox([], {user: this});
        }
    });

    var currentUser = null; // XXX: load from server...?

    var templates = {};

    var TemplateView = Backbone.View.extend({
        templateName: null,
        parts: null,
        render: function() {
            var view = this,
                getTemplate = function(name, cb) {
                    var url;
                    if (_.has(templates, name)) {
                        cb(null, templates[name]);
                    } else {
                        $.get('/template/'+name+'.utml', function(data) {
                            var f;
                            try {
                                f = _.template(data);
                                templates[name] = f;
                            } catch (err) {
                                cb(err, null);
                                return;
                            }
                            cb(null, f);
                        });
                    }
                },
                runTemplate = function(template, data, cb) {
                    var html;
                    try {
                        html = template(data);
                    } catch (err) {
                        cb(err, null);
                        return;
                    }
                    cb(null, html);
                },
                setOutput = function(err, html) {
                    if (err) {
                        pumpError(err);
                    } else {
                        $(view.el).html(html);
                    }
                },
                base = (!view.model) ? {} : ((view.model.toJSON) ? view.model.toJSON() : view.model),
                main = _.clone(base),
                pc,
                cnt;

            // If there are sub-parts, we do them in parallel then
            // do the main one. Note: only one level.

            if (view.parts) {
                pc = 0;
                cnt = _.keys(view.parts).length;
                _.each(view.parts, function(templateName, partName) {
                    getTemplate(templateName, function(err, template) {
                        if (err) {
                            pumpError(err);
                        } else {
                            pc++;
                            main[partName] = template;
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
        }
    });

    var AnonymousNav = TemplateView.extend({
        tagname: "div",
        classname: "nav",
        templateName: 'nav-anonymous'
    });

    var UserNav = TemplateView.extend({
        tagname: "div",
        classname: "nav",
        templateName: 'nav-loggedin',
        events: {
            "click #logout": "logout",
            "click #profile-dropdown": "profileDropdown"
        },
        profileDropdown: function() {
            $('#profile-dropdown').dropdown();
        },
        logout: function() {
            var view = this,
                options,
                onSuccess = function(data, textStatus, jqXHR) {
                    var an;
                    currentUser = null;

                    setNickname(null);
                    setUserCred(null, null);

                    an = new AnonymousNav({el: ".navbar-inner .container", model: {site: config.site}});
                    an.render();

                    // Reload to clear authenticated stuff

                    pump.navigate(window.location.pathname+"?logout=true", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    showError(errorThrown);
                },
                showError = function(msg) {
                    console.log(msg);
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

            ensureCred(function(err, cred) {
                var pair;
                if (err) {
                    showError(null, "Couldn't get OAuth credentials. :(");
                } else {
                    options.consumerKey = cred.clientID;
                    options.consumerSecret = cred.clientSecret;
                    pair = getUserCred();

                    if (pair) {
                        options.token = pair.token;
                        options.tokenSecret = pair.secret;
                    }

                    options = oauthify(options);
                    $.ajax(options);
                }
            });
        }
    });

    var MainContent = TemplateView.extend({
        templateName: 'main',
        el: '#content'
    });

    var LoginContent = TemplateView.extend({
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
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                onSuccess = function(data, textStatus, jqXHR) {
                    var nav;
                    setNickname(data.nickname);
                    setUserCred(data.token, data.secret);
                    currentUser = new User(data);
                    nav = new UserNav({el: ".navbar-inner .container",
                                       model: {site: config.site,
                                               user: currentUser.toJSON()}});
                    nav.render();
                    // XXX: reload current data
                    view.$(':submit').spin(false);
                    pump.navigate("", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    view.$(':submit').prop('disabled', false).spin(false);
                    showError(null, errorThrown);
                },
                showError = function(input, msg) {
                    console.log(msg);
                };

            if (!NICKNAME_RE.test(params.nickname)) {

                showError("nickname", "Nicknames have to be a combination of 1-64 letters or numbers and ., - or _.");

            } else if (params.password.length < 8) {

                showError("password", "Password must be 8 chars or more.");

            } else if (/^[a-z]+$/.test(params.password.toLowerCase()) ||
                       /^[0-9]+$/.test(params.password)) {

                showError("password", "Passwords have to have at least one letter and one number.");

            } else {

                view.$(':submit').prop('disabled', true).spin(true);

                options = {
                    contentType: "application/json",
                    data: JSON.stringify(params),
                    dataType: "json",
                    type: "POST",
                    url: "/main/login",
                    success: onSuccess,
                    error: onError
                };

                ensureCred(function(err, cred) {
                    if (err) {
                        showError(null, "Couldn't get OAuth credentials. :(");
                    } else {
                        options.consumerKey = cred.clientID;
                        options.consumerSecret = cred.clientSecret;
                        options = oauthify(options);
                        $.ajax(options);
                    }
                });
            }

            return false;
        }
    });

    var RegisterContent = TemplateView.extend({
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
                options,
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                onSuccess = function(data, textStatus, jqXHR) {
                    var nav;
                    setNickname(data.nickname);
                    setUserCred(data.token, data.secret);
                    currentUser = new User(data);
                    nav = new UserNav({el: ".navbar-inner .container", model: {site: config.site,
                                                                               user: currentUser.toJSON()}});
                    nav.render();
                    // Leave disabled
                    view.$(':submit').spin(false);
                    // XXX: one-time on-boarding page
                    pump.navigate("", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    view.$(':submit').prop("disabled", false).spin(false);
                    if (jqXHR.responseType == "json") {
                        showError(jqXHR.response.error);
                    } else if (jqXHR.status == 409) { // conflict
                        showError("A user with that nickname already exists", "nickname");
                    } else {
                        showError(errorThrown);
                    }
                },
                showError = function(msg, input) {
                    if (input) {
                        $('#registration input[name="'+input+'"]').addClass('error');
                    }
                    $('#registration #error').text(msg);
                    console.log(msg);
                };

            if (params.password !== repeat) {

                showError("Passwords don't match.", "password");

            } else if (!NICKNAME_RE.test(params.nickname)) {

                showError("Nicknames have to be a combination of 1-64 letters or numbers and ., - or _.", "nickname");

            } else if (params.password.length < 8) {

                showError("Password must be 8 chars or more.", "password");

            } else if (/^[a-z]+$/.test(params.password.toLowerCase()) ||
                       /^[0-9]+$/.test(params.password)) {

                showError("Passwords have to have at least one letter and one number.", "password");

            } else {

                view.$(':submit').prop("disabled", true).spin(true);

                options = {
                    contentType: "application/json",
                    data: JSON.stringify(params),
                    dataType: "json",
                    type: "POST",
                    url: "/api/users",
                    success: onSuccess,
                    error: onError
                };

                ensureCred(function(err, cred) {
                    if (err) {
                        showError("Couldn't get OAuth credentials. :(");
                    } else {
                        options.consumerKey = cred.clientID;
                        options.consumerSecret = cred.clientSecret;
                        options = oauthify(options);
                        $.ajax(options);
                    }
                });
            }

            return false;
        }
    });

    var UserPageContent = TemplateView.extend({
        templateName: 'user',
        parts: {profileBlock: "profile-block",
                majorStream: "major-stream",
                sidebar: "sidebar",
                majorActivity: "major-activity",
                minorActivity: "minor-activity"
               },
        el: '#content'
    });

    var InboxContent = TemplateView.extend({
        templateName: 'inbox',
        el: '#content'
    });

    var ActivityContent = TemplateView.extend({
        templateName: 'activity-content',
        el: '#content'
    });

    var SettingsContent = TemplateView.extend({
        initialize: function() {
            _.bindAll(this, "saveSettings");
        },
        templateName: 'settings-content',
        el: '#content',
        events: {
            "submit #settings": "saveSettings"
        },
        saveSettings: function() {

            var view = this,
                user = currentUser,
                profile = user.profile;

            user.set({"password": this.$("#password").val()});

            user.save();

            profile.set({"displayName": this.$('#realname').val(),
                         "window.location": { displayName: this.$('#window.location').val() },
                         "summary": this.$('#bio').val()});

            profile.save();

            return false;
        }
    });

    var Pump = Backbone.Router.extend({

        routes: {
            "":                       "home",    
            ":nickname":              "profile",   
            ":nickname/inbox":        "inbox",  
            ":nickname/activity/:id": "activity",
            "main/settings":          "settings",
            "main/register":          "register",
            "main/login":             "login"
        },

        register: function() {
            var content = new RegisterContent();

            content.render();
        },

        login: function() {
            var content = new LoginContent();

            content.render();
        },

        settings: function() {
            var content = new SettingsContent({model: currentUser});

            content.render();
        },

        "home": function() {
            var pair = getUserCred();

            if (pair) {
                var user = currentUser,
                    major = user.getMajorInbox(),
                    minor = user.getMinorInbox();

                // XXX: parallelize

                user.fetch({success: function(user, response) {
                    major.fetch({success: function(major, response) {
                        minor.fetch({success: function(minor, response) {
                            var content = new InboxContent({model: {user: user.toJSON(),
                                                                    major: major.toJSON(),
                                                                    minor: minor.toJSON()}});
                            content.render();
                        }});
                    }});
                }});
            } else {
                var content = new MainContent({model: {site: config.site}});
                content.render();
            }
        },

        profile: function(nickname) {
            var user = new User({nickname: nickname}),
                major = user.getMajorStream(),
                minor = user.getMinorStream();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                major.fetch({success: function(major, response) {
                    minor.fetch({success: function(minor, response) {
                        var profile = user.get("profile"),
                            content = new UserPageContent({model: {profile: profile,
                                                                   major: major.toJSON(),
                                                                   minor: minor.toJSON()}});
                        content.render();
                    }});
                }});
            }});
        },

        inbox: function(nickname) {
        },

        activity: function(nickname, id) {
            var act = new Activity({uuid: id, userNickname: nickname});

            act.fetch({success: function(act, response) {
                var content = new ActivityContent({model: act});

                content.render();
            }});
        }
    });

    var BodyView = Backbone.View.extend({
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

    var clientID,
        clientSecret,
        nickname,
        token,
        secret,
        credReq;

    var setNickname = function(userNickname) {
        nickname = userNickname;
        if (localStorage) {
            localStorage['cred:nickname'] = userNickname;
        }
    };

    var getNickname = function() {
        if (nickname) {
            return nickname;
        } else if (localStorage) {
            return localStorage['cred:nickname'];
        } else {
            return null;
        }
    };

    var getCred = function() {
        if (clientID) {
            return {clientID: clientID, clientSecret: clientSecret};
        } else if (localStorage) {
            clientID = localStorage['cred:clientID'];
            clientSecret = localStorage['cred:clientSecret'];
            if (clientID) {
                return {clientID: clientID, clientSecret: clientSecret};
            } else {
                return null;
            }
        } else {
            return null;
        }
    };

    var getUserCred = function(nickname) {
        if (token) {
            return {token: token, secret: secret};
        } else if (localStorage) {
            token = localStorage['cred:token'];
            secret = localStorage['cred:secret'];
            return {token: token, secret: secret};
        } else {
            return null;
        }
    };

    var setUserCred = function(userToken, userSecret) {
        token = userToken;
        secret = userSecret;
        if (localStorage) {
            localStorage['cred:token'] = userToken;
            localStorage['cred:secret'] = userSecret;
        }
        return;
    };

    var ensureCred = function(callback) {
        var cred = getCred();
        if (cred) {
            callback(null, cred);
        } else if (credReq) {
            credReq.success(function(data) {
                callback(null, {clientID: data.client_id,
                                clientSecret: data.client_secret});
            });
            credReq.error(function() {
                callback(new Error("error getting credentials"), null);
            });
        } else {
            credReq = $.post("/api/client/register",
                             {type: "client_associate",
                              application_name: config.site + " Web",
                              application_type: "web"},
                             function(data) {
                                 credReq = null;
                                 clientID = data.client_id;
                                 clientSecret = data.client_secret;
                                 if (localStorage) {
                                     localStorage['cred:clientID'] = clientID;
                                     localStorage['cred:clientSecret'] = clientSecret;
                                 }
                                 callback(null, {clientID: clientID,
                                                 clientSecret: clientSecret});
                             },
                             "json");
            credReq.error(function() {
                callback(new Error("error getting credentials"), null);
            });
        }
    };

    var pump;

    $(document).ready(function() {

        var bv,
            nav,
            content;

        pump = new Pump();

        bv = new BodyView({router: pump});

        nav = new AnonymousNav({el: ".navbar-inner .container"});

        ensureCred(function(err, cred) {
            var user, nickname, pair;

            if (err) {
                console.log(err.message);
                return;
            }

            nickname = getNickname();

            if (nickname) {

                user = new User({nickname: nickname});

                // XXX: this only has client auth; get something with user auth (direct?)

                user.fetch({success: function(user, response) {
                    currentUser = user;
                    var nav = new UserNav({el: ".navbar-inner .container",
                                           model: {site: config.site,
                                                   user: currentUser.toJSON()}});
                    nav.render();
                }});

                // Re-navigate since we've got credentials

                pump.navigate(window.location.pathname, true);
            }
        });

        // Initialize a view for the current content. Not crazy about this.

        if ($("#content #login").length > 0) {
            content = new LoginContent();
        } else if ($("#content #registration").length > 0) {
            content = new RegisterContent();
        } else if ($("#content #user").length > 0) {
            content = new UserPageContent({});
        } else if ($("#content #inbox").length > 0) {
            content = new InboxContent({});
        }

        Backbone.history.start({pushState: true, silent: true});

    });

})(window.jQuery, window.Backbone);
