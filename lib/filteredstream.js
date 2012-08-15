// filteredstream.js
//
// A (potentially very long) stream of object IDs, filtered asynchronously
//
// Copyright 2012 StatusNet Inc.
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

var Step = require("step"),
    Stream = require("./model/stream").Stream;

var FilteredStream = function(str, filter) {
    this.str    = str;
    this.filter = filter;
};

FilteredStream.prototype.getIDs = function(start, end, callback) {

    var fs = this,
        str = this.str,
        f = this.filter,
        chunk,
        ids;

    Step(
        function() {
            str.getIDs(0, end, this);
        },
        function(err, result) {
            var i, group = this.group();
            if (err) throw err;
            chunk = result;
            for (i = 0; i < chunk.length; i++) {
                f(chunk[i], group());
            }
        },
        function(err, flags) {
            var i;
            if (err) throw err;
            for (i = 0; i < chunk.length; i++) {
                if (flags[i]) {
                    ids.push(chunk[i]);
                }
            }
            // If we got all we wanted, or we tapped out upstream...
            if (ids.length === end || chunk.length < end) {
                callback(null, ids);
            } else {
                // Get some more
                // XXX: last ID in chunk might not pass filter
                fs.getIDsGreaterThan(chunk[chunk.length-1], end - ids.length, this);
            }
        },
        function(err, rest) {
            var result;
            if (err) {
                callback(err, null);
            } else {
                callback(null, ids.concat(rest).slice(start, end));
            }
        }
    );
};

FilteredStream.prototype.getIDsGreaterThan = function(id, count, callback) {

    var fs = this,
        str = this.str,
        f = this.filter,
        chunk,
        ids;

    Step(
        function() {
            str.getIDsGreaterThan(id, count, this);
        },
        function(err, result) {
            var i, group = this.group();
            if (err) throw err;
            chunk = result;
            for (i = 0; i < chunk.length; i++) {
                f(chunk[i], group());
            }
        },
        function(err, flags) {
            var i;
            if (err) throw err;
            for (i = 0; i < chunk.length; i++) {
                if (flags[i]) {
                    ids.push(chunk[i]);
                }
            }
            // If we got all we wanted, or we tapped out upstream...
            if (ids.length === count || chunk.length < count) {
                callback(null, ids);
            } else {
                // Get some more
                // XXX: last ID in chunk might not pass filter
                fs.getIDsGreaterThan(chunk[chunk.length-1], count - ids.length, this);
            }
        },
        function(err, rest) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, ids.concat(rest));
            }
        }
    );
};

FilteredStream.prototype.getIDsLessThan = function(id, count, callback) {

    var fs = this,
        str = this.str,
        f = this.filter,
        chunk,
        ids;

    Step(
        function() {
            str.getIDsLessThan(id, count, this);
        },
        function(err, result) {
            var i, group = this.group();
            if (err) throw err;
            chunk = result;
            for (i = 0; i < chunk.length; i++) {
                f(chunk[i], group());
            }
        },
        function(err, flags) {
            var i;
            if (err) throw err;
            for (i = 0; i < chunk.length; i++) {
                if (flags[i]) {
                    ids.push(chunk[i]);
                }
            }
            // If we got all we wanted, or we tapped out upstream...
            if (ids.length === count || chunk.length < count) {
                callback(null, ids);
            } else {
                // Get some more
                // XXX: last ID in chunk might not pass filter
                fs.getIDsLessThan(chunk[0], count - ids.length, this);
            }
        },
        function(err, rest) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, rest.concat(ids));
            }
        }
    );
};

exports.FilteredStream = FilteredStream;
