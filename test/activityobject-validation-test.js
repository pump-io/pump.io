// activityobject-test.js
//
// Test that activityobjects are validated
//
// Copyright 2012, E14N https://e14n.com/
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
    Step = require("step"),
    _ = require("underscore"),
    fs = require("fs"),
    path = require("path"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    schema = require("../lib/schema").schema,
    URLMaker = require("../lib/urlmaker").URLMaker;

var suite = vows.describe("activityobject class interface");

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

suite.addBatch({
    "When we require the activityobject module": {
        topic: function() { 
            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            db.connect({}, function(err) {
                var cls;

                DatabankObject.bank = db;
                
                cls = require("../lib/model/activityobject").ActivityObject || null;

                cb(null, cls);
            });
        },
        "we get the constructor": function(cls) {
            assert.isFunction(cls);
        },
        "and we try to ensureObject with a non-string ID": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: [1, 2, 3],
                        objectType: "note"
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with no ID": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        objectType: "note",
                        content: "gar gar gar"
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            },
            "it works": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with a non-string objectType": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: "urn:uuid:015a8bd6-b706-11e2-b87b-c8f73398600c",
                        objectType: {
                            left: 1,
                            right: 2
                        }
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with a non-string objectType": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: "urn:uuid:c6df5d5c-b713-11e2-9369-2c8158efb9e9",
                        objectType: {
                            left: 1,
                            right: 2
                        }
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with a non-array attachments property": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: "urn:uuid:da0cea20-b713-11e2-8998-2c8158efb9e9",
                        objectType: "note",
                        attachments: 4
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with a non-object in attachments property": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: "urn:uuid:e4168198-b713-11e2-add9-2c8158efb9e9",
                        objectType: "note",
                        attachments: [1, 2, 3, 4]
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we try to ensureObject with an invalid object in attachments property": {
            topic: function(ActivityObject) {
                var callback = this.callback,
                    props = {
                        id: "urn:uuid:9f0cf252-b714-11e2-8bdb-2c8158efb9e9",
                        objectType: "note",
                        attachments: [{
                            left: 1,
                            right: 2
                        }]
                    };

                ActivityObject.ensureObject(props, function(err, obj) {
                    if (err && err instanceof TypeError) {
                        callback(null);
                    } else if (err) {
                        callback(err);
                    } else {
                        callback(new Error("Unexpected success"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        }
    }
});

suite["export"](module);
