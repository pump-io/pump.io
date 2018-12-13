// pump.js
//
// Entrypoint for the pump.io client UI
//
// @licstart  The following is the entire license notice for the
//  JavaScript code in this page.
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
//
// @licend  The above is the entire license notice
// for the JavaScript code in this page.

// Make sure this exists

if (!window.Pump) {
    window.Pump = {};
}

(function(_, $, Backbone, Pump) {

    "use strict";

    // Private instance
    var _pump = {};

    // This is overwritten by inline script in layout.jade

    Pump.config = {};

    // Compatibility override - Backbone 1.1 got rid of the 'options' binding
    // automatically to views in the constructor - we need to keep that.
    // https://stackoverflow.com/a/19431552/1198896
    Backbone.View = (function(View) {
        return View.extend({
            constructor: function(options) {
                this.options = options || {};
                View.apply(this, arguments);
            }
        });
    })(Backbone.View);

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
            Pump.enableNotify();
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
            Pump.enableNotify();
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
                    Pump.error(err);
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

                        Pump.enableNotify();
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
        var msg;

        if (_.isString(err)) {
            msg = err;
        } else if (_.isObject(err)) {
            msg = err.message;
            if (err.stack) {
                console.log(err.stack);
            }
        } else {
            msg = "An error occurred.";
        }

        console.log(msg);

        if (Pump.body && Pump.body.nav) {
            var $nav = Pump.body.nav.$el,
                $alert = $("#error-popup");

            if ($alert.length === 0) {
                $alert = $('<div id="error-popup" class="alert-error" style="display: none; margin-top: 0px; text-align: center">'+
                           '<button type="button" class="close" data-dismiss="alert">&times;</button>'+
                           '<span class="error-message">'+msg+"</span>"+
                           "</div>");
                $nav.after($alert);
                $alert.slideDown("fast");
            } else {
                $(".error-message", $alert).text(msg);
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

        if (url.indexOf(":") == -1) {
            if (url.substr(0, 1) == "/") {
                url = here.protocol + "//" + here.host + url;
            } else {
                url = here.href.substr(0, here.href.lastIndexOf("/") + 1) + url;
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
                            if (obj.items.length < 20 &&
                                _.isFunction(obj.nextLink) && obj.nextLink()) {
                                obj.getNext(function(err) {
                                    if (err) {
                                        onError(null, null, err);
                                    } else {
                                        onSuccess();
                                    }
                                });
                            } else {
                                onSuccess();
                            }
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
                "<a class='btn' data-wysihtml5-command='bold' title='"+locale.emphasis.bold+"'><i class='fa fa-bold'></i></a>" +
                "<a class='btn' data-wysihtml5-command='italic' title='"+locale.emphasis.italic+"'><i class='fa fa-italic'></i></a>" +
                "<a class='btn' data-wysihtml5-command='underline' title='"+locale.emphasis.underline+"'>_</a>" +
                "</div>" +
                "</li>";
        }
    };

    // Most long-form descriptions and notes use this lib for editing

    Pump.setupWysiHTML5 = function() {

        // Set wysiwyg defaults

        $.fn.wysihtml5.defaultOptions["font-styles"] = false;
        $.fn.wysihtml5.defaultOptions.image = false;
        $.fn.wysihtml5.defaultOptions.customTemplates = Pump.wysihtml5Tmpl;
    };

    // Turn the querystring into an object

    Pump.searchParams = function(str) {
        var params = {},
            pl     = /\+/g,
            decode = function(s) { return decodeURIComponent(s.replace(pl, " ")); },
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
        var jqxhr;
        // For remote users, we use session auth
        if (Pump.principal && !Pump.principalUser && options.type == "GET") {
            jqxhr = $.ajax(options);
            if (_.isFunction(options.started)) {
                options.started(jqxhr);
            }
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
                    jqxhr = $.ajax(options);
                    if (_.isFunction(options.started)) {
                        options.started(jqxhr);
                    }
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

        var a = document.createElement("a"),
            pathname;

        a.href = url;
        pathname = a.pathname;

        return pathname;
    };

    Pump.htmlEncode = function(value) {
        return $("<div/>").text(value).html();
    };

    Pump.htmlDecode = function(value) {
        return $("<div/>").html(value).text();
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
                                                                members: Pump.PeopleStream,
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

        function processInitialData(value, name) {
            if (name == View.prototype.modelName) {
                options.model = def.models[name].unique(value);
            } else if (def.models[name]) {
                options.data[name] = def.models[name].unique(value);
            } else {
                options.data[name] = value;
            }
        }

        for (selector in selectorToView) {
            if (_.has(selectorToView, selector)) {
                $el = $content.find(selector);
                if ($el.length > 0) {
                    def = selectorToView[selector];
                    View = def.View;
                    options = {el: $el, data: {}};
                    data = Pump.initialData;
                    _.each(data, processInitialData);
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
            wait: true,
            success: function(act) {
                callback(null, act);
            },
            error: function(model, xhr, options) {
                var type, response;
                type = xhr.getResponseHeader("Content-Type");
                if (type && type.indexOf("application/json") !== -1) {
                    response = JSON.parse(xhr.responseText);
                    callback(new Error(response.error), null);
                } else {
                    callback(new Error("Error saving activity: " + model.id), null);
                }
            }
        });
    };

    Pump.enableNotify = function() {
        var Notification = window.Notification;

        // Check if the browser supports notifications, otherwise do nothing
        if (!Notification) {
            _pump.notifyPermission = "unsupported";
        }

        // respectful if the user has denied notifications
        if (Notification.permission !== "denied") {

            Notification.requestPermission(function(permission) {
                // If the user accepts, let's create a notification
                _pump.notifyPermission = permission;
            });
        }
    };

    Pump.sendNotify = function(url, model) {
        var activity = model.toJSON(),
            userModel = Pump.principalUser || Pump.principal,
            user = userModel ? userModel.toJSON() : null,
            actor = activity.actor;

        if (!user || !actor) {
            return;
        }

        user = user.profile || user;

        // Prevent send notification for same user or previous notification
        // and no bother every time, only every 5 minutes
        var lastNotify = _pump.notifyLast,
            everyTime = 60000 * 5,
            lastTime = _.get(lastNotify, "sended"),
            diffUpdate =  (Date.now() - new Date(activity.updated).getTime()),
            diffTime = (Date.now() - new Date(lastTime || null).getTime()),
            isDirect = _.find(activity.to, {id: user.id}),
            isRecent = diffUpdate < (60000 * 30);

        if (!isRecent || actor.id === user.id ||
            _.get(lastNotify, "id") === activity.id ||
            (diffTime < everyTime && !isDirect)) {
            return;
        }

        // Send notification if permissions have already been granted
        if (_pump.notifyPermission === "granted") {
            var object = activity.object,
                title = $(activity.content).text(),
                body;

            if (object.content) {
                // No all content is HTML, so ensure parse correctly
                body = $("<p>" + object.content + "</p>").text();
            } else if (object.displayName && object.objectType !==  "person") {
                body = object.displayName;
            }

            _pump.notifyLast = new window.Notification(title, {
                icon: "/images/icon-small.png",
                body: body,
                image: _.get(object, "image.url")
            });
            // Additional control parameters
            _pump.notifyLast.id = activity.id;
            _pump.notifyLast.sended = new Date();

        } else if (_pump.notifyPermission === "default") {
            // Try to enable again
            Pump.enableNotify();
        }
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
        // We don't accept HTML in title or site name; just text
        $("title").text(title + " - " + Pump.config.site);
    };

    Pump.ajaxError = function(jqXHR, textStatus, errorThrown) {
        Pump.error(Pump.jqxhrError(jqXHR));
    };

    Pump.jqxhrError = function(jqxhr) {
        var type = jqxhr.getResponseHeader("Content-Type"),
            response;
        if (type && type.indexOf("application/json") !== -1) {
            try {
                response = JSON.parse(jqxhr.responseText);
                Pump.error(new Error(response.error));
            } catch (err) {
                Pump.error(new Error(jqxhr.status + ": " + jqxhr.statusText));
            }
        } else {
            Pump.error(new Error(jqxhr.status + ": " + jqxhr.statusText));
        }
    };

})(window._, window.$, window.Backbone, window.Pump);
