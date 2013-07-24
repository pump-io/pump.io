// pump/router.js
//
// Backbone router for the pump.io client UI
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
            "main/login":             "login",
            "main/remote":            "remote",
            "main/recover":           "recover",
            "main/recover-sent":      "recoverSent",
            "main/recover/:code":      "recoverCode"
        },

        register: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.RegisterContent,
                                  title: "Register"},
                                 function() {
                                     Pump.body.endLoad();
                                 }
                                );
        },

        login: function() {
            var continueTo = Pump.getContinueTo();
            if (Pump.principalUser) {
                Pump.router.navigate(continueTo, true);
                Pump.clearContinueTo();
            } else if (Pump.principal) {
                Pump.router.navigate(continueTo, true);
                Pump.clearContinueTo();
            } else {
                Pump.body.startLoad();
                Pump.body.setContent({contentView: Pump.LoginContent,
                                      title: "Login"},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            }
        },

        remote: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.RemoteContent,
                                  title: "Remote login"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        recover: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.RecoverContent,
                                  title: "Recover your password"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        recoverSent: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.RecoverSentContent,
                                  title: "Recovery email sent"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        recoverCode: function(code) {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.RecoverCodeContent,
                                  title: "Recovery code"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        settings: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.SettingsContent,
                                  model: Pump.principal,
                                  title: "Settings"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        account: function() {
            Pump.body.startLoad();
            Pump.body.setContent({contentView: Pump.AccountContent,
                                  model: Pump.principalUser,
                                  title: "Account"},
                                 function() {
                                     Pump.body.endLoad();
                                 });
        },

        messages: function() {
            var user = Pump.principalUser,
                major = user.majorDirectInbox,
                minor = user.minorDirectInbox;

            Pump.body.startLoad();
            Pump.fetchObjects([user, major, minor], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.MessagesContent,
                                      data: {major: major,
                                             minor: minor,
                                             headless: false},
                                      title: "Messages"},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        "home": function() {
            var pair = Pump.getUserCred();

            Pump.body.startLoad();
            if (pair) {
                var user = Pump.principalUser,
                    major = user.majorInbox,
                    minor = user.minorInbox;

                Pump.fetchObjects([user, major, minor], function(err, objs) {
                    if (err) {
                        Pump.error(err);
                        return;
                    }
                    Pump.body.setContent({contentView: Pump.InboxContent,
                                          data: {major: major,
                                                 minor: minor,
                                                 headless: false},
                                          title: "Home"},
                                         function() {
                                             Pump.body.endLoad();
                                         });
                });
            } else {
                Pump.body.setContent({contentView: Pump.MainContent,
                                      title: "Welcome"},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            }
        },

        profile: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                major = user.majorStream,
                minor = user.minorStream;

            Pump.body.startLoad();
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
                                              profile: profile }},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        favorites: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                favorites = Pump.ActivityObjectStream.unique({url: Pump.fullURL("/api/user/"+nickname+"/favorites")});

            Pump.body.startLoad();

            Pump.fetchObjects([user, favorites], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent(
                    {
                        contentView: Pump.FavoritesContent,
                        userContentView: Pump.FavoritesUserContent,
                        userContentStream: favorites,
                        title: nickname + " favorites",
                        data: {favorites: favorites,
                               profile: profile}
                    },
                    function() {
                        Pump.body.endLoad();
                    }
                );
            });
        },

        followers: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                followers = Pump.PeopleStream.unique({url: Pump.fullURL("/api/user/"+nickname+"/followers")});

            Pump.body.startLoad();

            Pump.fetchObjects([user, followers], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.FollowersContent,
                                      userContentView: Pump.FollowersUserContent,
                                      userContentStream: followers,
                                      title: nickname + " followers",
                                      data: {followers: followers,
                                             profile: profile}},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        following: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                following = Pump.PeopleStream.unique({url: Pump.fullURL("/api/user/"+nickname+"/following")});

            // XXX: parallelize this?

            Pump.body.startLoad();

            Pump.fetchObjects([user, following], function(err, objs) {
                var profile = user.profile;
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.FollowingContent,
                                      userContentView: Pump.FollowingUserContent,
                                      userContentStream: following,
                                      title: nickname + " following",
                                      data: {following: following,
                                             profile: profile}},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        lists: function(nickname) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                lists = Pump.ListStream.unique({url: Pump.fullURL("/api/user/"+nickname+"/lists/person")});

            Pump.body.startLoad();

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
                                             profile: profile}},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        list: function(nickname, uuid) {

            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                lists = Pump.ListStream.unique({url: Pump.fullURL("/api/user/"+nickname+"/lists/person")}),
                list = Pump.List.unique({links: {self: {href: "/api/collection/"+uuid}}}),
                members = Pump.PeopleStream.unique({url: Pump.fullURL("/api/collection/"+uuid+"/members")});

            Pump.body.startLoad();

            Pump.fetchObjects([user, lists, list, members], function(err, objs) {

                if (err) {
                    Pump.error(err);
                    return;
                }

                var profile = user.profile,
                    options = {contentView: Pump.ListContent,
                               userContentView: Pump.ListUserContent,
                               listContentView: Pump.ListListContent,
                               title: nickname + " - list -" + list.get("displayName"),
                               listContentModel: list,
                               data: {lists: lists,
                                      list: list,
                                      profile: profile,
                                      members: members}};

                if (err) {
                    Pump.error(err);
                    return;
                }

                Pump.body.setContent(options, function(view) {
                    var lm = Pump.body.content.userContent.listMenu;
                    lm.$(".active").removeClass("active");
                    lm.$("li[data-list-id='"+list.id+"']").addClass("active");
                    Pump.body.endLoad();
                });
            });
        },

        object: function(nickname, type, uuid) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                obj = Pump.ActivityObject.unique({uuid: uuid, objectType: type, userNickname: nickname});

            Pump.body.startLoad();

            Pump.fetchObjects([user, obj], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.ObjectContent,
                                      model: obj,
                                      title: obj.get("displayName") || (obj.get("objectType") + " by " + nickname)},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        },

        activity: function(nickname, uuid) {
            var router = this,
                user = Pump.User.unique({nickname: nickname}),
                activity = Pump.Activity.unique({uuid: uuid});

            Pump.body.startLoad();

            Pump.fetchObjects([user, activity], function(err, objs) {
                if (err) {
                    Pump.error(err);
                    return;
                }
                Pump.body.setContent({contentView: Pump.ActivityContent,
                                      model: activity,
                                      title: activity.content},
                                     function() {
                                         Pump.body.endLoad();
                                     });
            });
        }
    });

})(window._, window.$, window.Backbone, window.Pump);
