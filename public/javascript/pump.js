// pump.js
//
// Entrypoint for the pump.io client UI
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

// Make sure this exists

if (!window.Pump) {
    window.Pump = {};
}

(function(_, $, Backbone, Pump) {

    // This is overwritten by inline script in layout.utml

    Pump.config = {};

    // Main entry point

    $(document).ready(function() {

        // Set up router

        Pump.router   = new Pump.Router();

        // Set up initial view

        Pump.body     = new Pump.BodyView({el: $("body")});
        Pump.body.nav = new Pump.AnonymousNav({el: ".navbar-inner .container"});

        // XXX: Make this more complete

        Pump.initialContentView();

        $("abbr.easydate").easydate();

        Backbone.history.start({pushState: true, silent: true});

        Pump.setupWysiHTML5();

        // Refresh the streams automatically every 60 seconds
        // This is a fallback in case something gets lost in the
        // SockJS conversation

        Pump.refreshStreamsID = setInterval(Pump.refreshStreams, 60000);

        // Connect to current server

        if (Pump.config.sockjs) {
            Pump.setupSocket();
        }

        Pump.setupInfiniteScroll();

        if (Pump.principalUser) {
            Pump.principalUser = Pump.User.unique(Pump.principalUser);
            Pump.principal = Pump.Person.unique(Pump.principal);
            Pump.body.nav = new Pump.UserNav({el: Pump.body.$(".navbar-inner .container"),
                                              model: Pump.principalUser,
                                              data: {
                                                  messages: Pump.principalUser.majorDirectInbox,
                                                  notifications: Pump.principalUser.minorDirectInbox
                                              }});
            // If we're on a login page, go to the main page or whatever
            switch (window.location.pathname) {
            case "/main/login":
            case "/main/register":
            case "/main/remote":
                Pump.router.navigate(Pump.getContinueTo(), true);
                break;
            default:
                break;
            }
        } else if (Pump.principal) {
            Pump.principal = Pump.Person.unique(Pump.principal);
            Pump.body.nav = new Pump.RemoteNav({el: Pump.body.$(".navbar-inner .container"),
                                                model: Pump.principal});
            // If we're on a login page, go to the main page or whatever
            switch (window.location.pathname) {
            case "/main/login":
            case "/main/register":
            case "/main/remote":
                Pump.router.navigate(Pump.getContinueTo(), true);
                break;
            default:
                break;
            }
        } else {
            // Check if we have stored OAuth credentials

            Pump.ensureCred(function(err, cred) {

                var nickname, pair;

                if (err) {
                    Pump.error(err.message);
                    return;
                }

                pair = Pump.getUserCred();

                if (pair) {
                    
                    // We need to renew the session, for images and objects and so on.

                    Pump.renewSession(function(err, data) {

                        var user, major, minor;

                        if (err) {
                            Pump.error(err);
                            Pump.clearUserCred();
                            return;
                        }

                        user = Pump.principalUser = Pump.User.unique(data);
                        Pump.principal = Pump.principalUser.profile;

                        major = user.majorDirectInbox;
                        minor = user.minorDirectInbox;

                        Pump.fetchObjects([major, minor], function(err, objs) {
                            var sp, continueTo;

                            if (err) {
                                Pump.clearUserCred();
                                Pump.error(err);
                                return;
                            }

                            Pump.principalUser = user;

                            Pump.body.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                              model: user,
                                                              data: {
                                                                  messages: major,
                                                                  notifications: minor
                                                              }});
                            Pump.body.nav.render();

                            // If we're on the login page, and there's a current
                            // user, redirect to the actual page

                            switch (window.location.pathname) {
                            case "/main/login":
                                Pump.body.content = new Pump.LoginContent();
                                continueTo = Pump.getContinueTo();
                                Pump.router.navigate(continueTo, true);
                                break;
                            case "/":
                                Pump.router.home();
                                break;
                            }
                        });
                    });
                }
            });
        }

        // If there's anything queued up in our onReady array, run it

        if (Pump.onReady) {
            _.each(Pump.onReady, function(f) {
                f();
            });
        }
    });

    // Renew the cookie session

    Pump.renewSession = function(callback) {

        var options = {
            dataType: "json",
            type: "POST",
            url: "/main/renew",
            success: function(data, textStatus, jqXHR) {
                callback(null, data);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                callback(new Error("Failed to renew"), null);
            }
        };

        Pump.ajax(options);
    };

    // When errors happen, and you don't know what to do with them,
    // send them here and I'll figure it out.

    Pump.error = function(err) {
        if (window.console) {
            console.log(err);
            if (err.stack) {
                console.log(err.stack);
            }
        }
    };

    // For debugging output

    Pump.debug = function(msg) {
        if (Pump.config.debugClient && window.console) {
            console.log(msg);
        }
    };

    // Given a relative URL like /main/register, make a fully-qualified
    // URL on the current server

    Pump.fullURL = function(url) {

        var here = window.location;

        if (url.indexOf(':') == -1) {
            if (url.substr(0, 1) == '/') {
                url = here.protocol + '//' + here.host + url;
            } else {
                url = here.href.substr(0, here.href.lastIndexOf('/') + 1) + url;
            }
        }

        return url;
    };

    // Add some OAuth magic to the arguments for a $.ajax() call

    Pump.oauthify = function(options) {

        options.url = Pump.fullURL(options.url);

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

    Pump.fetchObjects = function(orig, callback) {
        var fetched = 0,
            objs = (orig.length) > 0 ? orig.slice(0) : [], // make a dupe in case arg is changed
            count = objs.length,
            done = false,
            onSuccess = function() {
                if (!done) {
                    fetched++;
                    if (fetched >= count) {
                        done = true;
                        callback(null, objs);
                    }
                }
            },
            onError = function(xhr, status, thrown) {
                if (!done) {
                    done = true;
                    if (thrown) {
                        callback(thrown, null);
                    } else {
                        callback(new Error(status), null);
                    }
                }
            };

        _.each(objs, function(obj) {
            try {
                if (_.isFunction(obj.prevLink) && obj.prevLink()) {
                    obj.getPrev(function(err) {
                        if (err) {
                            onError(null, null, err);
                        } else {
                            onSuccess();
                        }
                    });
                } else {
                    obj.fetch({update: true,
                               success: onSuccess,
                               error: onError});
                }
            } catch (e) {
                onError(null, null, e);
            }
        });
    };

    // Not the most lovely, but it works
    // XXX: change this to use UTML templating instead

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

    // Most long-form descriptions and notes use this lib for editing

    Pump.setupWysiHTML5 = function() {

        // Set wysiwyg defaults

        $.fn.wysihtml5.defaultOptions["font-styles"] = false;
        $.fn.wysihtml5.defaultOptions["image"] = false;
        $.fn.wysihtml5.defaultOptions["customTemplates"] = Pump.wysihtml5Tmpl;
    };

    // Turn the querystring into an object

    Pump.searchParams = function(str) {
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

    Pump.continueTo = null;

    // Get the "continue" param

    Pump.getContinueTo = function() {
        var sp = Pump.searchParams(),
            continueTo = (_.has(sp, "continue")) ? sp["continue"] : null;

        if (continueTo && continueTo.length > 0 && continueTo[0] == "/") {
            return continueTo;
        } else if (Pump.continueTo) {
            continueTo = Pump.continueTo;
            return continueTo;
        } else {
            return "";
        }
    };

    Pump.saveContinueTo = function() {
        Pump.continueTo = window.location.pathname + window.location.search;
    };

    Pump.clearContinueTo = function() {
        Pump.continueTo = null;
    };

    // We clear out cached stuff when login state changes

    Pump.clearCaches = function() {
        Pump.Model.clearCache();
        Pump.User.clearCache();
    };

    Pump.ajax = function(options) {
        // For remote users, we use session auth
        if (Pump.principal && !Pump.principalUser && options.type == "GET") {
            $.ajax(options);
        } else {
            Pump.ensureCred(function(err, cred) {
                var pair;
                if (err) {
                    Pump.error("Couldn't get OAuth credentials. :(");
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
    };

    Pump.setupInfiniteScroll = function() {

        var didScroll = false;

        // scroll fires too fast, so just use the handler
        // to set a flag, and check that flag with an interval

        // From http://ejohn.org/blog/learning-from-twitter/

        $(window).scroll(function() {
            didScroll = true;
        });

        setInterval(function() {
            var streams;
            if (didScroll) {
                didScroll = false;
                if ($(window).scrollTop() >= $(document).height() - $(window).height() - 10) {
                    streams = Pump.getStreams();
                    if (streams.major && streams.major.nextLink()) {
                        Pump.body.startLoad();
                        streams.major.getNext(function(err) {
                            Pump.body.endLoad();
                        });
                    }
                }
            }
        }, 250);
    };

    // XXX: this is cheeseball.

    Pump.rel = function(url) {

        var a = document.createElement('a'),
            pathname;

        a.href = url;
        pathname = a.pathname;

        return pathname;
    };

    Pump.htmlEncode = function(value) {
        return $('<div/>').text(value).html();
    };

    Pump.htmlDecode = function(value) {
        return $('<div/>').html(value).text();
    };

    // Sets up the initial view and sub-views

    Pump.initialContentView = function() {

        var $content = $("#content"),
            selectorToView = {
                "#main": {View: Pump.MainContent},
                "#loginpage": {View: Pump.LoginContent},
                "#registerpage": {View: Pump.RegisterContent},
                "#recoverpage": {View: Pump.RecoverContent},
                "#recoversentpage": {View: Pump.RecoverSentContent},
                "#recover-code": {View: Pump.RecoverCodeContent},
                "#inbox": {View: Pump.InboxContent, models: {major: Pump.ActivityStream, minor: Pump.ActivityStream}},
                ".object-page": {View: Pump.ObjectContent, models: {object: Pump.ActivityObject}},
                ".major-activity-page": {View: Pump.ActivityContent, models: {activity: Pump.Activity}},
                ".user-activities": {View: Pump.UserPageContent, models: {profile: Pump.Person,
                                                                          major: Pump.ActivityStream,
                                                                          minor: Pump.ActivityStream}},
                ".user-favorites": {View: Pump.FavoritesContent, models: {profile: Pump.Person,
                                                                          favorites: Pump.ActivityObjectStream}},
                ".user-followers": {View: Pump.FollowersContent, models: {profile: Pump.Person,
                                                                          followers: Pump.PeopleStream}},
                ".user-following": {View: Pump.FollowingContent, models: {profile: Pump.Person,
                                                                          following: Pump.PeopleStream}},
                ".user-lists": {View: Pump.ListsContent, models: {profile: Pump.Person,
                                                                  lists: Pump.ActivityObjectStream}},
                ".user-list": {View: Pump.ListContent, models: {profile: Pump.Person,
                                                                lists: Pump.ActivityObjectStream,
                                                                list: Pump.ActivityObject}}
            },
            selector,
            $el,
            model,
            options,
            def,
            data,
            View;

        // When I say "view" the crowd say "selector"

        for (selector in selectorToView) {
            if (_.has(selectorToView, selector)) {
                $el = $content.find(selector);
                if ($el.length > 0) {
                    def = selectorToView[selector];
                    View = def.View;
                    options = {el: $el, data: {}};
                    data = Pump.initialData;
                    _.each(data, function(value, name) {
                        if (name == View.prototype.modelName) {
                            options.model = def.models[name].unique(value);
                        } else if (def.models[name]) {
                            options.data[name] = def.models[name].unique(value);
                        } else {
                            options.data[name] = value;
                        }
                    });
                    Pump.body.content = new View(options);
                    Pump.initialData = null;
                    break;
                }
            }
        }

        // XXX: set up initial data
    };

    Pump.newMinorActivity = function(act, callback) {
        if (Pump.principalUser) {
            Pump.addToStream(Pump.principalUser.minorStream, act, callback);
        } else {
            Pump.proxyActivity(act, callback);
        }
    };


    Pump.newMajorActivity = function(act, callback) {
        if (Pump.principalUser) {
            Pump.addToStream(Pump.principalUser.majorStream, act, callback);
        } else {
            Pump.proxyActivity(act, callback);
        }
    };

    Pump.addToStream = function(stream, act, callback) {
        stream.items.create(act, {
            success: function(act) {
                callback(null, act);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var type, response;
                type = jqXHR.getResponseHeader("Content-Type");
                if (type && type.indexOf("application/json") !== -1) {
                    response = JSON.parse(jqXHR.responseText);
                    callback(new Error(response.error), null);
                } else {
                    callback(new Error(errorThrown), null);
                }
            }
        });
    };

    // XXX: This POSTs with session auth; subject to XSS.

    Pump.proxyActivity = function(act, callback) {
        $.ajax({
            contentType: "application/json",
            data: JSON.stringify(act),
            dataType: "json",
            type: "POST",
            url: "/main/proxy",
            success: function(act) {
                callback(null, act);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var type, response;
                type = jqXHR.getResponseHeader("Content-Type");
                if (type && type.indexOf("application/json") !== -1) {
                    response = JSON.parse(jqXHR.responseText);
                    callback(new Error(response.error), null);
                } else {
                    callback(new Error(errorThrown), null);
                }
            }
        });
    };

    Pump.setTitle = function(title) {
        $("title").html(title + " - " + Pump.config.site);
    };

})(window._, window.$, window.Backbone, window.Pump);
