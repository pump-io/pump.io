(function($, Backbone) {

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

    // When errors happen, and you don't know what to do with them,
    // send them here and I'll figure it out.

    var pumpError = function(err) {
        console.log(err);
    };

    // A social activity.

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

    var ActivityObject = Backbone.Model.extend({
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

    var Person = ActivityObject.extend({
        objectType: "person"
    });

    var ActivityObjectStream = Backbone.Collection.extend({
        model: ActivityObject,
        parse: function(response) {
            return response.items;
        }
    });

    var PeopleStream = Backbone.Collection.extend({
        model: Person,
        parse: function(response) {
            return response.items;
        }
    });

    var UserFollowers = PeopleStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/followers";
        }
    });

    var UserFollowing = PeopleStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/following";
        }
    });

    var UserFavorites = ActivityObjectStream.extend({
        user: null,
        initialize: function(models, options) {
            this.user = options.user;
        },
        url: function() {
            return "/api/user/" + this.user.get("nickname") + "/favorites";
        }
    });

    var User = Backbone.Model.extend({
        idAttribute: "nickname",
        initialize: function() {
            this.profile = new Person(this.get("profile"));
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
        },
        getFollowersStream: function() {
            return new UserFollowers([], {user: this});
        },
        getFollowingStream: function() {
            return new UserFollowing([], {user: this});
        },
        getFavorites: function() {
            return new UserFavorites([], {user: this});
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
                        view.$el.html(html);
                        view.$el.trigger("pump.rendered");
                        // Update relative to the new code view
                        view.$("abbr.easydate").easydate();
                    }
                },
                base = (!view.model) ? {} : ((view.model.toJSON) ? view.model.toJSON() : view.model),
                main = _.clone(base),
                pc,
                cnt;

            // Add config stuff

            base = _.extend(base, config);

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
            "click #post-note-button": "postNoteModal",
            "click #profile-dropdown": "profileDropdown"
        },
        postNoteModal: function() {
            var view = this,
                modalView;

            if (view.postNote) {
                modalView = view.postNote;
            } else {
                modalView = new PostNoteModal({});
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
                    showError("Couldn't get OAuth credentials. :(");
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
                continueTo = getContinueTo(),
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
                    view.stopSpin();
                    pump.navigate(continueTo, true);
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

            ensureCred(function(err, cred) {
                if (err) {
                    view.showError("Couldn't get OAuth credentials. :(");
                } else {
                    options.consumerKey = cred.clientID;
                    options.consumerSecret = cred.clientSecret;
                    options = oauthify(options);
                    $.ajax(options);
                }
            });

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
                email = (config.requireEmail) ? view.$('#registration input[name="email"]').val() : null,
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
                    view.stopSpin();
                    // XXX: one-time on-boarding page
                    pump.navigate("", true);
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

            } else if (config.requireEmail && (!email || email.length == 0)) {

                view.showError("Email address required.");

            } else {

                if (config.requireEmail) {
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

                ensureCred(function(err, cred) {
                    if (err) {
                        view.showError("Couldn't get OAuth credentials. :(");
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
                majorActivity: "major-activity-headless",
                minorActivity: "minor-activity-headless"
               },
        el: '#content'
    });

    var InboxContent = TemplateView.extend({
        templateName: 'inbox',
        parts: {majorStream: "major-stream",
                sidebar: "sidebar",
                majorActivity: "major-activity",
                minorActivity: "minor-activity"
               },
        el: '#content'
    });

    var FavoritesContent = TemplateView.extend({
        templateName: 'favorites',
        parts: {profileBlock: "profile-block",
                objectStream: "object-stream",
                majorObject: "major-object"
               },
        el: '#content'
    });

    var FollowersContent = TemplateView.extend({
        templateName: 'followers',
        parts: {profileBlock: "profile-block",
                peopleStream: "people-stream",
                majorPerson: "major-person"
               },
        el: '#content'
    });

    var FollowingContent = TemplateView.extend({
        templateName: 'following',
        parts: {profileBlock: "profile-block",
                peopleStream: "people-stream",
                majorPerson: "major-person"
               },
        el: '#content'
    });

    var ActivityContent = TemplateView.extend({
        templateName: 'activity-content',
        el: '#content'
    });

    var SettingsContent = TemplateView.extend({
        templateName: 'settings',
        el: '#content',
        events: {
            "submit #settings": "saveSettings"
        },
        saveSettings: function() {

            var view = this,
                user = currentUser,
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

    var AccountContent = TemplateView.extend({
        templateName: 'account',
        el: '#content',
        events: {
            "submit #account": "saveAccount"
        },
        saveAccount: function() {
            var view = this,
                user = currentUser,
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

    var Pump = Backbone.Router.extend({

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
                $("title").html(title + " - " + config.site);
            });
        },

        register: function() {
            var content = new RegisterContent();

            this.setTitle(content, "Register");

            content.render();
        },

        login: function() {
            var content = new LoginContent();

            this.setTitle(content, "Login");

            content.render();
        },

        settings: function() {
            var content = new SettingsContent({model: currentUser});

            this.setTitle(content, "Settings");

            content.render();
        },

        account: function() {
            var content = new AccountContent({model: currentUser});

            this.setTitle(content, "Account");

            content.render();
        },

        "home": function() {
            var router = this,
                pair = getUserCred();

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
                            router.setTitle(content, "Home");
                            content.render();
                        }});
                    }});
                }});
            } else {
                var content = new MainContent({model: {site: config.site}});
                router.setTitle(content, "Welcome");
                content.render();
            }
        },

        profile: function(nickname) {
            var router = this,
                user = new User({nickname: nickname}),
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
                        router.setTitle(content, nickname);
                        content.render();
                    }});
                }});
            }});
        },

        favorites: function(nickname) {
            var router = this,
                user = new User({nickname: nickname}),
                favorites = user.getFavorites();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                var profile = user.get("profile");
                favorites.fetch({success: function(major, response) {
                    var content = new FavoritesContent({model: {profile: profile,
                                                                objects: favorites.toJSON()}});
                    router.setTitle(content, nickname + " favorites");
                    content.render();
                }});
            }});
        },

        followers: function(nickname) {
            var router = this,
                user = new User({nickname: nickname}),
                followers = user.getFollowersStream();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                followers.fetch({success: function(followers, response) {
                    var profile = user.get("profile"),
                        content = new FollowersContent({model: {profile: profile,
                                                                people: followers.toJSON()}});
                    router.setTitle(content, nickname + " followers");
                    content.render();
                }});
            }});
        },

        following: function(nickname) {
            var router = this,
                user = new User({nickname: nickname}),
                following = user.getFollowingStream();

            // XXX: parallelize this?

            user.fetch({success: function(user, response) {
                following.fetch({success: function(following, response) {
                    var profile = user.get("profile"),
                        content = new FollowingContent({model: {profile: profile,
                                                                people: following.toJSON()}});

                    router.setTitle(content, nickname + " following");
                    content.render();
                }});
            }});
        },

        activity: function(nickname, id) {
            var router = this,
                act = new Activity({uuid: id, userNickname: nickname});

            act.fetch({success: function(act, response) {
                var content = new ActivityContent({model: act});

                router.setTitle(content, act.content);
                content.render();
            }});
        }
    });

    var PostNoteModal = TemplateView.extend({

        tagname: "div",
        classname: "modal-holder",
        templateName: 'post-note',
        events: {
            "click #send-note": "postNote"
        },
        postNote: function(ev) {
            var view = this,
                text = view.$('#post-note #note-content').val(),
                act = new Activity({
                    verb: "post",
                    object: {
                        objectType: "note",
                        content: text
                    }
                }),
                stream = currentUser.getStream();

            view.startSpin();
            
            stream.create(act, {success: function(act) {
                view.$("#modal-note").modal('hide');
                view.stopSpin();
                view.$('#note-content').val("");
                // Reload the current page
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

                // FIXME: this only has client auth; get something with user auth (direct?)

                user.fetch({success: function(user, response) {

                    var nav, sp, continueTo;

                    currentUser = user;
                    nav = new UserNav({el: ".navbar-inner .container",
                                       model: {site: config.site,
                                               user: currentUser.toJSON()}});

                    nav.render();

                    // If we're on the login page, and there's a current
                    // user, redirect to the actual page

                    switch (window.location.pathname) {
                    case "/main/login":
                        content = new LoginContent();
                        continueTo = getContinueTo();
                        pump.navigate(continueTo, true);
                        break;
                    case "/":
                        pump.home();
                        break;
                    }
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

        $("abbr.easydate").easydate();

        Backbone.history.start({pushState: true, silent: true});

    });

})(window.jQuery, window.Backbone);
