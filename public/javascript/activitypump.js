(function($, Backbone) {

    $(document).ready(function() {

        var Activity = Backbone.Model.extend({
            url: function() {
                var links = this.get("links"),
                    uuid = this.get("uuid");
                if (links && _.isObject(links) && links.self) {
                    return links.self;
                } else if (uuid) {
                    return "/activity/" + uuid;
                } else {
                    return null;
                }
            }
        });

        var ActivityStream = Backbone.Collection.extend({
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
                return "/user/" + this.user.get("nickname") + "/feed";
            }
        });

        var UserInbox = ActivityStream.extend({
            user: null,
            initialize: function(models, options) {
                this.user = options.user;
            },
            url: function() {
                return "/user/" + this.user.get("nickname") + "/inbox";
            }
        });

        var User = Backbone.Model.extend({
            url: function() {
                return "/user/" + this.get("nickname");
            },
            getStream: function() {
                return new UserStream([], {user: this});
            },
            getInbox: function() {
                return new UserInbox([], {user: this});
            }
        });

        var currentUser = null; // XXX: load from server...?

        var templates = {};

        var TemplateView = Backbone.View.extend({
            templateName: null,
            render: function() {
                var name = this.templateName,
                    url = '/template/'+name+'.template',
                    view = this,
                    json = (!view.model) ? {} : ((view.model.toJSON) ? view.model.toJSON() : view.model);

                if (!templates[name]) {
                    $.get(url, function(data) {
                        templates[name] = _.template(data);
                        $(view.el).html(templates[name](json));
                    });
                } else {
                    $(view.el).html(templates[name](json));
                }
                return this;
            }
        });

        var AnonymousNav = TemplateView.extend({
            tagname: "div",
            classname: "nav",
            templateName: 'nav-anonymous',
            events: {
                "submit #login": "login"
            },
            login: function() {
                var view = this,
                    params = {nickname: this.$('#login input[name="nickname"]').val(),
                              password: this.$('#login input[name="password"]').val()};

                $.post("/login", params, function(user) {
                    currentUser = new User(user);
                    var un = new UserNav({model: currentUser, el: view.el});
                    un.render();
                });
                return false;
            }
        });

        var UserNav = TemplateView.extend({
            tagname: "div",
            classname: "nav",
            templateName: 'nav-loggedin',
            events: {
                "click #logout": "logout"
            },
            logout: function() {
                var view = this;
                $.post("/logout", {nickname: currentUser.nickname}, function(data) {
                    currentUser = null;
                    var an = new AnonymousNav({el: view.el});
                    an.render();
                });
                return false;
            }
        });

        var Header = TemplateView.extend({
            templateName: 'header',
            el: '#header'
        });

        var MainContent = TemplateView.extend({
            templateName: 'main-content',
            el: '#content'
        });

        var MainSidebar = TemplateView.extend({
            templateName: 'main-sidebar',
            el: '#sidebar'
        });

        var UserPageHeader = TemplateView.extend({
            templateName: 'user-page-header',
            el: '#header'
        });

        var UserPageSidebar = TemplateView.extend({
            templateName: 'user-page-sidebar',
            el: '#sidebar'
        });

        var UserPageContent = TemplateView.extend({
            templateName: 'user-page-content',
            el: '#content'
        });

        var InboxHeader = TemplateView.extend({
            templateName: 'inbox-header',
            el: '#header'
        });

        var InboxSidebar = TemplateView.extend({
            templateName: 'inbox-sidebar',
            el: '#sidebar'
        });

        var InboxContent = TemplateView.extend({
            templateName: 'inbox-content',
            el: '#content'
        });

        var ActivityHeader = TemplateView.extend({
            templateName: 'activity-header',
            el: '#header'
        });

        var ActivitySidebar = TemplateView.extend({
            templateName: 'activity-sidebar',
            el: '#sidebar'
        });

        var ActivityContent = TemplateView.extend({
            templateName: 'activity-content',
            el: '#content'
        });

        var ActivityPump = Backbone.Router.extend({

            routes: {
                "/":                       "public",    
                "/:nickname":              "profile",   
                "/:nickname/inbox":        "inbox",  
                "/:nickname/activity/:id": "activity",
                "/settings":               "settings"
            },

            public: function() {
                var header = new Header({model: {title: "Welcome", subtitle: ""}}),
                    sidebar = new MainSidebar({}),
                    content = new MainContent({});

                header.render();
                sidebar.render();
                content.render();
            },

            profile: function(nickname) {
                var user = new User({nickname: nickname}),
                    stream = user.getStream();

                user.fetch({success: function(user, response) {
                    stream.fetch({success: function(stream, response) {
                        var header = new UserPageHeader({model: user}),
                            sidebar = new UserPageSidebar({model: user}),
                            content = new UserPageContent({model: {actor: user.toJSON(), stream: stream.toJSON()}});

                        header.render();
                        sidebar.render();
                        content.render();
                    }});
                }});
            },

            inbox: function(nickname) {
                var user = new User({nickname: nickname}),
                    inbox = user.getInbox();

                user.fetch({success: function(user, response) {
                    inbox.fetch({success: function(inbox, response) {
                        var header = new InboxHeader({model: user}),
                            sidebar = new InboxSidebar({model: user}),
                            content = new InboxContent({model: {stream: inbox.toJSON()}});

                        header.render();
                        sidebar.render();
                        content.render();
                    }});
                }});
            },

            activity: function(nickname, id) {
                var act = new Activity({uuid: id, userNickname: nickname});

                act.fetch({success: function(act, response) {
                    var header = new ActivityHeader({model: act}),
                        sidebar = new ActivitySidebar({model: act}),
                        content = new ActivityContent({model: act});

                    header.render();
                    sidebar.render();
                    content.render();
                }});
            }
        });

        var ap = new ActivityPump();

        var BodyView = Backbone.View.extend({
            el: "body",
            events: {
                "click a": "navigateToHref"
            },
            navigateToHref: function(ev) {
                var el = (ev.srcElement || ev.currentTarget),
                    pathname = el.pathname, // XXX: HTML5
                    here = window.location;

                if (!el.host || el.host === here.host) {
                    ap.navigate(pathname, true);
                }

                return false;
            }
        });

        var bv = new BodyView();

        var nav;

        if ($("#topnav #login").length > 0) {
            nav = new AnonymousNav({el: "#topnav"});
        } else {
            nav = new UserNav({el: "#topnav"});
        }

        Backbone.history.start({pushState: true, silent: true});
    });

})(window.jQuery, window.Backbone);
