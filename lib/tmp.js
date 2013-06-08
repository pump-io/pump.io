// lib/tmp.js
//
// Utilities for temporary files
//
// Copyright 2012,2013 E14N https://e14n.com/
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

var os = require("os"),
    Step = require("step"),
    path = require("path"),
    fs = require("fs"),
    randomString = require("../lib/randomstring").randomString,
    _ = require("underscore");

var dir = function(callback) {
    var tmpdir = (_.isFunction(os.tmpdir)) ? os.tmpdir() :
            (_.isFunction(os.tmpDir)) ? os.tmpDir() : null;

    if (tmpdir) {
        callback(null, tmpdir);
    } else {
        // XXX: check for C:\\Temp, C:\\Windows\Temp, all that jazz
        callback(null, "/tmp");
    }
};

var name = function(ext, callback) {

    var td;

    if (!callback) {
        callback = ext;
        ext = ".bin";
    }

    Step(
        function() {
            dir(this);
        },
        function(err, results) {
            if (err) throw err;
            td = results;
            randomString(8, this);
        },
        function(err, str) {
            if (err) throw err;
            this(null, path.join(td, str + ext));
        },
        callback
    );
};

module.exports = {
    dir: dir,
    name: name
};
