// person.js
//
// data object representing an person
//
// Copyright 2011,2012 StatusNet Inc.
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

var DatabankObject = require("databank").DatabankObject,
    Step = require("step"),
    _ = require("underscore"),
    wf = require("webfinger"),
    ActivityObject = require("./activityobject").ActivityObject,
    URLMaker = require("../urlmaker").URLMaker;

var Person = DatabankObject.subClass("person", ActivityObject);

Person.schema = {pkey: "id",
                 fields: ["displayName",
                          "image",
                          "published",
                          "updated",
                          "url",
                          "_uuid"],
                 indices: ["_uuid"]
                };

Person.beforeCreate = function(props, callback) {

    // Are we creating a local user?
    // XXX: watch out for tricks!

    if (_.has(props, "_user") && props._user) {

        if (!_.has(props, "links")) {
            props.links = {};
        }

        props.links["activity-inbox"] = {
            href: URLMaker.makeURL("api/user/" + props.preferredUsername + "/inbox")
        };

        props.links["activity-outbox"] = {
            href: URLMaker.makeURL("api/user/" + props.preferredUsername + "/feed")
        };

        // Add the feeds sub-elements

        Person.ensureFeeds(props, props.preferredUsername);
    }

    ActivityObject.beforeCreate.apply(Person, [props, callback]);
};

Person.ensureFeeds = function(obj, nickname) {
    var feeds = ["followers", "following", "favorites"];
    _.each(feeds, function(feed) {
        if (!_.has(obj, feed)) {
            obj[feed] = {
                url: URLMaker.makeURL("/api/user/"+nickname+"/"+feed)
            };
        }
    });
    if (!_.has(obj, "lists")) {
        obj.lists = {
            url: URLMaker.makeURL("/api/user/"+nickname+"/lists/person")
        };
    }
};

Person.prototype.followersURL = function(callback) {
    var person = this,
        User = require("./user").User;

    Step(
        function() {
            User.fromPerson(person.id, this);
        },
        function(err, user) {
            if (err) {
                callback(err, null);
            } else if (!user) {
                callback(null, null);
            } else {
                callback(null, URLMaker.makeURL("api/user/" + user.nickname + "/followers"));
            }
        }
    );
};

Person.prototype.getInbox = function(callback) {

    var person = this,
        User = require("./user").User;

    // XXX: use person.links to find one with "activity-inbox" rel

    Step(
        function() {
            User.fromPerson(person.id, this);
        },
        function(err, user) {
            if (err) throw err;
            if (user) {
                callback(null, URLMaker.makeURL("api/user/" + user.nickname + "/inbox"));
            } else if (person.id.substr(0, 5) == "acct:") {
                wf.webfinger(person.id.substr(5), this);
            } else {
                // XXX: try LRDD for http: and https: URIs
                // XXX: try LRDD for http: and https: URIs
                // XXX: try getting Link or <link> values from person.url
                callback(new Error("Can't get inbox for " + person.id), null);
            }
        },
        function(err, jrd) {
            var inboxes;
            if (err) {
                callback(err, null);
                return;
            } else if (!_(jrd).has("links") ||
                       !_(jrd.links).isArray()) {
                callback(new Error("Can't get inbox for " + person.id), null);
                return;
            } else {
                // Get the inboxes
                inboxes = jrd.links.filter(function(link) {
                    return (link.hasOwnProperty("rel") && 
                            link.rel == "activity-inbox" &&
                            link.hasOwnProperty("href"));
                });

                if (inboxes.length === 0) {
                    callback(new Error("Can't get inbox for " + person.id), null);
                    return;
                }

                callback(null, inboxes[0].href);
            }
        }
    );
};

Person.prototype.expandFeeds = function(callback) {
    var person = this,
        user;

    // These are inapplicable feeds; hide them

    delete person.likes;
    delete person.replies;

    Step(
        function() {
            var User = require("./user").User;
            User.fromPerson(person.id, this);
        },
        function(err, result) {
            var cb;
            if (err) throw err;
            if (!result) {
                callback(null);
                return;
            }
            user = result;
            user.followerCount(this.parallel());
            user.followingCount(this.parallel());
            user.favoritesCount(this.parallel());
            // Blech.
            cb = this.parallel();
            user.getLists(Person.type, function(err, str) {
                if (err) {
                    cb(err, null);
                } else {
                    str.count(cb);
                }
            });
        },
        function(err, followers, following, favorites, lists) {
            if (err) {
                callback(err);
            } else {
                // Make sure all feed objects exist
                Person.ensureFeeds(person, user.nickname);

                person.followers.totalItems = followers;
                person.following.totalItems = following;
                person.favorites.totalItems = favorites;
                person.lists.totalItems     = lists;

                callback(null);
            }
        }
    );
};

Person.prototype.sanitize = function() {
    if (this._user) {
        delete this._user;
    }
    ActivityObject.prototype.sanitize.apply(this);
};

exports.Person = Person;
