// pump/router.js
//
// Backbone router for the pump.io client UI
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

(function(_, $, Backbone, Pump) {

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
            ":nickname/activity/:uuid": "activity",
            ":nickname/:type/:uuid":  "object",
            "main/messages":          "messages",
            "main/settings":          "settings",
            "main/account":           "account",
            "main/register":          "register",
            "main/login":             "login"
        },

        register: function() {
            Pump.body.setContent({contentView: Pump.RegisterContent,
                                  title: "Register"});
        },

        login: function() {
            Pump.body.setContent({contentView: Pump.LoginContent,
                                  title: "Login"});
        },

        settings: function() {
            Pump.body.setContent({contentView: Pump.SettingsContent,
                                  model: Pump.currentUser.profile,
                                  title: "Settings"});
        },

        account: function() {
            Pump.body.setContent({contentView: Pump.AccountContent,
                                  model: Pump.currentUser,
                                  title: "Account"});
        },

        messages: function() {
            var user = Pump.currentUser,
                major = user.majorDirectInbox,
                minor = user.minorDirectInbox;

            Pump.fetchObjects([user, major, minor], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.MessagesContent,
                                      data: {major: major,
                                             minor: minor,
                                             headless: false},
                                      title: "Messages"});
            });
        },

        "home": function() {
            var pair = Pump.getUserCred();

            if (pair) {
                var user = Pump.currentUser,
                    major = user.majorInbox,
                    minor = user.minorInbox;

                Pump.fetchObjects([user, major, minor], function(err, objs) {
                    if (err) {
                        Pump.error(err);
                        return;
                    }
                    Pump.body.setContent({contentView: Pump.InboxContent,
                                          data: {major: major,
                                                 minor: minor},
                                          title: "Home"});
                });
            } else {
                Pump.body.setContent({contentView: Pump.MainContent,
                                      title: "Welcome"});
            }
        },

        profile: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                major = user.majorStream,
                minor = user.minorStream;

            Pump.fetchObjects([user, major, minor], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.UserPageContent,
                                      userContentView: Pump.ActivitiesUserContent,
                                      title: profile.get("displayName"),
                                      data: { major: major,
                                              minor: minor,
                                              headless: true,
                                              profile: profile }});
            });
        },

        favorites: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                favorites = Pump.ActivityObjectStream.unique([], {url: Pump.fullURL("/api/user/"+nickname+"/favorites")});

            Pump.fetchObjects([user, favorites], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({
                    contentView: Pump.FavoritesContent,
                    userContentView: Pump.FavoritesUserContent,
                    userContentCollection: favorites,
                    title: nickname + " favorites",
                    data: { objects: favorites,
                            profile: profile }
                });
            });
        },

        followers: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                followers = Pump.PeopleStream.unique([], {url: Pump.fullURL("/api/user/"+nickname+"/followers")});

            Pump.fetchObjects([user, followers], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.FollowersContent,
                                      userContentView: Pump.FollowersUserContent,
                                      userContentCollection: followers,
                                      title: nickname + " followers",
                                      data: {people: followers,
                                             profile: profile}});
            });
        },

        following: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                following = Pump.PeopleStream.unique([], {url: Pump.fullURL("/api/user/"+nickname+"/following")});

            // XXX: parallelize this?

            Pump.fetchObjects([user, following], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.FollowingContent,
                                      userContentView: Pump.FollowingUserContent,
                                      userContentCollection: following,
                                      title: nickname + " following",
                                      data: {people: following,
                                             profile: profile}});
            });
        },

        lists: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                lists = Pump.ListStream.unique([], {url: Pump.fullURL("/api/user/"+nickname+"/lists/person")});

            // XXX: parallelize this?

            Pump.fetchObjects([user, lists], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.ListsContent,
                                      userContentView: Pump.ListsUserContent,
                                      listContentView: Pump.ListsListContent,
                                      title: nickname + " lists",
                                      data: {lists: lists,
                                             list: null,
                                             profile: profile}});
            });
        },

        list: function(nickname, uuid) {

            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                lists = Pump.ListStream.unique([], {url: Pump.fullURL("/api/user/"+nickname+"/lists/person")}),
                list = Pump.List.unique({links: {self: {href: "/api/collection/"+uuid}}});

            // XXX: parallelize this?

            Pump.fetchObjects([user, lists, list], function(err, objs) {
                var profile = user.profile,
                    options = {contentView: Pump.ListContent,
                               userContentView: Pump.ListUserContent,
                               listContentView: Pump.ListListContent,
                               title: nickname + " - list -" + list.get("displayName"),
                               listContentModel: list,
                               data: {lists: lists,
                                      list: list,
                                      profile: profile}};
                if (err) {
                    Pump.error(err);
                    return;
                }

                Pump.body.setContent(options, function(view) {
                    Pump.body.content.userContent.listMenu.$(".active").removeClass("active");
                    Pump.body.content.userContent.listMenu.$("li[data-list-id='"+list.id+"']").addClass("active");
                });
            });
        },

        object: function(nickname, type, uuid) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                obj = Pump.ActivityObject.unique({uuid: uuid, objectType: type, userNickname: nickname});

            Pump.fetchObjects([user, obj], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.ObjectContent,
                                      model: obj,
                                      title: obj.displayName || obj.objectType + "by" + nickname});
            });
        },

        activity: function(nickname, uuid) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                activity = Pump.Activity.unique({uuid: uuid});

            Pump.fetchObjects([user, activity], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.ActivityContent,
                                      model: activity,
                                      title: activity.content});
            });
        }
    });

})(window._, window.$, window.Backbone, window.Pump);