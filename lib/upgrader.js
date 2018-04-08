// upgrader.js
//
// Do in-place upgrades of activity objects as needed
//
// Copyright 2011, 2013 E14N https://e14n.com/
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

"use strict";

var fs = require("fs"),
    os = require("os"),
    path = require("path"),
    urlparse = require("url").parse,
    Step = require("step"),
    _ = require("lodash"),
    thumbnail = require("./thumbnail"),
    URLMaker = require("./urlmaker").URLMaker,
    Activity = require("./model/activity").Activity,
    ActivityObject = require("./model/activityobject").ActivityObject,
    Image = require("./model/image").Image,
    Person = require("./model/person").Person,
    Stream = require("./model/stream").Stream,
    mover = require("./mover"),
    tmp = require("./tmp");

// TODO: this IIFE/new combo is extremely sketchy and I don't really
// get it

/* jshint supernew: true */
var Upgrader = new (function() {

    var upg = this,
        autorotateImage = function(img, callback) {

            var fname = path.join(Image.uploadDir, img._slug),
                tmpdir = tmp.dirSync(),
                tmpname = path.join(tmpdir, img._uuid);

            Step(
                function() {
                    thumbnail.autorotate(fname, tmpname, this);
                },
                function(err) {
                    if (err) throw err;
                    mover.safeMove(tmpname, fname, this);
                },
                callback
            );
        },
        upgradePersonAvatar = function(person, callback) {

            var img,
                urlToSlug = function(person, url) {
                    var start = url.indexOf("/" + person.preferredUsername + "/");
                    return url.substr(start + 1);
                },
                slug,
                reupgrade = function(slug, callback) {
                    Step(
                        function() {
                            Image.search({_fslug: slug}, this);
                        },
                        function(err, images) {
                            var img;
                            if (err) throw err;
                            if (!images || images.length === 0) {
                                throw new Error("No image record found for slug: " + slug);
                            } else {
                                img = images[0];
                                img.image = {
                                    url: img.fullImage.url
                                };
                                img.fullImage = {
                                    url: img.fullImage.url
                                };
                                img._slug = slug;
                                delete img._fslug;
                                callback(null, img);
                            }
                        }
                    );
                };

            // Automated update from v0.2.x, which had no thumbnailing of images
            // This checks for local persons with no "width" in their image
            // and tries to update the user data.

            if (person._user && _.isObject(person.image) && !_.has(person.image, "width") && _.isString(person.image.url)) {

                if (Upgrader.log) Upgrader.log.debug({person: person}, "Upgrading person avatar");

                slug = urlToSlug(person, person.image.url);

                Step(
                    function() {
                        fs.stat(path.join(Image.uploadDir, slug), this);
                    },
                    function(err, stat) {
                        if (err && err.code === "ENOENT") {
                            // If we don't have this file, just skip
                            callback(null);
                        } else if (err) {
                            throw err;
                        } else {
                            this(null);
                        }
                    },
                    function(err) {
                        if (err) throw err;
                        Image.search({"_slug": slug}, this);
                    },
                    function(err, images) {
                        var cb = this;
                        if (err) throw err;
                        if (!images || images.length === 0) {
                            reupgrade(slug, this);
                        } else {
                            this(null, images[0]);
                        }
                    },
                    function(err, results) {
                        if (err) throw err;
                        img = results;
                        upgradeAsAvatar(img, this);
                    },
                    function(err) {
                        if (err) throw err;
                        // Save person first, to avoid a loop
                        person.image = img.image;
                        if (!person.pump_io) {
                            person.pump_io = {};
                        }
                        person.pump_io.fullImage = img.fullImage;
                        person.save(this);
                    },
                    function(err) {
                        if (err) throw err;
                        // Save image next, to avoid a loop
                        img.save(this);
                    },
                    function(err, saved) {
                        var iu, pu;
                        if (err) throw err;
                        // Send out an activity so everyone knows
                        iu = new Activity({actor: person,
                                           verb: "update",
                                           object: img});
                        iu.fire(this.parallel());
                        pu = new Activity({actor: person,
                                           verb: "update",
                                           object: person});
                        pu.fire(this.parallel());
                    },
                    callback
                );
            } else {
                callback(null);
            }
        },
        isRemoteURL = function(url) {
            return urlparse(url).hostname !== URLMaker.hostname;
        },
        isMismatchURL = function(person, url) {
            var fromPerson = ActivityObject.domainOf(person.id),
                fromUrl = urlparse(url).hostname;
            if (fromPerson !== fromUrl) {
                if (Upgrader.log) Upgrader.log.debug({url: url, person: person.id, fromPerson: fromPerson, fromUrl: fromUrl}, "URL hostname mismatch");
                return true;
            } else {
                return false;
            }
        },
        needsUpgradeUserFeeds = function(person) {
            return person._user &&
                (_.some(["replies", "likes", "shares"], function(feed) { return person[feed] && isRemoteURL(person[feed].url); }) ||
                 _.some(["followers", "following", "lists", "favorites"], function(feed) { return !_.has(person, feed) || isRemoteURL(person[feed].url); }) ||
                 _.some(["self", "activity-inbox", "activity-outbox"], function(rel) { return !_.has(person.links, rel) || isRemoteURL(person.links[rel].href); }));
        },
        needsUpgradeRemotePersonFeeds = function(person) {
            return !person._user &&
                   (ActivityObject.domainOf(person.id) !== URLMaker.hostname) &&
                   !person._upgrade_remote_person_feeds &&
                   (!person._upgrade_remote_person_feeds_failed || (new Date()).getTime() > person._upgrade_remote_person_feeds_failed + person._upgrade_remote_person_feeds_failed_wait) &&
                (_.some(["replies", "likes", "shares"], function(feed) { return person[feed] && isMismatchURL(person, person[feed].url); }) ||
                 _.some(["followers", "following", "lists", "favorites"], function(feed) { return !_.has(person, feed) || isMismatchURL(person, person[feed].url); }) ||
                 _.some(["self", "activity-inbox", "activity-outbox"], function(rel) { return !_.has(person.links, rel) || isMismatchURL(person, person.links[rel].href); }));
        },
        upgradePersonFeeds = function(person, callback) {

            if (needsUpgradeUserFeeds(person)) {
                upgradeUserFeeds(person, callback);
            } else if (needsUpgradeRemotePersonFeeds(person)) {
                upgradeRemotePersonFeeds(person, callback);
            } else {
                callback(null);
            }
        },
        upgradeRemotePersonFeeds = function(person, callback) {

            var discovered;

            if (Upgrader.log) Upgrader.log.debug({person: person}, "Upgrading remote person feeds");

            Step(
                function() {
                    ActivityObject.discover(person, this);
                },
                function(err, results) {
                    if (err) throw err;
                    discovered = results;
                    // These get added accidentally; remove them if they look wrong
                    _.each(["replies", "likes", "shares"], function(feed) {
                        if (Upgrader.log) Upgrader.log.debug({person: person, feed: feed, personFeed: person[feed]}, "Checking for bad value");
                        if (person[feed] && isMismatchURL(person, person[feed].url)) {
                            delete person[feed];
                            if (Upgrader.log) Upgrader.log.debug({person: person, feed: feed}, "Deleted bad value");
                        }
                    });
                    person._upgrade_remote_person_feeds = true;
                    // We have to use save() to delete stuff
                    person.save(this);
                },
                function(err) {
                    if (err) throw err;
                    person.update(discovered, this);
                },
                function(err) {
                    if (err) {
                        if (Upgrader.log) Upgrader.log.error({person: person, err: err}, "Error upgrading person");
                        person._upgrade_remote_person_feeds_failed = (new Date()).getTime();
                        person._upgrade_remote_person_feeds_failed_wait = nextInterval(person._upgrade_remote_person_feeds_failed_wait);
                        person.save(function(err) {
                            callback(null);
                        });
                    } else {
                        if (Upgrader.log) Upgrader.log.debug({person: person, stillNeedsUpgrade: needsUpgradeRemotePersonFeeds(person)}, "Finished upgrading remote person");
                        callback(null);
                    }
                }
            );
        },
        upgradeUserFeeds = function(person, callback) {

            if (Upgrader.log) Upgrader.log.debug({person: person}, "Upgrading user feeds");

            if (!_.has(person, "links")) {
                person.links = {};
            }

            person.links["activity-inbox"] = {
                href: URLMaker.makeURL("api/user/" + person.preferredUsername + "/inbox")
            };

            person.links["activity-outbox"] = {
                href: URLMaker.makeURL("api/user/" + person.preferredUsername + "/feed")
            };

            person.links.self = {
                href: URLMaker.makeURL("api/user/" + person.preferredUsername + "/profile")
            };

            Person.ensureFeeds(person, person.preferredUsername);

            _.each(["likes", "replies", "shares"], function(feed) {
                person[feed] = {
                    url: URLMaker.makeURL("api/person/" + person._uuid + "/" + feed)
                };
            });

            Step(
                function() {
                    person.save(this);
                },
                function(err) {
                    var pu;
                    if (err) throw err;
                    if (Upgrader.log) Upgrader.log.debug({person: person, stillNeedsUpgrade: needsUpgradeUserFeeds(person)}, "Finished upgrading user");
                    pu = new Activity({actor: person,
                                       verb: "update",
                                       object: person});
                    pu.fire(this);
                },
                callback
            );
        },
        upgradeAsImage = function(img, callback) {
            Step(
                function() {
                    autorotateImage(img, this);
                },
                function(err) {
                    if (err) throw err;
                    thumbnail.addImageMetadata(img, Image.uploadDir, this);
                },
                callback
            );
        },
        upgradeAsAvatar = function(img, callback) {
            Step(
                function() {
                    autorotateImage(img, this);
                },
                function(err) {
                    if (err) throw err;
                    thumbnail.addAvatarMetadata(img, Image.uploadDir, this);
                },
                callback
            );
        },
        nextInterval = function(lastInterval) {
            var intervals = [60000, // 1M
                             300000, // 5M
                             1800000, // .5H
                             7200000, // 2H
                             21600000, // 6H
                             86400000, // 1D
                             172800000, // 2D
                             691200000], // 8D
                i;

            if (!lastInterval) {
                return intervals[0];
            }

            for (i = 0; i < intervals.length - 1; i++) {
                if (lastInterval >= intervals[i] && lastInterval < intervals[i+1]) {
                    return intervals[i+1];
                }
            }

            return intervals[intervals.length - 1];
        },
        upgradePersonUser = function(person, callback) {

            if (person._user && !person._user_confirmed) {

                if (Upgrader.log) Upgrader.log.debug({person: person}, "Confirming _user flag");

                Step(
                    function() {
                        var User = require("./model/user").User;
                        User.fromPerson(person.id, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        if (user) {
                            if (Upgrader.log) Upgrader.log.debug({person: person}, "_user flag confirmed");
                            person._user_confirmed = true;
                            person.save(this);
                        } else {
                            if (Upgrader.log) Upgrader.log.debug({person: person}, "Bad _user flag; removing");
                            delete person._user;
                            person.save(this);
                        }
                    },
                    function(err, person) {
                        callback(err);
                    }
                );
            } else {
                callback(null);
            }
        };

    upg.upgradeImage = function(img, callback) {

        if (img._slug && _.isObject(img.image) && !_.has(img.image, "width")) {

            if (Upgrader.log) Upgrader.log.debug({image: img}, "Upgrading image");

            Step(
                function() {
                    fs.stat(path.join(Image.uploadDir, img._slug), this);
                },
                function(err, stat) {
                    if (err && err.code === "ENOENT") {
                        // If we don't have this file, just skip
                        callback(null);
                    } else if (err) {
                        throw err;
                    } else {
                        this(null);

                    }
                },
                function(err) {
                    if (err) throw err;
                    Person.search({"image.url": img.image.url}, this);
                },
                function(err, people) {
                    if (err) throw err;
                    if (!people || people.length === 0) {
                        upgradeAsImage(img, this);
                    } else {
                        upgradeAsAvatar(img, this);
                    }
                },
                function(err) {
                    if (err) throw err;
                    img.save(this);
                },
                function(err, saved) {
                    var act;
                    if (err) throw err;
                    // Send out an activity so everyone knows
                    act = new Activity({actor: img.author,
                                        verb: "update",
                                        object: img});
                    act.fire(this);
                },
                callback
            );
        } else {
            callback(null);
        }
    };


    upg.upgradePerson = function(person, callback) {

        Step(
            function() {
                upgradePersonUser(person, this);
            },
            function(err) {
                if (err) throw err;
                upgradePersonAvatar(person, this);
            },
            function(err) {
                if (err) throw err;
                upgradePersonFeeds(person, this);
            },
            callback
        );
    };


    upg.upgradeGroup = function(group, callback) {

        if ((group.members && group.documents) || !group.author) {
            callback(null);
            return;
        }

        if (Upgrader.log) Upgrader.log.debug({group: group}, "Upgrading group");

        Step(
            function() {
                group.isLocal(this);
            },
            function(err, isLocal) {
                if (err) throw err;
                if (!isLocal) {
                    callback(null);
                } else {
                    if (!group.members) {
                        group.members = {
                            url: URLMaker.makeURL("api/group/"+group._uuid+"/members")
                        };
                    }
                    if (!group.documents) {
                        group.documents = {
                            url: URLMaker.makeURL("api/group/"+group._uuid+"/documents")
                        };
                    }
                    group.save(this);
                }
            },
            function(err) {
                callback(err);
            }
        );
    };

    upg.upgradeActivity = function(act, callback) {

        var ActivityObject = require("./model/activityobject").ActivityObject,
            oprops = ["generator",
                      "provider",
                      "target",
                      "context",
                      "location",
                      "source"],
            isOK = function(act, prop) {
                return (!act[prop] || (_.isObject(act[prop]) && _.isString(act[prop].id)));
            },
            fixupProperty = function(act, prop, defaultType, callback) {

                var val;

                if (isOK(act, prop)) {
                    callback(null);
                    return;
                }

                val = act[prop];

                Step(
                    function() {
                        if (!val.objectType) {
                            val.objectType = defaultType;
                        }
                        ActivityObject.ensureObject(val, this);
                    },
                    function(err, ensured) {
                        if (err) throw err;
                        act[prop] = ensured;
                        this(null);
                    },
                    callback
                );
            };

        // If all the object properties look OK, continue

        if (_.every(oprops, function(prop) { return isOK(act, prop); })) {
            callback(null);
            return;
        }

        if (Upgrader.log) Upgrader.log.debug({activity: act}, "Upgrading activity");

        // Otherwise, fix them up

        Step(
            function() {
                fixupProperty(act, "location", ActivityObject.PLACE, this.parallel());
                fixupProperty(act, "provider", ActivityObject.SERVICE, this.parallel());
                fixupProperty(act, "generator", ActivityObject.APPLICATION, this.parallel());
                fixupProperty(act, "target", ActivityObject.COLLECTION, this.parallel());
                fixupProperty(act, "source", ActivityObject.COLLECTION, this.parallel());
                fixupProperty(act, "context", ActivityObject.ISSUE, this.parallel());
            },
            function(err) {
                if (err) throw err;
                act.save(this);
            },
            function(err) {
                callback(err);
            }
        );
    };

})();

module.exports = Upgrader;
