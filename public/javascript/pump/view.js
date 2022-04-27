// pump/view.js
//
// Views for the pump.io client UI
//
// @licstart  The following is the entire license notice for the
//  JavaScript code in this page.
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
//
// @licend  The above is the entire license notice
// for the JavaScript code in this page.

// XXX: this needs to be broken up into 3-4 smaller modules

(function(_, $, Backbone, Pump) {

    "use strict";

    Pump.templates = {};

    Pump.TemplateError = function(template, data, err) {
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, Pump.TemplateError);
        }
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
            var view = this;

            if (_.has(view, "model") && _.isObject(view.model)) {
                view.listenTo(view.model, "change", function(model, options) {
                    Pump.debug("Re-rendering " + view.templateName + " #" + view.cid + " based on change to " + view.model.id);
                    // When a change has happened, re-render
                    view.render();
                });
                view.listenTo(view.model, "destroy", function(options) {
                    Pump.debug("Re-rendering " + view.templateName + " based on destroyed " + view.model.id);
                    // When a change has happened, re-render
                    view.remove();
                });
                if (_.has(view.model, "items") && _.isObject(view.model.items)) {
                    view.listenTo(view.model.items, "add", function(model, collection, options) {
                        Pump.debug("Re-rendering " + view.templateName + " based on addition to " + view.model.id);
                        view.showAdded(model);
                    });
                    view.listenTo(view.model.items, "remove", function(model, collection, options) {
                        Pump.debug("Re-rendering " + view.templateName + " based on removal from " + view.model.id);
                        view.showRemoved(model);
                    });
                    view.listenTo(view.model.items, "reset", function(collection, options) {
                        Pump.debug("Re-rendering " + view.templateName + " based on reset of " + view.model.id);
                        // When a change has happened, re-render
                        view.render();
                    });
                    view.listenTo(view.model.items, "sort", function(collection, options) {
                        Pump.debug("Re-rendering " + view.templateName + " based on resort of " + view.model.id);
                        // When a change has happened, re-render
                        view.render();
                    });
                }
            }
        },
        setElement: function(element, delegate) {
            Backbone.View.prototype.setElement.apply(this, arguments);
            if (element) {
                this.ready();
                this.trigger("ready");
            }
        },
        templateName: null,
        subs: {},
        ready: function() {
            // setup subViews
            this.setupSubs();
        },
        setupSubs: function() {

            var view = this,
                data = view.options.data,
                subs = view.subs;

            if (!subs) {
                return;
            }

            _.each(subs, function(def, selector) {

                var $el = view.$(selector),
                    options,
                    sub,
                    id;

                if (def.attr && view[def.attr]) {
                    view[def.attr].setElement($el);
                    return;
                }

                if (def.idAttr && view.model && view.model.items) {

                    if (def.map) {
                        if (!view[def.map]) {
                            view[def.map] = {};
                        }
                    }

                    $el.each(function(i, el) {

                        var id = $(el).attr(def.idAttr),
                            options = {el: el};

                        if (!id) {
                            return;
                        }

                        options.model = view.model.items.get(id);

                        if (!options.model) {
                            return;
                        }

                        if (def.subOptions) {
                            if (def.subOptions.data) {
                                options.data = {};
                                _.each(def.subOptions.data, function(item) {
                                    if (item == view.modelName) {
                                        options.data[item] = view.model.items || view.model;
                                    } else {
                                        options.data[item] = data[item];
                                    }
                                });
                            }
                        }

                        sub = new Pump[def.subView](options);

                        if (def.map) {
                            view[def.map][id] = sub;
                        }
                    });

                    return;
                }

                options = {el: $el};

                if (def.subOptions) {
                    if (def.subOptions.model) {
                        options.model = data[def.subOptions.model];
                    }
                    if (def.subOptions.data) {
                        options.data = {};
                        _.each(def.subOptions.data, function(item) {
                            options.data[item] = data[item];
                        });
                    }
                }

                sub = new Pump[def.subView](options);

                if (def.attr) {
                    view[def.attr] = sub;
                }
            });
        },
        render: function() {
            var view = this,
                getTemplate = function(name, cb) {
                    if (_.has(Pump.templates, name)) {
                        cb(null, Pump.templates[name]);
                    } else {
                        var url = "/template/"+ name;
                        var clientUrls = ["account",
                                          "authentication",
                                          "authorization",
                                          "authorization-finished",
                                          "confirmed",
                                          "doc",
                                          "error",
                                          "favorites",
                                          "followers",
                                          "following",
                                          "inbox",
                                          "javascript-disabled",
                                          "list",
                                          "lists",
                                          "login",
                                          "main",
                                          "major-activity-page",
                                          "minor-activity-page",
                                          "object",
                                          "recover",
                                          "recover-code",
                                          "recover-sent",
                                          "register",
                                          "remote",
                                          "user",
                                          "xss-error"];
                        if (clientUrls.indexOf(name) !== -1) {
                            url += "-client";
                        }
                        url += ".pug.js";

                        $.get(url, function(data) {
                            var f;
                            try {
                                /* jslint evil: true */
                                eval(data);
                                f = template;
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
                        res = $.ajax({url: "/template/"+name+"-client.pug.js",
                                      async: false});
                        if (res.readyState === 4 &&
                            ((res.status >= 200 && res.status < 300) || res.status === 304)) {
                            data = res.responseText;
                            /* jslint evil: true */
                            eval(data);
                            f = template;
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
                        if (err instanceof Pump.TemplateError) {
                            cb(err, null);
                        } else {
                            cb(new Pump.TemplateError(template, data, err), null);
                        }
                        return;
                    }
                    cb(null, html);
                },
                setOutput = function(err, html) {
                    if (err) {
                        Pump.error(err);
                    } else {
                        // Triggers "ready"
                        view.setHTML(html);
                        // Update relative to the new code view
                        view.$("abbr.easydate").easydate();
                    }
                },
                main = {
                    config: Pump.config,
                    template: {},
                    page: {url: window.location.pathname + window.location.search,
                           title: window.document.title}
                },
                pc,
                modelName = view.modelName || view.options.modelName || "model",
                partials = {},
                cnt;

            if (view.model) {
                main[modelName] = (!view.model) ? {} : ((view.model.toJSON) ? view.model.toJSON() : view.model);
            }

            if (_.has(view.options, "data")) {
                _.each(view.options.data, function(obj, name) {
                    if (_.isObject(obj) && obj.toJSON) {
                        main[name] = obj.toJSON();
                    } else {
                        main[name] = obj;
                    }
                });
            }

            main.principalUser = (Pump.principalUser) ? Pump.principalUser.toJSON() : null;
            main.principal = (Pump.principal) ? Pump.principal.toJSON() : null;

            // XXX: set main.page.title

            getTemplate(view.templateName, function(err, template) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                runTemplate(template, main, setOutput);
            });
            return this;
        },
        stopSpin: function() {
            this.$(":submit").prop("disabled", false).spin(false);
        },
        startSpin: function() {
            this.$(":submit").prop("disabled", true).spin(true);
        },
        showAlert: function(msg, type) {
            var view = this;

            if (view.$(".alert").length > 0) {
                view.$(".alert").remove();
            }

            type = type || "error";

            view.$("legend").after('<div class="alert alert-'+type+'">' +
                                   '<a class="close" data-dismiss="alert" href="#">&times;</a>' +
                                   '<p class="alert-message">'+ msg + "</p>" +
                                   "</div>");

            view.$(".alert").alert();
        },
        showError: function(err) {
            var view = this,
                msg = Pump.getError(err);

            if (view.$(".alert").length > 0 && msg) {
                view.showAlert(msg, "error");
            } else {
                Pump.error(msg);
            }
        },
        showSuccess: function(msg) {
            this.showAlert(msg, "success");
        },
        setHTML: function(html) {
            var view = this,
                $old = view.$el,
                $new = $(html).first();

            $old.replaceWith($new);
            view.setElement($new);
            $old = null;
        },
        showAdded: function(model) {

            var view = this,
                id = model.get("id"),
                subs = view.subs,
                data = view.options.data,
                options,
                aview,
                def,
                selector;

            // Strange!

            if (!subs) {
                return;
            }

            if (!view.model || !view.model.items) {
                return;
            }

            // Find the first def and selector with a map

            _.each(subs, function(subDef, subSelector) {
                if (subDef.map) {
                    def = subDef;
                    selector = subSelector;
                }
            });

            if (!def) {
                return;
            }

            if (!view[def.map]) {
                view[def.map] = {};
            }

            // If we already have it, skip

            if (_.has(view[def.map], id)) {
                return;
            }

            options = {model: model};

            if (def.subOptions) {
                if (def.subOptions.data) {
                    options.data = {};
                    _.each(def.subOptions.data, function(item) {
                        options.data[item] = data[item];
                    });
                }
            }

            // Show the new item

            aview = new Pump[def.subView](options);

            // Stash the view

            view[def.map][model.id] = aview;

            // When it's rendered, stick it where it goes

            aview.on("ready", function() {

                var idx, $el = view.$(selector);

                aview.$el.hide();

                view.placeSub(aview, $el);

                aview.$el.fadeIn("slow");
            });

            aview.render();
        },
        placeSub: function(aview, $el) {
            var view = this,
                model = aview.model,
                idx = view.model.items.indexOf(model);

            if (idx <= 0) {
                view.$el.prepend(aview.$el);
            } else if (idx >= $el.length) {
                view.$el.append(aview.$el);
            } else {
                aview.$el.insertBefore($el[idx]);
            }
        },
        showRemoved: function(model) {
            var view = this,
                id = model.get("id"),
                aview,
                def,
                selector,
                subs = view.subs;

            // Possible but not likely

            if (!subs) {
                return;
            }

            if (!view.model || !view.model.items) {
                return;
            }

            // Find the first def and selector with a map

            _.each(subs, function(subDef, subSelector) {
                if (subDef.map) {
                    def = subDef;
                    selector = subSelector;
                }
            });

            if (!def) {
                return;
            }

            if (!view[def.map]) {
                view[def.map] = {};
            }

            if (!_.has(view[def.map], id)) {
                return;
            }

            // Remove it from the DOM

            view[def.map][id].remove();

            // delete that view from our map

            delete view[def.map][id];
        }
    });

    Pump.NavView = Pump.TemplateView.extend({
        getStreams: function() {
            return {};
        }
    });

    Pump.AnonymousNav = Pump.NavView.extend({
        tagName: "div",
        className: "container",
        templateName: "nav-anonymous"
    });

    Pump.UserNav = Pump.NavView.extend({
        tagName: "div",
        className: "container",
        modelName: "user",
        templateName: "nav-loggedin",
        subs: {
            "#messages": {
                attr: "majorStreamView",
                subView: "MessagesView",
                subOptions: {
                    model: "messages"
                }
            },
            "#notifications": {
                attr: "minorStreamView",
                subView: "NotificationsView",
                subOptions: {
                    model: "notifications"
                }
            }
        },
        events: {
            "click #logout": "logout",
            "click #post-note-button": "postNoteModal",
            "click #post-picture-button": "postPictureModal",
            "click #fat-menu .dropdown-menu li": "closeDropdown"
        },
        postNoteModal: function() {
            var view = this;
            view.showPostingModal("#post-note-button", Pump.PostNoteModal);
        },
        postPictureModal: function() {
            var view = this;
            view.showPostingModal("#post-picture-button", Pump.PostPictureModal);
        },
        showPostingModal: function(btn, Cls) {
            var view = this,
                profile = Pump.principal,
                lists = profile.lists,
                startSpin = function() {
                    view.$(btn).prop("disabled", true).spin(true);
                },
                stopSpin = function() {
                    view.$(btn).prop("disabled", false).spin(false);
                };

            startSpin();

            Pump.fetchObjects([lists], function(err, objs) {
                if (err) {
                    view.showError(err);
                    stopSpin();
                } else {
                    Pump.showModal(Cls, {data: {user: Pump.principalUser,
                                                lists: lists},
                                         ready: function() {
                                             stopSpin();
                                         }});
                }
            });

            return false;
        },
        logout: function() {
            var view = this,
                options,
                onSuccess = function(data, textStatus, jqXHR) {
                    var an;
                    Pump.principalUser = null;
                    Pump.principal = null;

                    Pump.clearNickname();
                    Pump.clearUserCred();

                    Pump.clearCaches();

                    an = new Pump.AnonymousNav({el: ".navbar-inner .container"});
                    an.render();

                    if (Pump.config.sockjs) {
                        // Request a new challenge
                        Pump.setupSocket();
                    }

                    if (window.location.pathname == "/") {
                        // If already home, reload to show main page
                        Pump.router.home();
                    } else {
                        // Go home
                        Pump.router.navigate("/", true);
                    }
                };

            options = {
                contentType: "application/json",
                data: "",
                dataType: "json",
                type: "POST",
                url: "/main/logout",
                success: onSuccess,
                error: Pump.error
            };

            Pump.ajax(options);
        },
        getStreams: function() {
            var view = this,
                streams = {};
            if (view.majorStreamView && view.majorStreamView.model) {
                streams.messages = view.majorStreamView.model;
            }
            if (view.minorStreamView && view.minorStreamView.model) {
                streams.notifications = view.minorStreamView.model;
            }
            return streams;
        },
        closeDropdown: function(e) {
            e.preventDefault();
            $("#profile-dropdown").dropdown("toggle");
        }
    });

    Pump.RemoteNav = Pump.NavView.extend({
        tagName: "div",
        className: "container",
        templateName: "nav-remote",
        events: {
            "click #logout": "logout"
        },
        logout: function() {
            var view = this,
                options,
                onSuccess = function(data, textStatus, jqXHR) {
                    var an;
                    Pump.principal = null;

                    Pump.clearCaches();

                    an = new Pump.AnonymousNav({el: ".navbar-inner .container"});
                    an.render();

                    if (Pump.config.sockjs) {
                        // Request a new challenge
                        Pump.setupSocket();
                    }

                    if (window.location.pathname == "/") {
                        // If already home, reload to show main page
                        Pump.router.home();
                    } else {
                        // Go home
                        Pump.router.navigate("/", true);
                    }
                };

            options = {
                contentType: "application/json",
                data: "",
                dataType: "json",
                type: "POST",
                url: "/main/logout",
                success: onSuccess,
                error: Pump.error
            };

            // Don't use Pump.ajax; it uses client auth
            $.ajax(options);
        }
    });

    Pump.MessagesView = Pump.TemplateView.extend({
        templateName: "messages",
        modelName: "messages"
    });

    Pump.NotificationsView = Pump.TemplateView.extend({
        templateName: "notifications",
        modelName: "notifications"
    });

    Pump.ContentView = Pump.TemplateView.extend({
        addMajorActivity: function(act) {
            // By default, do nothing
        },
        addMinorActivity: function(act) {
            // By default, do nothing
        },
        getStreams: function() {
            return {};
        }
    });

    Pump.MainContent = Pump.ContentView.extend({
        templateName: "main"
    });

    Pump.LoginContent = Pump.ContentView.extend({
        templateName: "login",
        events: {
            "submit #login": "doLogin",
            "input #password": "onKey",
            "input #nickname": "onKey"
        },
        ready: function() {
            var view = this;
            // setup subViews
            view.setupSubs();
            // Initialize state of login button
            view.onKey();
        },
        "onKey": function(event) {
            var view = this,
                nickname = view.$("#nickname").val(),
                password = view.$("#password").val();

            if (!nickname || !password || nickname.length === 0 || password.length < 8) {
                view.$(":submit").attr("disabled", "disabled");
            } else {
                view.$(":submit").removeAttr("disabled");
            }
        },
        "doLogin": function() {
            var view = this,
                params = {nickname: view.$('#login input[name="nickname"]').val(),
                          password: view.$('#login input[name="password"]').val()},
                options,
                continueTo = Pump.getContinueTo(),
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                retries = 0,
                onSuccess = function(data, textStatus, jqXHR) {
                    var objs;
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.clearCaches();
                    Pump.principalUser = Pump.User.unique(data);
                    Pump.principal = Pump.principalUser.profile;
                    objs = [Pump.principalUser,
                            Pump.principalUser.majorDirectInbox,
                            Pump.principalUser.minorDirectInbox];
                    Pump.fetchObjects(objs, function(err, objs) {
                        Pump.body.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                          model: Pump.principalUser,
                                                          data: {
                                                              messages: Pump.principalUser.majorDirectInbox,
                                                              notifications: Pump.principalUser.minorDirectInbox
                                                          }});
                        Pump.body.nav.render();
                    });
                    if (Pump.config.sockjs) {
                        // Request a new challenge
                        Pump.setupSocket();
                    }
                    // XXX: reload current data
                    view.stopSpin();
                    Pump.router.navigate(continueTo, true);
                    Pump.clearContinueTo();
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    // This happens when our stored OAuth credentials are
                    // invalid; usually because someone re-installed server software
                    if (jqXHR.status == 401 && retries === 0 && jqXHR.responseText == "Invalid / used nonce") {
                        Pump.clearCred();
                        retries = 1;
                        Pump.ajax(options);
                    } else {
                        view.stopSpin();
                        Pump.error(jqXHR, textStatus);
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

            Pump.ajax(options);

            return false;
        }
    });

    Pump.RegisterContent = Pump.ContentView.extend({
        templateName: "register",
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
                retries = 0,
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                makeRequest = function(options) {
                    Pump.ensureCred(function(err, cred) {
                        if (err) {
                            view.stopSpin();
                            view.showError("Couldn't get OAuth credentials. :(");
                        } else {
                            options.consumerKey = cred.clientID;
                            options.consumerSecret = cred.clientSecret;
                            options = Pump.oauthify(options);
                            $.ajax(options);
                        }
                    });
                },
                onSuccess = function(data, textStatus, jqXHR) {
                    var objs;
                    if (Pump.config.requireEmail) {
                        Pump.body.setContent({contentView: Pump.ConfirmEmailInstructionsContent,
                                              title: "Confirm email"});
                        return;
                    }
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.clearCaches();
                    Pump.principalUser = Pump.User.unique(data);
                    Pump.principal = Pump.principalUser.profile;
                    if (Pump.config.sockjs) {
                        // Request a new challenge
                        Pump.setupSocket();
                    }
                    objs = [Pump.principalUser,
                            Pump.principalUser.majorDirectInbox,
                            Pump.principalUser.minorDirectInbox];
                    Pump.fetchObjects(objs, function(err, objs) {
                        Pump.body.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                          model: Pump.principalUser,
                                                          data: {
                                                              messages: Pump.principalUser.majorDirectInbox,
                                                              notifications: Pump.principalUser.minorDirectInbox
                                                          }});
                        Pump.body.nav.render();
                    });
                    Pump.body.nav.render();
                    // Leave disabled
                    view.stopSpin();
                    // XXX: one-time on-boarding page
                    Pump.router.navigate(Pump.getContinueTo(), true);
                    Pump.clearContinueTo();
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    // If we get this error, it (usually!) means our client credentials are bad.
                    // Get new credentials and retry (once!).
                    if (jqXHR.status == 401 && retries === 0) {
                        Pump.clearCred();
                        makeRequest(options);
                        retries = 1;
                    } else {
                        view.stopSpin();
                        Pump.error(jqXHR, textStatus);
                    }
                };

            if (_.includes(Pump.config.nicknameBlacklist, params.nickname)) {

                view.showError("That nickname is not allowed");

            } else if (params.password !== repeat) {

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

                makeRequest(options);
            }

            return false;
        }
    });

    Pump.RemoteContent = Pump.ContentView.extend({
        templateName: "remote",
        ready: function() {
            var view = this;
            // setup subViews
            view.setupSubs();
            // Initialize continueTo
            view.addContinueTo();
        },
        addContinueTo: function() {
            var view = this,
                continueTo = Pump.getContinueTo();

            if (continueTo && continueTo.length > 0) {
                view.$("form#remote").append($("<input type='hidden' name='continueTo' value='"+Pump.htmlEncode(continueTo)+"'>"));
            }
        }
    });

    Pump.RecoverContent = Pump.ContentView.extend({
        templateName: "recover",
        events: {
            "submit #recover": "doRecover",
            "keyup #nickname": "onKey"
        },
        ready: function() {
            var view = this;
            // setup subViews
            view.setupSubs();
            // Initialize state of recover button
            view.onKey();
        },
        "onKey": function(event) {
            var view = this,
                nickname = view.$("#nickname").val();

            if (!nickname || nickname.length === 0) {
                view.$(":submit").attr("disabled", "disabled");
            } else {
                view.$(":submit").removeAttr("disabled");
            }
        },
        "doRecover": function() {
            var view = this,
                params = {nickname: view.$('#recover input[name="nickname"]').val()},
                options,
                continueTo = Pump.getContinueTo(),
                NICKNAME_RE = /^[a-zA-Z0-9\-_.]{1,64}$/,
                retries = 0,
                onSuccess = function(data, textStatus, jqXHR) {
                    Pump.router.navigate("/main/recover-sent", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    // This happens when our stored OAuth credentials are
                    // invalid; usually because someone re-installed server software
                    if (jqXHR.status == 401 && retries === 0 && jqXHR.responseText == "Invalid / used nonce") {
                        Pump.clearCred();
                        retries = 1;
                        Pump.ajax(options);
                    } else {
                        view.stopSpin();
                        Pump.error(jqXHR, textStatus);
                    }
                };

            view.startSpin();

            options = {
                contentType: "application/json",
                data: JSON.stringify(params),
                dataType: "json",
                type: "POST",
                url: "/main/recover",
                success: onSuccess,
                error: onError
            };

            Pump.ajax(options);

            return false;
        }
    });

    Pump.RecoverSentContent = Pump.ContentView.extend({
        templateName: "recover-sent"
    });

    Pump.RecoverCodeContent = Pump.ContentView.extend({
        templateName: "recover-code",
        ready: function() {
            var view = this;
            // setup subViews
            view.setupSubs();
            // Initialize state of recover button
            view.redeemCode();
        },
        "redeemCode": function() {
            var view = this,
                params = {code: view.$el.data("code")},
                options,
                retries = 0,
                onSuccess = function(data, textStatus, jqXHR) {
                    var objs;
                    Pump.setNickname(data.nickname);
                    Pump.setUserCred(data.token, data.secret);
                    Pump.clearCaches();
                    Pump.principalUser = Pump.User.unique(data);
                    Pump.principal = Pump.principalUser.profile;
                    objs = [Pump.principalUser,
                            Pump.principalUser.majorDirectInbox,
                            Pump.principalUser.minorDirectInbox];
                    Pump.fetchObjects(objs, function(err, objs) {
                        Pump.body.nav = new Pump.UserNav({el: ".navbar-inner .container",
                                                          model: Pump.principalUser,
                                                          data: {
                                                              messages: Pump.principalUser.majorDirectInbox,
                                                              notifications: Pump.principalUser.minorDirectInbox
                                                          }});
                        Pump.body.nav.render();
                    });
                    if (Pump.config.sockjs) {
                        // Request a new challenge
                        Pump.setupSocket();
                    }
                    // XXX: reload current data
                    view.stopSpin();
                    Pump.router.navigate("/main/account", true);
                },
                onError = function(jqXHR, textStatus, errorThrown) {
                    var type, response;
                    // This happens when our stored OAuth credentials are
                    // invalid; usually because someone re-installed server software
                    if (jqXHR.status == 401 && retries === 0 && jqXHR.responseText == "Invalid / used nonce") {
                        Pump.clearCred();
                        retries = 1;
                        Pump.ajax(options);
                    } else {
                        view.stopSpin();
                        Pump.error(jqXHR, textStatus);
                    }
                };

            view.startSpin();

            options = {
                contentType: "application/json",
                data: JSON.stringify(params),
                dataType: "json",
                type: "POST",
                url: "/main/redeem-code",
                success: onSuccess,
                error: onError
            };

            Pump.ajax(options);

            return false;
        }
    });

    Pump.ConfirmEmailInstructionsContent = Pump.ContentView.extend({
        templateName: "confirm-email-instructions"
    });

    Pump.UserPageContent = Pump.ContentView.extend({
        templateName: "user",
        addMajorActivity: function(act) {
            var view = this,
                profile = this.options.data.profile;

            if (!profile || act.actor.id != profile.get("id")) {
                return;
            }

            view.userContent.majorStreamView.showAdded(act);
        },
        addMinorActivity: function(act) {
            var view = this,
                profile = this.options.data.profile;

            if (!profile || act.actor.id != profile.get("id")) {
                return;
            }

            view.userContent.minorStreamView.showAdded(act);
        },
        getStreams: function() {
            var view = this,
                uc,
                streams = {};
            if (view.userContent) {
                uc = view.userContent;
                if (uc.majorStreamView && uc.majorStreamView.model) {
                    streams.major = uc.majorStreamView.model;
                }
                if (uc.minorStreamView && uc.minorStreamView.model) {
                    streams.minor = uc.minorStreamView.model;
                }
            }
            return streams;
        },
        subs: {
            "#profile-block": {

                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-activities": {
                attr: "userContent",
                subView: "ActivitiesUserContent",
                subOptions: {
                    data: ["major", "minor", "headless"]
                }
            }
        }
    });

    Pump.ActivitiesUserContent = Pump.TemplateView.extend({
        templateName: "user-content-activities",
        subs: {
            "#major-stream": {
                attr: "majorStreamView",
                subView: "MajorStreamView",
                subOptions: {
                    model: "major",
                    data: ["headless"]
                }
            },
            "#minor-stream": {
                attr: "minorStreamView",
                subView: "MinorStreamView",
                subOptions: {
                    model: "minor",
                    data: ["headless"]
                }
            }
        }
    });

    Pump.MajorStreamView = Pump.TemplateView.extend({
        templateName: "major-stream",
        modelName: "activities",
        subs: {
            ".activity.major": {
                map: "activities",
                subView: "MajorActivityView",
                idAttr: "data-activity-id",
                subOptions: {
                    data: ["headless"]
                }
            }
        }
    });

    Pump.MinorStreamView = Pump.TemplateView.extend({
        templateName: "minor-stream",
        modelName: "activities",
        subs: {
            ".activity.minor": {
                map: "activities",
                subView: "MinorActivityView",
                idAttr: "data-activity-id",
                subOptions: {
                    data: ["headless"]
                }
            }
        }
    });

    Pump.InboxContent = Pump.ContentView.extend({
        templateName: "inbox",
        addMajorActivity: function(act) {
            var view = this;
            view.majorStreamView.showAdded(act);
        },
        addMinorActivity: function(act) {
            var view = this,
                aview;
            view.minorStreamView.showAdded(act);
        },
        getStreams: function() {
            var view = this,
                streams = {};
            if (view.majorStreamView && view.majorStreamView.model) {
                streams.major = view.majorStreamView.model;
            }
            if (view.minorStreamView && view.minorStreamView.model) {
                streams.minor = view.minorStreamView.model;
            }
            return streams;
        },
        subs: {
            "#major-stream": {
                attr: "majorStreamView",
                subView: "MajorStreamView",
                subOptions: {
                    model: "major",
                    data: ["headless"]
                }
            },
            "#minor-stream": {
                attr: "minorStreamView",
                subView: "MinorStreamView",
                subOptions: {
                    model: "minor",
                    data: ["headless"]
                }
            }
        }
    });

    // Note: Not the same as the messages indicator on the navbar
    // This is the full-page view

    Pump.MessagesContent = Pump.ContentView.extend({
        templateName: "messages-content",
        addMajorActivity: function(act) {
            var view = this;
            view.majorStreamView.showAdded(act);
        },
        addMinorActivity: function(act) {
            var view = this,
                aview;
            view.minorStreamView.showAdded(act);
        },
        subs: {
            "#major-stream": {
                attr: "majorStreamView",
                subView: "MajorStreamView",
                subOptions: {
                    model: "major",
                    data: ["headless"]
                }
            },
            "#minor-stream": {
                attr: "minorStreamView",
                subView: "MinorStreamView",
                subOptions: {
                    model: "minor",
                    data: ["headless"]
                }
            }
        }
    });

    Pump.MajorActivityView = Pump.TemplateView.extend({
        templateName: "major-activity",
        modelName: "activity",
        events: {
            "mouseenter": "maybeShowExtraMenu",
            "mouseleave": "maybeHideExtraMenu",
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject",
            "click .share": "shareObject",
            "click .unshare": "unshareObject",
            "click .comment": "openComment",
            "click .object-image": "openImage"
        },
        setupSubs: function() {
            var view = this,
                model = view.model,
                $el = view.$(".replies");

            if (view.replyStream) {
                view.replyStream.setElement($el);
                return;
            }

            view.replyStream = new Pump.ReplyStreamView({el: $el, model: model.object.replies});
        },
        maybeShowExtraMenu: function() {
            var view = this,
                activity = view.model,
                principal = Pump.principal;

            if (principal && activity.actor && principal.id == activity.actor.id) {
                if (!view.extraMenu) {
                    view.extraMenu = new Pump.ExtraMenu({model: activity.object, parent: view});
                    view.extraMenu.show();
                }
            }
        },
        maybeHideExtraMenu: function() {
            var view = this,
                activity = view.model,
                principal = Pump.principal;

            if (principal && activity.actor && principal.id == activity.actor.id) {
                if (view.extraMenu) {
                    view.extraMenu.hide();
                    view.extraMenu = null;
                }
            }
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.object.toJSON()
                });

            Pump.newMinorActivity(act, function(err, act) {
                view.$(".favorite")
                    .filter(":first")
                    .removeClass("favorite")
                    .addClass("unfavorite")
                    .html("Unlike <i class=\"fa fa-thumbs-o-down\"></i>");
                Pump.addMinorActivity(act);
            });
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.object.toJSON()
                });

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unfavorite")
                        .filter(":first")
                        .removeClass("unfavorite")
                        .addClass("favorite")
                        .html("Like <i class=\"fa fa-thumbs-o-up\"></i>");
                    Pump.addMinorActivity(act);
                }
            });
        },
        shareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "share",
                    object: view.model.object.toJSON()
                });

            view.startSpin();

            Pump.newMajorActivity(act, function(err, act) {
                if (err) {
                    view.stopSpin();
                    view.showError(err);
                } else {
                    view.$(".share")
                        .removeClass("share")
                        .addClass("unshare")
                        .html("Unshare <i class=\"fa fa-times\"></i>");
                    Pump.addMajorActivity(act);
                }
            });
        },
        unshareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unshare",
                    object: view.model.object.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.stopSpin();
                    view.showError(err);
                } else {
                    view.$(".unshare")
                        .removeClass("unshare")
                        .addClass("share")
                        .html("Share <i class=\"fa fa-share\"></i>");
                    Pump.addMinorActivity(act);
                }
            });
        },
        openComment: function() {
            var view = this,
                form;

            if (view.$("form.post-comment").length > 0) {
                view.$("form.post-comment textarea").focus();
            } else {
                form = new Pump.CommentForm({original: view.model.object});
                form.on("ready", function() {
                    view.$(".replies").append(form.$el);
                });
                form.render();
            }
        },
        openImage: function() {
            var view = this,
                model = view.model,
                object = view.model.object,
                modalView;

            if (object && object.get("fullImage")) {
                var spinContainer = view.$el.find(".object-image").parent();

                modalView = new Pump.LightboxModal({data: {object: object}});
                spinContainer.spin({className: "spinner-image", zIndex: 10});

                // When it's ready, show immediately

                modalView.on("ready", function() {
                    $(view.el).append(modalView.el);
                    $(modalView.el).on("hidden", function() {
                        $(modalView.el).remove();
                    });
                    $(modalView.el).on("shown", function() {
                        spinContainer.spin(false);
                    });
                    $("#fullImageLightbox").lightbox();
                });

                // render it (will fire "ready")

                modalView.render();
            }
        }
    });

    Pump.ReplyStreamView = Pump.TemplateView.extend({
        templateName: "replies",
        modelName: "replies",
        subs: {
            ".reply": {
                map: "activities",
                subView: "ReplyView",
                idAttr: "data-activity-id"
            }
        },
        events: {
            "click .show-all-replies": "showAllReplies"
        },
        showAllReplies: function() {
            var view = this,
                replies = view.model,
                full = new Pump.FullReplyStreamView({model: replies});

            Pump.body.startLoad();

            full.on("ready", function() {
                full.$el.hide();
                view.$el.replaceWith(full.$el);
                full.$el.fadeIn("slow");
                Pump.body.endLoad();
            });

            replies.getAll(function(err, data) {
                if (err) {
                    Pump.error(err);
                } else {
                    full.render();
                }
            });
        },
        placeSub: function(aview, $el) {
            var view = this,
                model = aview.model,
                idx = view.model.items.indexOf(model);

            // Invert direction
            if (idx <= 0) {
                view.$(".reply-objects").append(aview.$el);
            } else if (idx >= $el.length) {
                view.$(".reply-objects").prepend(aview.$el);
            } else {
                aview.$el.insertBefore($el[view.model.length - 1 - idx]);
            }
        }
    });

    Pump.FullReplyStreamView = Pump.TemplateView.extend({
        templateName: "full-replies",
        modelName: "replies",
        subs: {
            ".reply": {
                map: "activities",
                subView: "ReplyView",
                idAttr: "data-activity-id"
            }
        },
        placeSub: function(aview, $el) {
            var view = this,
                model = aview.model,
                idx = view.model.items.indexOf(model);

            // Invert direction
            if (idx <= 0) {
                view.$(".reply-objects").append(aview.$el);
            } else if (idx >= $el.length) {
                view.$(".reply-objects").prepend(aview.$el);
            } else {
                aview.$el.insertBefore($el[view.model.length - 1 - idx]);
            }
        }
    });

    Pump.CommentForm = Pump.TemplateView.extend({
        templateName: "comment-form",
        tagName: "div",
        className: "row comment-form",
        events: {
            "submit .post-comment": "saveComment",
            "click .close-btn": "cancelComment"
        },
        ready: function() {
            var view = this,
                orig = view.options.original;

            if (orig.inReplyTo) {
                $(view.el).prepend('<div class="alert">Your comment will appear on the original post.</div>');
            }

            view.$('textarea[name="content"]').wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });

        },
        cancelComment: function() {
            var view = this,
                html = view.$('textarea[name="content"]').val();

            if (html.length === 0) {
                view.remove();
                return;
            }
            Pump.areYouSure("You sure? You can't get this comment back!", function(err, sure) {
                if (sure) {
                    view.remove();
                }
            });
        },
        saveComment: function() {
            var view = this,
                html = view.$('textarea[name="content"]').val(),
                orig = view.options.original,
                act = new Pump.Activity({
                    verb: "post",
                    object: {
                        objectType: "comment",
                        content: html
                    }
                });

            act.object.inReplyTo = orig.inReplyTo || orig;

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.stopSpin();
                    view.showError(err);
                } else {
                    var object = act.object,
                        repl;
                    // These get stripped for "posts"; re-add it

                    object.author = Pump.principal;

                    repl = new Pump.ReplyView({model: object});

                    repl.on("ready", function() {

                        view.stopSpin();

                        view.$el.replaceWith(repl.$el);
                    });

                    repl.render();

                    Pump.addMinorActivity(act);
                }
            });

            return false;
        }
    });

    Pump.MajorObjectView = Pump.TemplateView.extend({
        templateName: "major-object",
        events: {
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject",
            "click .share": "shareObject",
            "click .unshare": "unshareObject",
            "click .comment": "openComment"
        },
        setupSubs: function() {
            var view = this,
                model = view.model,
                $el = view.$(".replies");

            if (view.replyStream) {
                view.replyStream.setElement($el);
                return;
            }

            view.replyStream = new Pump.ReplyStreamView({el: $el, model: model.replies});
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".favorite")
                        .filter(":first")
                        .removeClass("favorite")
                        .addClass("unfavorite")
                        .html("Unlike <i class=\"fa fa-thumbs-o-down\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unfavorite")
                        .filter(":first")
                        .removeClass("unfavorite")
                        .addClass("favorite")
                        .html("Like <i class=\"fa fa-thumbs-o-up\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        shareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "share",
                    object: view.model.toJSON()
                });

            view.startSpin();
            Pump.newMajorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".share")
                        .removeClass("share")
                        .addClass("unshare")
                        .html("Unshare <i class=\"fa fa-times\"></i>");
                    Pump.addMajorActivity(act);
                }
                view.stopSpin();
            });
        },
        unshareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unshare",
                    object: view.model.toJSON()
                });

            view.startSpin();
            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unshare")
                        .removeClass("unshare")
                        .addClass("share")
                        .html("Share <i class=\"fa fa-share\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        openComment: function() {
            var view = this,
                form;

            if (view.$("form.post-comment").length > 0) {
                view.$("form.post-comment textarea").focus();
            } else {
                form = new Pump.CommentForm({original: view.model});
                form.on("ready", function() {
                    view.$(".replies").append(form.$el);
                });
                form.render();
            }
        }
    });

    Pump.ReplyView = Pump.TemplateView.extend({
        templateName: "reply",
        modelName: "reply",
        events: {
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject"
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.toJSON()
                });

            view.startSpin();
            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".favorite")
                        .filter(":first")
                        .removeClass("favorite")
                        .addClass("unfavorite")
                        .html("Unlike <i class=\"fa fa-thumbs-o-down\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });

            return false;
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.toJSON()
                });

            view.startSpin();
            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unfavorite")
                        .filter(":first")
                        .removeClass("unfavorite")
                        .addClass("favorite")
                        .html("Like <i class=\"fa fa-thumbs-o-up\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });

            return false;
        }
    });

    Pump.MinorActivityView = Pump.TemplateView.extend({
        templateName: "minor-activity",
        modelName: "activity"
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
                };

            view.startSpin();
            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".follow")
                        .removeClass("follow")
                        .removeClass("btn-primary")
                        .addClass("stop-following")
                        .html("Stop following");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        stopFollowingProfile: function() {
            var view = this,
                act = {
                    verb: "stop-following",
                    object: view.model.toJSON()
                };

            view.startSpin();
            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".stop-following")
                        .removeClass("stop-following")
                        .addClass("btn-primary")
                        .addClass("follow")
                        .html("Follow");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        }
    });

    Pump.MajorPersonView = Pump.PersonView.extend({
        templateName: "major-person",
        modelName: "person"
    });

    Pump.ProfileBlock = Pump.PersonView.extend({
        templateName: "profile-block",
        modelName: "profile",
        initialize: function(options) {
            Pump.debug("Initializing profile-block #" + this.cid);
            Pump.PersonView.prototype.initialize.apply(this);
        }
    });

    Pump.FavoritesContent = Pump.ContentView.extend({
        templateName: "favorites",
        subs: {
            "#profile-block": {
                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-favorites": {
                attr: "userContent",
                subView: "FavoritesUserContent",
                subOptions: {
                    model: "favorites",
                    data: ["profile"]
                }
            }
        }
    });

    Pump.FavoritesUserContent = Pump.TemplateView.extend({
        templateName: "user-content-favorites",
        modelName: "favorites",
        subs: {
            ".object.major": {
                map: "favorites",
                subView: "MajorObjectView",
                idAttr: "data-object-id"
            }
        }
    });

    Pump.FollowersContent = Pump.ContentView.extend({
        templateName: "followers",
        subs: {
            "#profile-block": {
                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-followers": {
                attr: "userContent",
                subView: "FollowersUserContent",
                subOptions: {
                    data: ["profile", "followers"]
                }
            }
        },
        getStreams: function() {
            var view = this,
                streams = {};
            if (view.userContent && view.userContent.peopleStreamView && view.userContent.peopleStreamView.model) {
                streams.major = view.userContent.peopleStreamView.model;
            }
            return streams;
        }
    });

    Pump.FollowersUserContent = Pump.TemplateView.extend({
        templateName: "user-content-followers",
        modelName: "followers",
        subs: {
            "#people-stream": {
                attr: "peopleStreamView",
                subView: "PeopleStreamView",
                subOptions: {
                    model: "followers"
                }
            }
        }
    });

    Pump.PeopleStreamView = Pump.TemplateView.extend({
        templateName: "people-stream",
        modelName: "people",
        subs: {
            ".person.major": {
                map: "people",
                subView: "MajorPersonView",
                idAttr: "data-person-id"
            }
        }
    });

    Pump.FollowingContent = Pump.ContentView.extend({
        templateName: "following",
        subs: {
            "#profile-block": {
                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-following": {
                attr: "userContent",
                subView: "FollowingUserContent",
                subOptions: {
                    data: ["profile", "following"]
                }
            }
        },
        getStreams: function() {
            var view = this,
                streams = {};
            if (view.userContent && view.userContent.peopleStreamView && view.userContent.peopleStreamView.model) {
                streams.major = view.userContent.peopleStreamView.model;
            }
            return streams;
        }
    });

    Pump.FollowingUserContent = Pump.TemplateView.extend({
        templateName: "user-content-following",
        modelName: "following",
        subs: {
            "#people-stream": {
                attr: "peopleStreamView",
                subView: "PeopleStreamView",
                subOptions: {
                    model: "following"
                }
            }
        }
    });

    Pump.ListsContent = Pump.ContentView.extend({
        templateName: "lists",
        subs: {
            "#profile-block": {
                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-lists": {
                attr: "userContent",
                subView: "ListsUserContent",
                subOptions: {
                    data: ["profile", "lists"]
                }
            }
        }
    });

    Pump.ListsUserContent = Pump.TemplateView.extend({
        templateName: "user-content-lists",
        subs: {
            "#list-menu-inner": {
                attr: "listMenu",
                subView: "ListMenu",
                subOptions: {
                    model: "lists",
                    data: ["profile", "list"]
                }
            }
        }
    });

    Pump.ListMenu = Pump.TemplateView.extend({
        templateName: "list-menu",
        modelName: "lists",
        el: ".list-menu-block",
        events: {
            "click .new-list": "newList"
        },
        newList: function() {
            Pump.showModal(Pump.NewListModal, {data: {user: Pump.principalUser}});
        },
        subs: {
            ".list": {
                map: "lists",
                subView: "ListMenuItem",
                idAttr: "data-list-id"
            }
        }
    });

    Pump.ListMenuItem = Pump.TemplateView.extend({
        templateName: "list-menu-item",
        modelName: "listItem",
        tagName: "ul",
        className: "list-menu-wrapper"
    });

    Pump.ListsListContent = Pump.TemplateView.extend({
        templateName: "list-content-lists"
    });

    Pump.ListContent = Pump.ContentView.extend({
        templateName: "list",
        subs: {
            "#profile-block": {
                attr: "profileBlock",
                subView: "ProfileBlock",
                subOptions: {
                    model: "profile"
                }
            },
            "#user-content-list": {
                attr: "userContent",
                subView: "ListUserContent",
                subOptions: {
                    data: ["profile", "lists", "list", "members"]
                }
            }
        },
        getStreams: function() {
            var view = this,
                streams = {};

            if (view.userContent &&
                view.userContent.listContent &&
                view.userContent.listContent.memberStreamView) {
                streams.major = view.userContent.listContent.memberStreamView.model;
            }

            return streams;
        }
    });

    Pump.ListUserContent = Pump.TemplateView.extend({
        templateName: "user-content-list",
        subs: {
            "#list-menu-inner": {
                attr: "listMenu",
                subView: "ListMenu",
                subOptions: {
                    model: "lists",
                    data: ["profile"]
                }
            },
            "#list-content-list": {
                attr: "listContent",
                subView: "ListListContent",
                subOptions: {
                    model: "list",
                    data: ["profile", "members", "lists", "list"]
                }
            }
        }
    });

    Pump.ListListContent = Pump.TemplateView.extend({
        templateName: "list-content-list",
        modelName: "list",
        subs: {
            "#member-stream": {
                attr: "memberStreamView",
                subView: "MemberStreamView",
                subOptions: {
                    model: "members",
                    data: ["profile", "lists", "list"]
                }
            }
        },
        events: {
            "click #add-list-member": "addListMember",
            "click #delete-list": "deleteList"
        },
        addListMember: function() {
            var view = this,
                profile = Pump.principal,
                list = view.model,
                members = view.options.data.members,
                following = profile.following;

            following.getAll(function() {
                Pump.fetchObjects([profile, list], function(err, objs) {
                    Pump.showModal(Pump.ChooseContactModal, {data: {list: list,
                                                                    members: members,
                                                                    people: following}});
                });
            });

            return false;
        },
        deleteList: function() {
            var view = this,
                list = view.model,
                lists = view.options.data.lists,
                user = Pump.principalUser,
                person = Pump.principal;

            Pump.areYouSure("Delete the list '"+list.get("displayName")+"'?", function(err, sure) {
                if (err) {
                    view.showError(err);
                } else if (sure) {
                    Pump.router.navigate("/"+user.get("nickname")+"/lists", true);
                    list.destroy({success: function() {
                        lists.remove(list.id);
                        // Reload the menu
                        Pump.body.content.userContent.listMenu.render();
                    }});
                }
            });
        }
    });

    Pump.MemberStreamView = Pump.TemplateView.extend({
        templateName: "member-stream",
        modelName: "people",
        subs: {
            ".person.major": {
                map: "people",
                subView: "MemberView",
                idAttr: "data-person-id",
                subOptions: {
                    data: ["list"]
                }
            }
        }
    });

    Pump.MemberView = Pump.TemplateView.extend({
        templateName: "member",
        modelName: "person",
        ready: function() {
            var view = this;
            // XXX: Bootstrap dependency
            view.$("#remove-person").tooltip();
        },
        "events": {
            "click #remove-person": "removePerson"
        },
        removePerson: function() {
            var view = this,
                person = view.model,
                list = view.options.data.list,
                members = view.options.data.people,
                user = Pump.principalUser,
                act = {
                    verb: "remove",
                    object: {
                        objectType: "person",
                        id: person.id
                    },
                    target: {
                        objectType: "collection",
                        id: list.id
                    }
                };

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    members.remove(person.id);
                    list.totalItems--;
                    list.trigger("change");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        }
    });

    Pump.SettingsContent = Pump.ContentView.extend({
        templateName: "settings",
        modelName: "profile",
        events: {
            "submit #settings": "saveSettings"
        },
        fileCount: 0,
        ready: function() {
            var view = this;
            view.setupSubs();

            if (view.$("#avatar-fineupload").length > 0) {
                view.$("#avatar-fineupload").fineUploader({
                    request: {
                        endpoint: "/main/upload-avatar"
                    },
                    text: {
                        uploadButton: '<i class="fa fa-upload"></i> Avatar file'
                    },
                    template: '<div class="qq-uploader">' +
                        '<pre class="qq-upload-drop-area"><span>{dragZoneText}</span></pre>' +
                        '<div class="qq-drop-processing"></div>' +
                        '<div class="qq-upload-button btn btn-success">{uploadButtonText}</div>' +
                        '<ul class="qq-upload-list"></ul>' +
                        "</div>",
                    classes: {
                        success: "alert alert-success",
                        fail: "alert alert-error"
                    },
                    autoUpload: false,
                    multiple: false,
                    validation: {
                        allowedExtensions: ["jpeg", "jpg", "png", "gif", "svg", "svgz"],
                        acceptFiles: "image/*"
                    }
                }).on("submit", function(id, fileName) {
                    view.fileCount++;
                    return true;
                }).on("cancel", function(id, fileName) {
                    view.fileCount--;
                    return true;
                }).on("complete", function(event, id, fileName, responseJSON) {
                    var act = new Pump.Activity({
                        verb: "post",
                        cc: [{id: "http://activityschema.org/collection/public",
                              objectType: "collection"}],
                        object: responseJSON.obj
                    });

                    Pump.newMajorActivity(act, function(err, act) {
                        if (err) {
                            view.showError(err);
                            view.stopSpin();
                        } else {
                            view.saveProfile(act.object);
                        }
                    });
                }).on("error", function(event, id, fileName, reason) {
                    view.showError(reason);
                    view.stopSpin();
                });
            }
        },
        saveProfile: function(img) {
            var view = this,
                profile = Pump.principal,
                props = {"displayName": view.$("#realname").val(),
                         "location": { objectType: "place",
                                       displayName: view.$("#location").val() },
                         "summary": view.$("#bio").val()};

            if (img) {
                props.image = img.get("image");
                props.pump_io = {
                    fullImage: img.get("fullImage")
                };
            }

            profile.save(props,
                         {
                             success: function(resp, status, xhr) {
                                 view.showSuccess("Saved settings.");
                                 view.stopSpin();
                             },
                             error: function(model, error, options) {
                                 view.showError(error);
                                 view.stopSpin();
                             }
                         });
        },
        saveSettings: function() {

            var view = this,
                user = Pump.principalUser,
                profile = user.profile,
                haveNewAvatar = (view.fileCount > 0);

            view.startSpin();

            // XXX: Validation?

            if (haveNewAvatar) {
                // This will save the profile afterwards
                view.$("#avatar-fineupload").fineUploader("uploadStoredFiles");
            } else {
                // No new image
                view.saveProfile(null);
            }

            return false;
        }
    });

    Pump.AccountContent = Pump.ContentView.extend({
        templateName: "account",
        modelName: "user",
        events: {
            "submit #account": "saveAccount"
        },
        saveAccount: function() {
            var view = this,
                user = Pump.principalUser,
                password = view.$("#password").val(),
                repeat = view.$("#repeat").val();

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
                                  view.showError(error);
                                  view.stopSpin();
                              }
                          }
                         );
            }

            return false;
        }
    });

    Pump.ObjectContent = Pump.ContentView.extend({
        templateName: "object",
        modelName: "object",
        events: {
            "click .favorite": "favoriteObject",
            "click .unfavorite": "unfavoriteObject",
            "click .share": "shareObject",
            "click .unshare": "unshareObject",
            "click .comment": "openComment"
        },
        setupSubs: function() {
            var view = this,
                model = view.model,
                $el = view.$(".replies");

            if (view.replyStream) {
                view.replyStream.setElement($el);
                return;
            }

            view.replyStream = new Pump.ReplyStreamView({el: $el, model: model.replies});
        },
        favoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "favorite",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".favorite")
                        .filter(":first")
                        .removeClass("favorite")
                        .addClass("unfavorite")
                        .html("Unlike <i class=\"fa fa-thumbs-o-down\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        unfavoriteObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unfavorite",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unfavorite")
                        .filter(":first")
                        .removeClass("unfavorite")
                        .addClass("favorite")
                        .html("Like <i class=\"fa fa-thumbs-o-up\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        shareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "share",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMajorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".share")
                        .removeClass("share")
                        .addClass("unshare")
                        .html("Unshare <i class=\"fa fa-times\"></i>");
                    Pump.addMajorActivity(act);
                }
                view.stopSpin();
            });
        },
        unshareObject: function() {
            var view = this,
                act = new Pump.Activity({
                    verb: "unshare",
                    object: view.model.toJSON()
                });

            view.startSpin();

            Pump.newMinorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                } else {
                    view.$(".unshare")
                        .removeClass("unshare")
                        .addClass("share")
                        .html("Share <i class=\"fa fa-share\"></i>");
                    Pump.addMinorActivity(act);
                }
                view.stopSpin();
            });
        },
        openComment: function() {
            var view = this,
                form;

            if (view.$("form.post-comment").length > 0) {
                view.$("form.post-comment textarea").focus();
            } else {
                form = new Pump.CommentForm({original: view.model});
                form.on("ready", function() {
                    view.$(".replies").append(form.$el);
                });
                form.render();
            }
        }
    });

    Pump.ChooseContactModal = Pump.TemplateView.extend({
        tagName: "div",
        className: "modal-holder",
        templateName: "choose-contact",
        ready: function() {
            var view = this;
            view.$(".thumbnail").tooltip();
            view.$("#add-contact").prop("disabled", true);
            view.$("#add-contact").attr("disabled", "disabled");
        },
        events: {
            "click .thumbnail": "toggleSelection",
            "click #add-contact": "addContact"
        },
        toggled: 0,
        toggleSelection: function(ev) {
            var view = this,
                el = ev.currentTarget,
                $el = $(el);

            // XXX: Bootstrap-dependency

            if ($el.hasClass("alert")) {
                $el.removeClass("alert").removeClass("alert-info");
                view.toggled--;
            } else {
                $el.addClass("alert").addClass("alert-info");
                view.toggled++;
            }

            if (view.toggled === 0) {
                view.$("#add-contact").prop("disabled", true);
                view.$("#add-contact").attr("disabled", "disabled");
            } else {
                view.$("#add-contact").prop("disabled", false);
                view.$("#add-contact").removeAttr("disabled");
            }
        },
        addContact: function() {
            var view = this,
                list = view.options.data.list,
                members = view.options.data.members,
                people = view.options.data.people,
                ids = [],
                done;

            // Extract the IDs from the data- attributes of toggled thumbnails

            view.$(".thumbnail.alert-info").each(function(i, el) {
                var personID = $(el).attr("data-person-id");
                ids.push(personID);
            });

            done = 0;

            // Hide the modal

            view.$el.modal("hide");
            view.remove();

            // Add each person

            _.each(ids, function(id) {

                // We could do this by posting to the minor stream,
                // but this way we automatically update the list view,
                // and the minor stream view gets updated by socksjs, which this
                // does not (yet)

                var person = people.get(id),
                    act = {
                        verb: "add",
                        object: {
                            objectType: "person",
                            id: id
                        },
                        target: {
                            objectType: "collection",
                            id: list.id
                        }
                    };

                Pump.newMinorActivity(act, function(err, act) {
                    if (err) {
                        view.showError(err);
                    } else {
                        members.items.add(person, {at: 0});
                        list.totalItems++;
                        list.trigger("change");
                        Pump.addMinorActivity(act);
                    }
                });
            });
        }
    });

    Pump.PostNoteModal = Pump.TemplateView.extend({

        tagName: "div",
        className: "modal-holder",
        templateName: "post-note",
        ready: function() {
            var view = this;

            view.$("#note-content").wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });

            view.$("#note-to").select2(Pump.selectOpts());
            view.$("#note-cc").select2(Pump.selectOpts());
        },
        events: {
            "click #send-note": "postNote"
        },
        postNote: function(ev) {
            var view = this,
                text = view.$("#post-note #note-content").val(),
                to = view.$("#post-note #note-to").val(),
                cc = view.$("#post-note #note-cc").val(),
                act = new Pump.Activity({
                    verb: "post",
                    object: {
                        objectType: "note",
                        content: text
                    }
                }),
                strToObj = function(str) {
                    var colon = str.indexOf(":"),
                        type = str.slice(0, colon !== -1 ? colon : 0),
                        id = str.slice(colon+1);
                    return new Pump.ActivityObject({
                        id: id,
                        objectType: type
                    });
                };

            if (_.isString(to)) {
                to = to.split(",");
            }

            if (_.isString(cc)) {
                cc = cc.split(",");
            }

            if (to && to.length > 0) {
                act.to = new Pump.ActivityObjectBag(_.map(to, strToObj));
            }

            if (cc && cc.length > 0) {
                act.cc = new Pump.ActivityObjectBag(_.map(cc, strToObj));
            }

            view.startSpin();

            Pump.newMajorActivity(act, function(err, act) {
                if (err) {
                    view.showError(err);
                    view.stopSpin();
                } else {
                    view.stopSpin();
                    view.$el.modal("hide");
                    Pump.resetWysihtml5(view.$("#note-content"));
                    // Reload the current page
                    Pump.addMajorActivity(act);
                    view.remove();
                }
            });
        }
    });

    Pump.PostPictureModal = Pump.TemplateView.extend({
        tagName: "div",
        className: "modal-holder",
        templateName: "post-picture",
        events: {
            "click #send-picture": "postPicture"
        },
        ready: function() {
            var view = this;

            view.$("#picture-to").select2(Pump.selectOpts());
            view.$("#picture-cc").select2(Pump.selectOpts());

            view.$("#picture-description").wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });

            if (view.$("#picture-fineupload").length > 0) {
                view.$("#picture-fineupload").fineUploader({
                    request: {
                        endpoint: "/main/upload"
                    },
                    text: {
                        uploadButton: '<i class="fa fa-upload"></i> Picture file'
                    },
                    template: '<div class="qq-uploader">' +
                        '<pre class="qq-upload-drop-area"><span>{dragZoneText}</span></pre>' +
                        '<div class="qq-drop-processing"></div>' +
                        '<div class="qq-upload-button btn btn-success">{uploadButtonText}</div>' +
                        '<ul class="qq-upload-list"></ul>' +
                        "</div>",
                    classes: {
                        success: "alert alert-success",
                        fail: "alert alert-error"
                    },
                    autoUpload: false,
                    multiple: false,
                    validation: {
                        allowedExtensions: ["jpeg", "jpg", "png", "gif", "svg", "svgz"],
                        acceptFiles: "image/*"
                    }
                }).on("complete", function(event, id, fileName, responseJSON) {

                    var stream = Pump.principalUser.majorStream,
                        to = view.$("#post-picture #picture-to").val(),
                        cc = view.$("#post-picture #picture-cc").val(),
                        strToObj = function(str) {
                            var colon = str.indexOf(":"),
                                type = str.slice(0, colon !== -1 ? colon : 0),
                                id = str.slice(colon+1);
                            return Pump.ActivityObject.unique({
                                id: id,
                                objectType: type
                            });
                        },
                        act = new Pump.Activity({
                            verb: "post",
                            object: responseJSON.obj
                        });

                    if (_.isString(to)) {
                        to = to.split(",");
                    }

                    if (_.isString(cc)) {
                        cc = cc.split(",");
                    }

                    if (to && to.length > 0) {
                        act.to = new Pump.ActivityObjectBag(_.map(to, strToObj));
                    }

                    if (cc && cc.length > 0) {
                        act.cc = new Pump.ActivityObjectBag(_.map(cc, strToObj));
                    }

                    Pump.newMajorActivity(act, function(err, act) {
                        if (err) {
                            view.showError(err);
                            view.stopSpin();
                        } else {
                            view.$el.modal("hide");
                            view.stopSpin();
                            view.$("#picture-fineupload").fineUploader("reset");
                            Pump.resetWysihtml5(view.$("#picture-description"));
                            view.$("#picture-title").val("");
                            // Reload the current content
                            Pump.addMajorActivity(act);
                            view.remove();
                        }
                    });
                }).on("error", function(event, id, fileName, reason) {
                    view.showError(reason);
                });
            }
        },
        postPicture: function(ev) {
            var view = this,
                description = view.$("#post-picture #picture-description").val(),
                title = view.$("#post-picture #picture-title").val(),
                params = {};

            if (title) {
                params.title = title;
            }

            // XXX: HTML

            if (description) {
                params.description = description;
            }

            view.$("#picture-fineupload").fineUploader("setParams", params);

            view.startSpin();

            view.$("#picture-fineupload").fineUploader("uploadStoredFiles");
        }
    });

    Pump.NewListModal = Pump.TemplateView.extend({

        tagName: "div",
        className: "modal-holder",
        templateName: "new-list",
        ready: function() {
            var view = this;
            view.$("#list-description").wysihtml5({
                customTemplates: Pump.wysihtml5Tmpl
            });
        },
        events: {
            "click #save-new-list": "saveNewList"
        },
        saveNewList: function() {
            var view = this,
                description = view.$("#new-list #list-description").val(),
                name = view.$("#new-list #list-name").val(),
                act;

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

                Pump.newMinorActivity(act, function(err, act) {
                    var aview;
                    if (err) {
                        view.stopSpin();
                        view.showError(err);
                    } else {

                        view.$el.modal("hide");
                        view.stopSpin();
                        Pump.resetWysihtml5(view.$("#list-description"));
                        view.$("#list-name").val("");

                        view.remove();

                        // it's minor

                        Pump.addMinorActivity(act);

                        if ($("#list-menu-inner").length > 0) {
                            aview = new Pump.ListMenuItem({model: act.object, data: {list: act.object}});
                            aview.on("ready", function() {
                                var rel;
                                aview.$el.hide();
                                $("#list-menu-inner").prepend(aview.$el);
                                aview.$el.slideDown("fast");
                                // Go to the new list page
                                rel = Pump.rel(act.object.get("url"));
                                Pump.router.navigate(rel, true);
                            });
                            aview.render();
                        }
                    }
                });
            }

            return false;
        }
    });

    Pump.AreYouSureModal = Pump.TemplateView.extend({
        tagName: "div",
        className: "modal-holder",
        templateName: "are-you-sure",
        events: {
            "click #yes": "yes",
            "click #no": "no"
        },
        yes: function() {
            var view = this,
                callback = view.options.callback;

            view.$el.modal("hide");
            view.remove();

            callback(null, true);
        },
        no: function() {
            var view = this,
                callback = view.options.callback;

            view.$el.modal("hide");
            view.remove();

            callback(null, false);
        }
    });

    Pump.LightboxModal = Pump.TemplateView.extend({
        tagName: "div",
        className: "modal-holder",
        templateName: "lightbox-modal"
    });

    Pump.BodyView = Backbone.View.extend({
        initialize: function(options) {
            _.bindAll(this, "navigateToHref");
        },
        el: "body",
        events: {
            "click a": "navigateToHref"
        },
        navigateToHref: function(ev) {
            var el = (ev.srcElement || ev.currentTarget),
                here = window.location;

            // This gets fired for children of <a> elements, too. So we navigate
            // up the DOM tree till we find an element that has a pathname (or
            // we run out of tree)

            for (el = (ev.srcElement || ev.currentTarget); el; el = el.parentNode) {
                if (el.pathname) {
                    break;
                }
            }

            // Check for a good value

            if (!el || !el.pathname) {
                Pump.debug("Silently not navigating to non-existent target.");
                return false;
            }

            // Bootstrap components; let these through

            if ($(el).hasClass("dropdown-toggle") ||
                $(el).attr("data-toggle") == "collapse") {
                return true;
            }

            // Save a spot in case we come back

            if ($(el).hasClass("save-continue-to")) {
                Pump.saveContinueTo();
            } else if ($(el).hasClass("add-continue")) {
                Pump.continueTo = Pump.getContinueTo();
            }

            // For local <a>, use the router

            if (!el.host || el.host == here.host && !el.attributes["data-bypass"]) {
                try {
                    Pump.debug("Navigating to " + el.pathname);
                    Pump.router.navigate(el.pathname, true);
                } catch (e) {
                    Pump.error(e);
                }
                // Always return false
                return false;
            } else {
                Pump.debug("Default anchor handling");
                return true;
            }
        },
        setContent: function(options, callback) {

            var View = options.contentView,
                title = options.title,
                body = this,
                oldContent = body.content,
                userContentOptions,
                listContentOptions,
                newView,
                parent,
                profile;

            if (options.model) {
                profile = options.model;
            } else if (options.data) {
                profile = options.data.profile;
            }

            Pump.unfollowStreams();

            // XXX: double-check this

            Pump.debug("Initializing new " + View.prototype.templateName);
            body.content = new View(options);
            Pump.debug("Done initializing new " + View.prototype.templateName);

            // We try and only update the parts that have changed

            if (oldContent &&
                options.userContentView &&
                oldContent.profileBlock &&
                oldContent.profileBlock.model.get("id") == profile.get("id")) {

                if (body.content.profileBlock) {
                    Pump.debug("Removing profile block #" + body.content.profileBlock.cid + " from " + View.prototype.templateName);
                    body.content.profileBlock.remove();
                }

                Pump.debug("Connecting profile block #" + oldContent.profileBlock.cid + " to " + View.prototype.templateName);

                body.content.profileBlock = oldContent.profileBlock;

                if (options.userContentStream) {
                    userContentOptions = _.extend({model: options.userContentStream}, options);
                } else {
                    userContentOptions = options;
                }

                body.content.userContent = new options.userContentView(userContentOptions);

                if (options.listContentView &&
                    oldContent.userContent.listMenu) {

                    if (body.content.userContent.listMenu) {
                        Pump.debug("Removing list menu #" + body.content.userContent.listMenu.cid + " from " + View.prototype.templateName);
                        body.content.userContent.listMenu.remove();
                    }

                    Pump.debug("Connecting list menu #" + oldContent.userContent.listMenu.cid + " to " + View.prototype.templateName);

                    body.content.userContent.listMenu = oldContent.userContent.listMenu;

                    if (options.listContentModel) {
                        listContentOptions = _.extend({model: options.listContentModel}, options);
                    } else {
                        listContentOptions = options;
                    }

                    body.content.userContent.listContent = new options.listContentView(listContentOptions);
                    parent = "#list-content";
                    newView = body.content.userContent.listContent;

                } else {
                    parent = "#user-content";
                    newView = body.content.userContent;

                    if (oldContent.userContent.listMenu) {
                        Pump.debug("Removing list menu #" + oldContent.userContent.listMenu.cid);
                        oldContent.userContent.listMenu.remove();
                    }
                }
            } else {
                parent = "#content";
                newView = body.content;

                if (oldContent && oldContent.profileBlock) {
                    Pump.debug("Removing profile block #" + oldContent.profileBlock.cid);
                    oldContent.profileBlock.remove();
                }

                if (oldContent && oldContent.userContent && oldContent.userContent.listMenu) {
                    Pump.debug("Removing list menu #" + oldContent.userContent.listMenu.cid);
                    oldContent.userContent.listMenu.remove();
                }
            }

            newView.once("ready", function() {
                Pump.setTitle(title);
                body.$(parent).children().replaceWith(newView.$el);
                Pump.followStreams();
                window.scrollTo(0, 0);
                if (callback) {
                    callback();
                }
                // Stop spinning
            });

            newView.render();
        },
        startLoad: function() {
            var view = this;
            view.$("a.brand").spin({color: "white"});
        },
        endLoad: function() {
            var view = this;
            view.$("a.brand").spin(false);
        }
    });

    Pump.showModal = function(Cls, options) {

        var modalView;

        // If we've got it attached already, just show it

        modalView = new Cls(options);

        // When it's ready, show immediately

        modalView.on("ready", function() {
            $("body").append(modalView.el);
            modalView.$el.modal("show");
            if (options.ready) {
                options.ready();
            }
        });

        // render it (will fire "ready")

        modalView.render();
    };

    Pump.resetWysihtml5 = function(el) {
        var fancy = el.data("wysihtml5");
        if (fancy && fancy.editor && fancy.editor.clear) {
            fancy.editor.clear();
        }
        $(".wysihtml5-command-active", fancy.toolbar).removeClass("wysihtml5-command-active");
        return el;
    };

    Pump.addMajorActivity = function(act) {
        if (Pump.body.content) {
            Pump.body.content.addMajorActivity(act);
        }
    };

    Pump.addMinorActivity = function(act) {
        if (Pump.body.content) {
            Pump.body.content.addMinorActivity(act);
        }
    };

    Pump.areYouSure = function(question, callback) {
        Pump.showModal(Pump.AreYouSureModal,
                       {data: {question: question},
                        callback: callback});
    };

    Pump.selectOpts = function() {
        var user = Pump.principalUser,
            lists = Pump.principal.lists,
            followersUrl = Pump.principal.followers.url(),
            lastSearch = null;

        return {
            width: "90%",
            multiple: true,
            placeholder: "Search for a user or list",
            minimumInputLength: 2,
            initSelection: function(element, callback) {
                var val = element.val(),
                    strToObj = function(str) {
                        var colon = str.indexOf(":"),
                            type = str.slice(0, colon !== -1 ? colon : 0),
                            id = str.slice(colon+1);
                        return new Pump.ActivityObject({
                            id: id,
                            objectType: type
                        });
                    },
                    selection = [],
                    obj = (val && val.length > 0) ? strToObj(val) : null;

                if (obj) {
                    if (obj.id == "http://activityschema.org/collection/public") {
                        selection.push({id: "collection:http://activityschema.org/collection/public",
                                        text: "Public"});
                    } else if (obj.id == followersUrl) {
                        selection.push({id: "collection:" + followersUrl,
                                        text: "Followers"});
                    } else {
                        // XXX: Get the object remotely
                    }
                }
                callback(selection);
            },
            query: function(options) {
                var term = options.term.toLowerCase(),
                    lmatch = lists.items.filter(function(item) {
                        return item.get("displayName").toLowerCase().indexOf(term) != -1;
                    });

                // Abort if something's already running

                if (lastSearch) {
                    lastSearch.abort();
                    lastSearch = null;
                }

                Pump.ajax({
                    type: "GET",
                    dataType: "json",
                    url: Pump.fullURL("/api/user/"+user.get("nickname")+"/following?q="+term),
                    success: function(data) {
                        var people = _.map(data.items, function(item) {
                            return {id: item.objectType + ":" + item.id,
                                    text: item.displayName};
                        }),
                            results = [];

                        lastSearch = null;

                        if ("Public".toLowerCase().indexOf(term) != -1) {
                            results.push({id: "collection:http://activityschema.org/collection/public",
                                          text: "Public"});
                        }

                        if ("Followers".toLowerCase().indexOf(term) != -1) {
                            results.push({id: "collection:"+followersUrl,
                                          text: "Followers"});
                        }

                        if (people.length > 0) {
                            results.push({ text: "People", children: people });
                        }

                        if (lmatch.length > 0) {
                            results.push({ text: "Lists",
                                           children: _.map(lmatch, function(list) {
                                               return {id: list.get("objectType") + ":" + list.id,
                                                       text: list.get("displayName")};
                                           })
                                         });
                        }

                        options.callback({
                            results: results
                        });
                    },
                    error: function(jqxhr) {
                        lastSearch = null;
                        options.callback([]);
                    },
                    started: function(jqxhr) {
                        lastSearch = jqxhr;
                    }
                });
            }
        };
    };

    Pump.ExtraMenu = Pump.TemplateView.extend({
        parent: null,
        templateName: "extra-menu",
        events: {
            "click .delete-object": "deleteObject"
        },
        initialize: function(options) {
            var view = this;
            if (options.parent) {
                view.parent = options.parent;
            }
        },
        show: function() {
            var view = this;
            view.render();
        },
        ready: function() {
            var view = this;
            if (view.parent && view.parent.$el) {
                view.parent.$el.prepend(view.$el);
            }
        },
        hide: function() {
            var view = this;
            view.$el.remove();
        },
        deleteObject: function() {
            var view = this,
                model = view.model,
                act = new Pump.Activity({
                    verb: "delete",
                    object: view.model.toJSON()
                }),
                prompt = "Delete this " + model.get("objectType") + "?";

            // Hide the dropdown, since we were selected
            view.$el.dropdown("toggle");

            Pump.areYouSure(prompt, function(err, sure) {
                if (sure) {
                    Pump.newMinorActivity(act, function(err, act) {
                        if (err) {
                            view.showError(err);
                        } else {
                            Pump.addMinorActivity(act);
                            // Remove the parent from the list
                            view.parent.$el.remove();
                            // Remove the model from the client-side collection
                            model.collection.remove(model.id);
                        }
                    });
                }
            });
        }
    });

})(window._, window.$, window.Backbone, window.Pump);
