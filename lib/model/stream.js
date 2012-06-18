// stream.js
//
// A (potentially very long) stream of object IDs
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

var databank = require('databank'),
    _ = require('underscore'),
    DatabankObject = databank.DatabankObject,
    Step = require('step'),
    IDMaker = require('../idmaker').IDMaker,
    NoSuchThingError = databank.NoSuchThingError,
    DatabankError = databank.DatabankError;

var Stream = DatabankObject.subClass('stream');

exports.Stream = Stream;

Stream.SOFT_LIMIT = 1000;
Stream.HARD_LIMIT = 2000;

Stream.beforeCreate = function(props, callback) {

    var bank = Stream.bank(),
        stream = null;

    if (!props.name) {
        callback(new Error('Gotta have a name'), null);
    }

    Step(
        function() {
            bank.create('streamcount', props.name, 0, this.parallel());
            bank.create('streamsegments', props.name, [], this.parallel());
        },
        function(err, count, segments) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, props);
            }
        }
    );
};

Stream.prototype.afterCreate = function(callback) {
    this.newSegment(callback);
};

// put something in the stream

var randBetween = function(min, max) {
    var diff = max - min + 1; 
    return Math.floor((Math.random() * diff) + min);
};

Stream.prototype.deliver = function(id, callback) {

    var stream = this,
        bank = Stream.bank(),
        current = null;

    Step(
        function() {
            bank.item('streamsegments', stream.name, 0, this);
        },
        function(err, id) {
            if (err) throw err;
            current = id;
            bank.read('streamsegmentcount', current, this);
        },
        function(err, cnt) {

            if (err) throw err;

            // Once we hit the soft limit, we start thinking about 
            // a new segment. To avoid conflicts, a bit, we do it at a
            // random point between soft and hard limit. If we actually
            // hit the hard limit, force it.

            if (cnt > Stream.SOFT_LIMIT &&
                (cnt > Stream.HARD_LIMIT ||
                 randBetween(0, Stream.HARD_LIMIT - Stream.SOFT_LIMIT) === 0)) {
                stream.newSegment(this);
            } else {
                this(null, current);
            }
        },
        function(err, segmentId) {
            if (err) throw err;
            bank.prepend('streamsegment', segmentId, id, this.parallel());
            bank.incr('streamsegmentcount', segmentId, this.parallel());
            bank.incr('streamcount', stream.name, this.parallel());
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

Stream.prototype.remove = function(id, callback) {

    var stream = this,
        bank = Stream.bank(),
        current = null,
        segments,
        segmentId;

    Step(
        function() {
            bank.read('streamsegments', stream.name, this);
        },
        function(err, segments) {
            var i, cb = this, findFrom = function(j) {
                if (j >= segments.length) {
                    cb(new Error("Not found"), null);
                    return;
                }
                bank.indexOf('streamsegment', segments[j], id, function(err, idx) {
                    if (err) {
                        cb(err, null);
                    } else if (idx === -1) {
                        findFrom(j+1);
                    } else {
                        cb(err, segments[j]);
                    }
                });
            };
            if (err) throw err;
            findFrom(0);
        },
        function(err, found) {
            if (err) throw err;
            segmentId = found;
            bank.remove('streamsegment', segmentId, id, this);
        },
        function(err) {
            if (err) throw err;
            bank.decr('streamsegmentcount', segmentId, this.parallel());
            bank.decr('streamcount', stream.name, this.parallel());
        },
        function(err) {
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        }
    );
};

Stream.prototype.newSegment = function(callback) {

    var bank = Stream.bank(),
        stream = this,
        id = stream.name + ':stream:' + IDMaker.makeID();

    Step(
        function() {
            bank.create('streamsegmentcount', id, 0, this.parallel());
            bank.create('streamsegment', id, [], this.parallel());
        },
        function(err, cnt, segment) {
            if (err) throw err;
            bank.prepend('streamsegments', stream.name, id, this);
        },
        function(err, segments) {
            if (err) {
                callback(err, null);
            } else {
                callback(err, id);
            }
        }
    );
};

Stream.prototype.getIDs = function(start, end, callback) {

    var bank = Stream.bank(),
        stream = this,
        getMore = function getMore(segments, start, end, callback) {

            var tip;

            if (segments.length === 0) {
                callback(null, []);
                return;
            }

            tip = segments.shift();

            Step(
                function() {
                    bank.read('streamsegmentcount', tip, this);
                },
                function(err, tipcount) {
                    var group = this.group();
                    if (err) throw err;
                    if (start < tipcount) {
                        bank.slice('streamsegment',
                                   tip,
                                   start,
                                   Math.min(end, tipcount),
                                   group());
                    }
                    if (end > tipcount) {
                        if (segments.length > 0) {
                            getMore(segments,
                                    Math.max(start - tipcount, 0),
                                    end - tipcount,
                                    group());
                        } else { // Asking for more than we have
                            // Need to trigger the rest
                            group()(null, []);
                        }
                    }
                },
                function(err, parts) {
                    if (err) {
                        callback(err, null);
                    } else { 
                        callback(null, (parts.length === 1) ? parts[0] : parts[0].concat(parts[1]));
                    }
                }
            );
        };

    if (start < 0 || end < 0 || start > end) {
        callback(new Error("Bad parameters"), null);
        return;
    }

    Step(
        function() {
            // XXX: maybe just take slice from [0, end/HARD_LIMIT)
            bank.read('streamsegments', stream.name, this);
        },
        function(err, segments) {
            if (err) throw err;
            getMore(segments, start, end, this);
        },
        function(err, ids) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, ids);
            }
        }
    );
};

