// urlmaker-test.js
//
// Test the urlmaker module
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

var _ = require("underscore"),
    assert = require("assert"),
    vows = require("vows"),
    parseURL = require("url").parse;

var suite = vows.describe("urlmaker module interface");

suite.addBatch({
    "When we require the urlmaker module": {
        topic: function() {
            return require("../lib/urlmaker");
        },
        "it exists": function(urlmaker) {
            assert.isObject(urlmaker);
        },
        "and we get the URLMaker singleton": {
            topic: function(urlmaker) {
                return urlmaker.URLMaker;
            },
            "it exists": function(URLMaker) {
                assert.isObject(URLMaker);
            },
            "it has a hostname property": function(URLMaker) {
                assert.include(URLMaker, "hostname");
            },
            "it has a port property": function(URLMaker) {
                assert.include(URLMaker, "port");
            },
            "it has a makeURL method": function(URLMaker) {
                assert.include(URLMaker, "makeURL");
                assert.isFunction(URLMaker.makeURL);
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we make an URL": {
            topic: function(URLMaker) {
                return URLMaker.makeURL("login");
            },
            "it exists": function(url) {
                assert.isString(url);
            },
            "its parts are correct": function(url) {
                var parts = parseURL(url);
                assert.equal(parts.hostname, "example.com");
                assert.equal(parts.port, 3001);
                assert.equal(parts.host, "example.com:3001");
                assert.equal(parts.path, "/login");
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker with the default port": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 80;
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we set its properties to default port": {
            topic: function(URLMaker) {
                return URLMaker.makeURL("login");
            },
            "it exists": function(url) {
                assert.isString(url);
            },
            "its parts are correct": function(url) {
                var parts = parseURL(url);
                assert.equal(parts.hostname, "example.com");
                // undefined in 0.8.x, null in 0.10.x
                assert.isTrue(_.isNull(parts.port) || _.isUndefined(parts.port));
                assert.equal(parts.host, "example.com"); // NOT example.com:80
                assert.equal(parts.path, "/login");
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 2342;
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we include parameters": {
            topic: function(URLMaker) {
                return URLMaker.makeURL("/users", {offset: 10, count: 30});
            },
            "it exists": function(url) {
                assert.isString(url);
            },
            "its parts are correct": function(url) {
                // parse query params too
                var parts = parseURL(url, true);
                assert.equal(parts.hostname, "example.com");
                assert.equal(parts.port, 2342);
                assert.equal(parts.host, "example.com:2342");
                assert.equal(parts.pathname, "/users");
                assert.isObject(parts.query);
                assert.include(parts.query, "offset");
                assert.equal(parts.query.offset, 10);
                assert.include(parts.query, "count");
                assert.equal(parts.query.count, 30);
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker with a prefix path": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
	    URLMaker.path     = "pumpio";
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we make an URL": {
            topic: function(URLMaker) {
                return URLMaker.makeURL("login");
            },
            "it exists": function(url) {
                assert.isString(url);
            },
            "its parts are correct": function(url) {
                var parts = parseURL(url);
                assert.equal(parts.hostname, "example.com");
                assert.equal(parts.port, 3001);
                assert.equal(parts.host, "example.com:3001");
                assert.equal(parts.path, "/pumpio/login");
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we make URLs with and without initial slash": {
            topic: function(URLMaker) {
                return {without: URLMaker.makeURL("login"), with: URLMaker.makeURL("/login")};
            },
            "they are equal": function(urls) {
                assert.equal(urls['with'], urls.without);
            }
        }
    }
});

suite.addBatch({
    "When we set up the URLMaker with a prefix path": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
	    URLMaker.path     = "pumpio";
            return URLMaker;
        },
        "it works": function(URLMaker) {
            assert.isObject(URLMaker);
        },
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        },
        "and we make URLs with and without initial slash": {
            topic: function(URLMaker) {
                return {without: URLMaker.makeURL("login"), with: URLMaker.makeURL("/login")};
            },
            "they are equal": function(urls) {
                assert.equal(urls['with'], urls.without);
            }
        }
    }
});

suite.addBatch({
    "When we set up URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
	    return URLMaker;
	},
	"it works": function(URLMaker) {
	    assert.isObject(URLMaker);
	},
	"and we have a slash before the path": {
	    topic: function(URLMaker) {
		URLMaker.path     = "/pumpio";
		return URLMaker.makeURL("/login");
	    },
            "it works": function(url) {
		assert.equal(parseURL(url).path, "/pumpio/login");
	    }
	},
	"and we have a slash after the path": {
	    topic: function(URLMaker) {
		URLMaker.path     = "pumpio/";
		return URLMaker.makeURL("/login");
	    },
            "it works": function(url) {
		assert.equal(parseURL(url).path, "/pumpio/login");
	    }
	},
	"and we have a slash on both sides of the path": {
	    topic: function(URLMaker) {
		URLMaker.path = "/pumpio/";
		return URLMaker.makeURL("/login");
	    },
            "it works": function(url) {
		assert.equal(parseURL(url).path, "/pumpio/login");
	    }
	},
	"and we have no slashes in the path": {
	    topic: function(URLMaker) {
		URLMaker.path = "pumpio";
		return URLMaker.makeURL("/login");
	    },
            "it works": function(url) {
		assert.equal(parseURL(url).path, "/pumpio/login");
	    }
	},
        teardown: function(URLMaker) {
            URLMaker.hostname = null;
            URLMaker.port = null;
            URLMaker.path = null;
        }
    }
});

suite.addBatch({
    "When we set up URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
	    return URLMaker;
	},
	"it works": function(URLMaker) {
	    assert.isObject(URLMaker);
	},
	"and we make a default host": {
	    topic: function(URLMaker) {
		return URLMaker.makeHost();
	    },
            "it works": function(host) {
		assert.equal(host, "example.com:3001");
	    }
	},
	"and we make a host with the default port": {
	    topic: function(URLMaker) {
		return URLMaker.makeHost("example.net", 80);
	    },
            "it works": function(host) {
		assert.equal(host, "example.net");
	    }
	},
	"and we make a host with the default SSL port": {
	    topic: function(URLMaker) {
		return URLMaker.makeHost("example.net", 443);
	    },
            "it works": function(host) {
		assert.equal(host, "example.net");
	    }
	},
	"and we make a host with a non-default port": {
	    topic: function(URLMaker) {
		return URLMaker.makeHost("example.net", 8080);
	    },
            "it works": function(host) {
		assert.equal(host, "example.net:8080");
	    }
	}
    }
});

suite.addBatch({
    "When we set up URLMaker": {
        topic: function() {
            var URLMaker = require("../lib/urlmaker").URLMaker;
            URLMaker.hostname = "example.com";
            URLMaker.port     = 3001;
	    return URLMaker;
	},
	"it works": function(URLMaker) {
	    assert.isObject(URLMaker);
	},
	"and we make a path": {
	    topic: function(URLMaker) {
		URLMaker.path = null;
		return URLMaker.makePath("login");
	    },
            "it works": function(path) {
		assert.equal(path, "/login");
	    }
	},
	"and we make a path with a prefix": {
	    topic: function(URLMaker) {
		URLMaker.path = "pumpio";
		return URLMaker.makePath("login");
	    },
            "it works": function(path) {
		assert.equal(path, "/pumpio/login");
	    }
	}
    }
});

suite["export"](module);
