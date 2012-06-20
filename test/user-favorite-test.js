// user-favorite-test.js
//
// Test the user favoriting mechanism
//
// Copyright 2012, StatusNet Inc.
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var a2m = function(arr, prop) {
    var i, map = {}, key, value;
    for (i = 0; i < arr.length; i++) {
        value = arr[i];
        key   = value[prop];
        map[key] = value;
    }
    return map;
};

var suite = vows.describe("user favorite interface");

suite.addBatch({
    "When we get the User class": {
        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            var params = {schema: schema};

            var db = Databank.get("memory", params);

            db.connect({}, function(err) {
                var User;

                DatabankObject.bank = db;
                
                User = require("../lib/model/user").User || null;

                cb(null, User);
            });
        },
        "it exists": function(User) {
            assert.isFunction(User);
        },
        "and we create a user": {
            topic: function(User) {
                var props = {
                    nickname: "bert",
                    password: "pidgeons"
                };
                User.create(props, this.callback);
            },
            teardown: function(user) {
                if (user && user.del) {
                    user.del(function(err) {});
                }
            },
            "it works": function(user) {
                assert.isObject(user);
            },
            "and it favorites a known object": {
                topic: function(user) {
                    var cb = this.callback,
                        Image = require("../lib/model/image").Image,
                        obj;
                    
                    Step(
                        function() {
                            Image.create({displayName: "Courage Wolf",
                                          url: "http://i0.kym-cdn.com/photos/images/newsfeed/000/159/986/Couragewolf1.jpg"}, this);
                        },
                        function(err, image) {
                            if (err) throw err;
                            obj = image;
                            user.favorite(image.id, image.objectType, this);
                        },
                        function(err) {
                            if (err) {
                                cb(err, null);
                            } else {
                                cb(err, obj);
                            }
                        }
                    );
                },
                "it works": function(err, image) {
                    assert.ifError(err);
                },
                "and it unfavorites that object": {
                    topic: function(image, user) {
                        user.unfavorite(image.id, image.objectType, this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and it favorites an unknown object": {
                topic: function(user) {
                    var cb = this.callback;
                    
                    user.favorite("urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", this.callback);
                },
                "it works": function(err) {
                    assert.ifError(err);
                },
                "and it unfavorites that object": {
                    topic: function(user) {
                        user.unfavorite("urn:uuid:5be685ef-f50b-458b-bfd3-3ca004eb0e89", "image", this.callback);
                    },
                    "it works": function(err) {
                        assert.ifError(err);
                    }
                }
            },
            "and it double-favorites an object": {
                topic: function(user) {
                    var cb = this.callback,
                        Video = require("../lib/model/video").Video,
                        obj;
                    
                    Step(
                        function() {
                            Video.create({displayName: "Winning",
                                          url: "http://www.youtube.com/watch?v=9QS0q3mGPGg"}, this);
                        },
                        function(err, video) {
                            if (err) throw err;
                            obj = video;
                            user.favorite(obj.id, obj.objectType, this);
                        },
                        function(err) {
                            if (err) throw err;
                            user.favorite(obj.id, obj.objectType, this);
                        },
                        function(err) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            },
            "and it unfavorites an object it never favorited": {
                topic: function(user) {
                    var cb = this.callback,
                        Audio = require("../lib/model/audio").Audio,
                        obj;
                    
                    Step(
                        function() {
                            Audio.create({displayName: "Spock",
                                          url: "http://musicbrainz.org/recording/c1038685-49f3-45d7-bb26-1372f1052126"}, this);
                        },
                        function(err, video) {
                            if (err) throw err;
                            obj = video;
                            user.unfavorite(obj.id, obj.objectType, this);
                        },
                        function(err) {
                            if (err) {
                                cb(null);
                            } else {
                                cb(new Error("Unexpected success"));
                            }
                        }
                    );
                },
                "it fails correctly": function(err) {
                    assert.ifError(err);
                }
            }
        },
        "and we get the list of favorites for a new user": {
            topic: function(User) {
                var cb = this.callback,
                    props = {
                        nickname: "carroway",
                        password: "feldspar"
                    };
                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        user.getFavorites(0, 20, this);
                    },
                    function(err, faves) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, faves);
                        }
                    }
                );
            },
            "it works": function(err, faves) {
                assert.ifError(err);
            },
            "it looks right": function(err, faves) {
                assert.ifError(err);
                assert.isArray(faves);
                assert.lengthOf(faves, 0);
            }
        },
        "and we get the count of favorites for a new user": {
            topic: function(User) {
                var cb = this.callback,
                    props = {
                        nickname: "cookie",
                        password: "cookie"
                    };
                Step(
                    function() {
                        User.create(props, this);
                    },
                    function(err, user) {
                        if (err) throw err;
                        user.favoritesCount(this);
                    },
                    function(err, count) {
                        if (err) {
                            cb(err, null);
                        } else {
                            cb(null, count);
                        }
                    }
                );
            },
            "it works": function(err, count) {
                assert.ifError(err);
            },
            "it looks right": function(err, count) {
                assert.ifError(err);
                assert.equal(count, 0);
            }
        },
        "and a new user favors an object": {
            topic: function(User) {
                var cb = this.callback,
                    user,
                    image;

                Step(
                    function() {
                        User.create({nickname: "ernie", password: "rubberduckie"}, this);
                    },
                    function(err, results) {
                        var Image = require("../lib/model/image").Image;
                        if (err) throw err;
                        user = results;
                        Image.create({displayName: "Evan"s avatar",
                                      url: "https://c778552.ssl.cf2.rackcdn.com/evan/1-96-20120103014637.jpeg"},
                                     this);
                    },
                    function(err, results) {
                        if (err) throw err;
                        image = results;
                        user.favorite(image.id, image.objectType, this);
                    },
                    function(err) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, user, image);
                        }
                    }
                );
            },
            "it works": function(err, user, image) {
                assert.ifError(err);
                assert.isObject(user);
                assert.isObject(image);
            },
            "and we check the user favorites list": {
                topic: function(user, image) {
                    var cb = this.callback;
                    user.getFavorites(0, 20, function(err, faves) {
                        cb(err, faves, image);
                    });
                },
                "it works": function(err, faves, image) {
                    assert.ifError(err);
                },
                "it is the right size": function(err, faves, image) {
                    assert.ifError(err);
                    assert.lengthOf(faves, 1);
                },
                "it has the right data": function(err, faves, image) {
                    assert.ifError(err);
                    assert.equal(faves[0].id, image.id);
                }
            },
            "and we check the user favorites count": {
                topic: function(user, image) {
                    var cb = this.callback;
                    user.favoritesCount(cb);
                },
                "it works": function(err, count) {
                    assert.ifError(err);
                },
                "it is correct": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 1);
                }
            },
            "and we check the image favoriters list": {
                topic: function(user, image) {
                    var cb = this.callback;
                    image.getFavoriters(0, 20, function(err, favers) {
                        cb(err, favers, user);
                    });
                },
                "it works": function(err, favers, user) {
                    assert.ifError(err);
                },
                "it is the right size": function(err, favers, user) {
                    assert.ifError(err);
                    assert.lengthOf(favers, 1);
                },
                "it has the right data": function(err, favers, user) {
                    assert.ifError(err);
                    assert.equal(favers[0].id, user.profile.id);
                }
            },
            "and we check the image favoriters count": {
                topic: function(user, image) {
                    var cb = this.callback;
                    image.favoritersCount(cb);
                },
                "it works": function(err, count) {
                    assert.ifError(err);
                },
                "it is correct": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 1);
                }
            }
        },
        "and a new user favors a lot of objects": {
            topic: function(User) {

                var cb = this.callback,
                    user,
                    images;

                Step(
                    function() {
                        User.create({nickname: "count", password: "123456"}, this);
                    },
                    function(err, results) {
                        var Image = require("../lib/model/image").Image,
                            i = 0,
                            group = this.group();
                        if (err) throw err;
                        user = results;
                        for (i = 0; i < 5000; i++) {
                            Image.create({displayName: "Image for #" + i,
                                          increment: i,
                                          url: "http://"+i+".jpg.to"},
                                         group());
                        }
                    },
                    function(err, results) {
                        var i = 0,
                            group = this.group();
                        if (err) throw err;
                        images = results;
                        for (i = 0; i < images.length; i++) {
                            user.favorite(images[i].id, "image", group());
                        }
                    },
                    function(err) {
                        if (err) {
                            cb(err, null, null);
                        } else {
                            cb(null, user, images);
                        }
                    }
                );
            },
            "it works": function(err, user, images) {
                assert.ifError(err);
                assert.isObject(user);
                assert.isArray(images);
                assert.lengthOf(images, 5000);
                for (var i = 0; i < images.length; i++) {
                    assert.isObject(images[i]);
                }
            },
            "and we check the user favorites list": {
                topic: function(user, images) {
                    var cb = this.callback;
                    user.getFavorites(0, 5001, function(err, faves) {
                        cb(err, faves, images);
                    });
                },
                "it works": function(err, faves, images) {
                    assert.ifError(err);
                },
                "it is the right size": function(err, faves, images) {
                    assert.ifError(err);
                    assert.lengthOf(faves, 5000);
                },
                "it has the right data": function(err, faves, images) {
                    var fm, im, id;
                    assert.ifError(err);
                    fm = a2m(faves, "id");
                    im = a2m(images, "id");
                    for (id in im) {
                        assert.include(fm, id);
                    }
                    for (id in fm) {
                        assert.include(im, id);
                    }
                }
            },
            "and we check the user favorites count": {
                topic: function(user, image) {
                    var cb = this.callback;
                    user.favoritesCount(cb);
                },
                "it works": function(err, count) {
                    assert.ifError(err);
                },
                "it is correct": function(err, count) {
                    assert.ifError(err);
                    assert.equal(count, 5000);
                }
            },
            "and we check the images favoriters list": {
                topic: function(user, images) {
                    var cb = this.callback;
                    Step(
                        function() {
                            var i, group = this.group();
                            for (i = 0; i < images.length; i++) {
                                images[i].getFavoriters(0, 20, group());
                            }
                        },
                        function(err, faverses) {
                            if (err) {
                                cb(err, null, null);
                            } else {
                                cb(null, faverses, user);
                            }
                        }
                    );
                },
                "it works": function(err, faverses, user) {
                    assert.ifError(err);
                },
                "it is the right size": function(err, faverses, user) {
                    assert.ifError(err);
                    assert.lengthOf(faverses, 5000);
                    for (var i = 0; i < faverses.length; i++) {
                        assert.lengthOf(faverses[i], 1);
                    }
                },
                "it has the right data": function(err, faverses, user) {
                    assert.ifError(err);
                    for (var i = 0; i < faverses.length; i++) {
                        assert.equal(faverses[i][0].id, user.profile.id);
                    }
                }
            }
        }
    }
});

suite["export"](module);
