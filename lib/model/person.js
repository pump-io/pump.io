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
                          "uuid"],
                 indices: ["uuid"]
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

exports.Person = Person;
