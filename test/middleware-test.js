// middleware-test.js
//
// Test the middleware module
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
    fs = require("fs"),
    path = require("path"),
    httpMocks = require("node-mocks-http"),
    schema = require("../lib/schema"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    User = require("../lib/model/user").User,
    methodContext = require("./lib/methods").methodContext,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var robby, maya;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

vows.describe("middleware module interface").addBatch({

    "When we load the module": {

        topic: function() { 

            var cb = this.callback;
            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            Step(
                function() {
                    db.connect({}, this);
                },
                function(err) {
                    if (err) throw err;
                    DatabankObject.bank = db;
                    User.create({nickname: "robby", password: "smash*a*kangaroo"}, this.parallel());
                    User.create({nickname: "maya", password: "mango|pickle"}, this.parallel());
                },
                function(err, user1, user2) {
                    var mw;
                    if (err) {
                        cb(err, null);
                    } else {
                        robby = user1;
                        maya = user2;
                        mw = require("../lib/middleware");
                        cb(null, mw);
                    }
                }
            );
        },
        "there is one": function(err, mw) {
            assert.ifError(err);
            assert.isObject(mw);
        },
        "and we check its methods": methodContext(["reqUser",
                                                   "sameUser"]),
        "and we use reqUser with no nickname param": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/",
                                                   params: {}
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.reqUser(req, res, function(err) {
                    if (err && err.code && err.code === 404) {
                        cb(null);
                    } else if (err) {
                        cb(err);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use reqUser with an invalid nickname param": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/notanickname",
                                                   params: {nickname: "notanickname"}
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.reqUser(req, res, function(err) {
                    if (err && err.code && err.code === 404) {
                        cb(null);
                    } else if (err) {
                        cb(err);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use reqUser with a nickname param only off by case": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/Robby",
                                                   params: {nickname: "Robby"}
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.reqUser(req, res, function(err) {
                    if (err && err.code && err.code === 404) {
                        cb(null);
                    } else if (err) {
                        cb(err);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use reqUser with a valid nickname param": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/robby",
                                                   params: {nickname: "robby"}
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.reqUser(req, res, function(err) {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null);
                    }
                });
            },
            "it works": function(err) {
                assert.ifError(err);
            }
        },
        "and we use sameUser() with remoteUser but no user": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/",
                                                   params: {},
                                                   remoteUser: maya
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.sameUser(req, res, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use sameUser() with user but no remoteUser": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/robby",
                                                   params: {nickname: "robby"},
                                                   user: robby
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.sameUser(req, res, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use sameUser() with user not matching remoteUser": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/robby",
                                                   params: {nickname: "robby"},
                                                   user: robby,
                                                   remoteUser: maya
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.sameUser(req, res, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        },
        "and we use sameUser() with user matching remoteUser": {
            topic: function(mw) {
                var cb = this.callback,
                    req = httpMocks.createRequest({method: "get",
                                                   url: "/api/user/robby",
                                                   params: {nickname: "robby"},
                                                   user: robby,
                                                   remoteUser: robby
                                                  }),
                    res = httpMocks.createResponse();
                
                mw.sameUser(req, res, function(err) {
                    if (err) {
                        cb(null);
                    } else {
                        cb(new Error("Unexpected success!"));
                    }
                });
            },
            "it fails correctly": function(err) {
                assert.ifError(err);
            }
        }
    }
})["export"](module);