// XXX: Not atomic; can get out of whack if an insertion
// happens between indexOf() and getIDs()

Stream.prototype.getIDsGreaterThan = function(id, count, callback) {
    var stream = this;

    if (count < 0) {
        callback(new Error("count must be >= 0)"), null);
        return;
    }

    Step(
        function() {
            stream.indexOf(id, this);
        },
        function(err, idx) {
            if (err) throw err;
            stream.getIDs(idx + 1, idx + count + 1, this);
        },
        function(err, ids) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, ids);
            }
        }
    );
};

// XXX: Not atomic; can get out of whack if an insertion
// happens between indexOf() and getIDs()

Stream.prototype.getIDsLessThan = function(id, count, callback) {
    var stream = this;
    Step(
        function() {
            stream.indexOf(id, this);
        },
        function(err, idx) {
            if (err) throw err;
            stream.getIDs(Math.max(0, idx - count), idx, this);
        },
        function(err, ids) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, ids);
            }
        }
    );
};

Stream.prototype.indexOf = function(id, callback) {
    var bank = Stream.bank(),
        stream = this,
        indexOfSeg = function indexOfSeg(id, segments, offset, callback) {

            var tip, cnt;

            if (segments.length === 0) {
                callback(null, -1);
                return;
            }

            tip = segments.shift();

            Step(
                function() {
                    bank.read('streamsegmentcount', tip, this);
                },
                function(err, result) {
                    if (err) throw err;
                    cnt = result;
                    bank.indexOf('streamsegment', tip, id, this);
                },
                function(err, idx) {
                    if (err) {
                        callback(err, null);
                    } else if (idx == -1) {
                        indexOfSeg(id, segments, offset + cnt, callback);
                    } else {
                        callback(null, idx + offset);
                    }
                }
            );
        };

    Step(
        function() {
            // XXX: maybe just take slice from [0, end/HARD_LIMIT)
            bank.read('streamsegments', stream.name, this);
        },
        function(err, segments) {
            if (err) throw err;
            indexOfSeg(id, segments, 0, this);
        },
        function(err, idx) {
            if (err) {
                callback(err, null);
            } else if (idx === -1) {
                callback(new DatabankError("id '" + id + "' not found in stream '" + stream.name + "'"), null);
            } else {
                callback(null, idx);
            }
        }
    );
};

Stream.prototype.count = function(callback) {
    Stream.count(this.name, callback);
};

Stream.count = function(name, callback) {
    var bank = Stream.bank();
    bank.read('streamcount', name, callback);
};

Stream.schema = {
    'stream': {'pkey': 'name'},
    'streamcount': {'pkey': 'name'},
    'streamsegments': {'pkey': 'name'},

    'streamsegment': {'pkey': 'id'},
    'streamsegmentcount': {'pkey': 'id'}
};
