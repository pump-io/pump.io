(function($, Backbone) {

    $(document).ready(function() {

        var User = Backbone.Model.extend({
            url: function() {
                return "/user/" + this.get("nickname");
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
                    json = (view.model) ? view.model.toJSON() : {};

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

        var UserPageHeader = TemplateView.extend({
            templateName: 'user-page-header',
            el: '#header'
        });

        var UserPageSidebar = TemplateView.extend({
            templateName: 'user-page-sidebar',
            el: '#sidebar'
        });

        var ActivityPump = Backbone.Router.extend({

            routes: {
                "/":                 "public",    
                "/:nickname":        "profile",   
                "/:nickname/inbox":  "inbox",  
                "/activity/:id":     "activity",
                "/settings":         "settings"
            },

            public: function() {
            },

            profile: function(nickname) {
                var user = new User({nickname: nickname});
                user.fetch({success: function(user, response) {
                    var header = new UserPageHeader({model: user}),
                        sidebar = new UserPageSidebar({model: user});
                    header.render();
                    sidebar.render();
                }});
            },

            inbox: function(nickname) {
            },

            activity: function(id) {
            }
        });

        var ap = new ActivityPump();

        var BodyView = Backbone.View.extend({
            el: "body",
            events: {
                "click a": "navigateToHref"
            },
            navigateToHref: function(ev) {
                var el = ev.srcElement,
                    href = $(el).attr("href");
                console.log("Going to " + href + "...");
                ap.navigate(href, true);
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
