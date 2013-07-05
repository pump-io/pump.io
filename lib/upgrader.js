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


var fs = require("fs"),
    os = require("os"),
    Step = require("step"),
    path = require("path"),
    _ = require("underscore"),
    thumbnail = require("./thumbnail"),
    URLMaker = require("./urlmaker").URLMaker,
    Activity = require("./model/activity").Activity,
    Image = require("./model/image").Image,
    Person = require("./model/person").Person,
    Stream = require("./model/stream").Stream,
    mover = require("./mover");

// Upgrade image data.

var upgradeImage = function(img, callback) {

    if (img._slug && _.isObject(img.image) && !_.has(img.image, "width")) {

        Step(
            function() {
                fs.stat(path.join(Image.uploadDir, img._slug), this);
            },
            function(err, stat) {
                if (err && err.code == 'ENOENT') {
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

var autorotateImage = function(img, callback) {

    var fname = path.join(Image.uploadDir, img._slug),
        tmpdir = (_.isFunction(os.tmpdir)) ? os.tmpdir() :
            (_.isFunction(os.tmpDir)) ? os.tmpDir() : "/tmp",
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
};

var upgradePerson = function(person, callback) {

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

        slug = urlToSlug(person, person.image.url);

        Step(
            function() {
                fs.stat(path.join(Image.uploadDir, slug), this);
            },
            function(err, stat) {
                if (err && err.code == 'ENOENT') {
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
};

var upgradeGroup = function(group, callback) {

    if (group.members && group.documents) {
        callback(null);
        return;
    }

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

var upgradeActivity = function(act, callback) {

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

var upgradeAsImage = function(img, callback) {
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
};

var upgradeAsAvatar = function(img, callback) {
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
};

module.exports = {
    upgradeImage: upgradeImage,
    upgradePerson: upgradePerson,
    upgradeGroup: upgradeGroup,
    upgradeActivity: upgradeActivity
};
