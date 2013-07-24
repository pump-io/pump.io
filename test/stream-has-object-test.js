// stream-test.js
//
// Test the stream module
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
    databank = require("databank"),
    Step = require("step"),
    fs = require("fs"),
    path = require("path"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    schema = require("../lib/schema").schema,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var tc = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json")));

var suite = vows.describe("stream has object");

suite.addBatch({
    "When we create a stream and add some objects": {
        topic: function() {
            var cb = this.callback;

            // Need this to make IDs

            URLMaker.hostname = "example.net";

            // Dummy databank

            tc.params.schema = schema;

            var db = Databank.get(tc.driver, tc.params);

            var stream = null;

            Step(
                function() {
                    db.connect({}, this);
                },
                function(err) {
                    if (err) throw err;

                    DatabankObject.bank = db;

                    var Stream = require("../lib/model/stream").Stream;

                    Stream.create({name: "has-object-test"}, this);
                },
                function(err, results) {
                    var group = this.group();
                    if (err) throw err;
                    stream = results;
		    _.times(100, function(i) {
			stream.deliverObject({id: "http://social.example/image/"+i, objectType: "image"}, group());
		    });
                },
		function(err) {
		    if (err) {
			cb(err, null);
		    } else {
			cb(null, stream);
		    }
		}
	    );
	},
	"it works": function(err, stream) {
	    assert.ifError(err);
	    assert.isObject(stream);
	},
	"it has a hasObject() method": function(err, stream) {
	    assert.ifError(err);
	    assert.isFunction(stream.hasObject);
	},
	"and we check if it has an object we added": {
	    topic: function(stream) {
		stream.hasObject({id: "http://social.example/image/69", objectType: "image"}, this.callback);
	    },
	    "it does": function(err, hasObject) {
		assert.ifError(err);
		assert.isTrue(hasObject);
	    }
	},
	"and we check if it has an object we didn't add": {
	    topic: function(stream) {
		stream.hasObject({id: "http://nonexistent.example/audio/23", objectType: "image"}, this.callback);
	    },
	    "it does not": function(err, hasObject) {
		assert.ifError(err);
		assert.isFalse(hasObject);
	    }
	}
    }
});

suite["export"](module);
