// stream.js
//
// A (potentially very long) stream of object IDs
//
// Copyright 2011,2012,2013 E14N https://e14n.com/
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

var databank = require("databank"),
    _ = require("underscore"),
    Step = require("step"),
    Schlock = require("schlock"),
    Queue = require("jankyqueue"),
    DatabankObject = databank.DatabankObject,
    IDMaker = require("../idmaker").IDMaker,
    NoSuchThingError = databank.NoSuchThingError,
    DatabankError = databank.DatabankError;

// A stream is a potentially very large array of items -- usually
// string IDs or JSON-encoded references, although most objects should work.
//
// Streams are LIFO -- getting items 0-19 will get the most recent 20
// items.
//
// The data structure is an array of stream segments, each segment 1-2000 items
// in length. New segments are added to the end. New items are appended
// to the end of each array. So, adding the first 10,000 whole numbers to
// a stream, in order, would give a data structure kind of like this:
//
// [[9999, 9998, 9997, ..., 8763, 8762, 8761],
//  [8760, 8759, 8758, ..., 7433, 7432, 7431],
//  ...
//  [991, 990, 989, ..., 2, 1, 0]]
//
// The advantage of this backwards-looking structure is a) items keep their local index
// within a segment no matter how many items are added and b) Databank systems that
// support arrays natively seem to support append() natively more often than prepend.
//
// Total stream count, and count per segment, are kept in separate
// records so they can be atomically incremented or decremented.
//
// The most recently added items to a stream are much more likely to be retrieved
// than more recent ones.

var Stream = DatabankObject.subClass("stream");

Stream.SOFT_LIMIT = 1000;
Stream.HARD_LIMIT = 2000;

var NotInStreamError = function(id, streamName) {
    Error.captureStackTrace(this, NotInStreamError);
    this.name       = "NotInStreamError";
    this.id         = id;
    this.streamName = streamName;
    this.message    = "id '" + id + "' not found in stream '" + streamName + "'";
};

NotInStreamError.prototype = new DatabankError();
NotInStreamError.prototype.constructor = NotInStreamError;

// Global locking system for streams

Stream.schlock = new Schlock();

Stream.beforeCreate = function(props, callback) {

    var bank = Stream.bank(),
        stream = null,
        schlocked = false,
        id;

    if (!props.name) {
        callback(new Error("Gotta have a name"), null);
        return;
    }

    id = props.name + ":stream:" + IDMaker.makeID();


    Step(
        function() {
            Stream.schlock.writeLock(props.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            bank.create("streamsegmentcount", id, 0, this.parallel());
            bank.create("streamsegment", id, [], this.parallel());
        },
        function(err, cnt, seg) {
            if (err) throw err;
            bank.create("streamcount", props.name, 0, this.parallel());
            bank.create("streamsegments", props.name, [id], this.parallel());
        },
        function(err, count, segments) {
            if (err) throw err;
            Stream.schlock.writeUnlock(props.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.writeUnlock(props.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, props);
            }
        }
    );
};

// put something in the stream

var randBetween = function(min, max) {
    var diff = max - min + 1;
    return Math.floor((Math.random() * diff) + min);
};

Stream.prototype.deliver = function(id, callback) {

    var stream = this,
        bank = Stream.bank(),
        schlocked = false,
        current = null;

    Step(
        function() {
            Stream.schlock.writeLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            bank.read("streamsegments", stream.name, this);
        },
        function(err, segments) {
            if (err) throw err;
            if (segments.length == 0) {
                throw new Error("No segments in stream");
            }
            current = segments[segments.length - 1];
            bank.read("streamsegmentcount", current, this);
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
                stream.newSegmentLockless(this);
            } else {
                this(null, current);
            }
        },
        function(err, segmentId) {
            if (err) throw err;
            bank.append("streamsegment", segmentId, id, this.parallel());
            bank.incr("streamsegmentcount", segmentId, this.parallel());
            bank.incr("streamcount", stream.name, this.parallel());
        },
        function(err) {
            if (err) throw err;
            Stream.schlock.writeUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.writeUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
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
        schlocked = false,
        segments,
        segmentId;

    Step(
        function() {
            Stream.schlock.writeLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            bank.read("streamsegments", stream.name, this);
        },
        function(err, segments) {
            var i,
                cb = this,
                findFrom = function(j) {
                    if (j >= segments.length) {
                        cb(new NotInStreamError(id, stream.name), null);
                        return;
                    }
                    bank.indexOf("streamsegment", segments[j], id, function(err, idx) {
                        if (err) {
                            cb(err, null);
                        } else if (idx === -1) {
                            findFrom(j+1);
                        } else {
                            cb(null, segments[j]);
                        }
                    });
                };
            if (err) throw err;
            findFrom(0);
        },
        function(err, found) {
            if (err) throw err;
            segmentId = found;
            bank.remove("streamsegment", segmentId, id, this);
        },
        function(err) {
            if (err) throw err;
            bank.decr("streamsegmentcount", segmentId, this.parallel());
            bank.decr("streamcount", stream.name, this.parallel());
        },
        function(err) {
            if (err) throw err;
            Stream.schlock.writeUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.writeUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null);
            }
        }
    );
};

Stream.prototype.newSegment = function(callback) {

    var stream = this,
        id,
        schlocked = false;

    Step(
        function() {
            Stream.schlock.writeLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            stream.newSegmentLockless(this);
        },
        function(err, results) {
            if (err) throw err;
            id = results;
            Stream.schlock.writeUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.writeUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, id);
            }
        }
    );
};

Stream.prototype.newSegmentLockless = function(callback) {

    var bank = Stream.bank(),
        stream = this,
        id = stream.name + ":stream:" + IDMaker.makeID();

    Step(
        function() {
            bank.create("streamsegmentcount", id, 0, this.parallel());
            bank.create("streamsegment", id, [], this.parallel());
        },
        function(err, cnt, segment) {
            if (err) throw err;
            bank.append("streamsegments", stream.name, id, this);
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(err, id);
            }
        }
    );
};

Stream.prototype.getItems = function(start, end, callback) {
    var bank = Stream.bank(),
        stream = this,
        ids,
        schlocked;

    Step(
        function() {
            Stream.schlock.readLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            stream.getItemsLockless(start, end, this);
        },
        function(err, results) {
            if (err) throw err;
            ids = results;
            Stream.schlock.readUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.readUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, ids);
            }
        }
    );
};

Stream.prototype.getItemsLockless = function(start, end, callback) {

    var bank = Stream.bank(),
        stream = this,
        ids,
        getMore = function getMore(segments, segidx, start, end, callback) {

            var tip;

            if (segidx < 0) {
                callback(null, []);
                return;
            }

            tip = segments[segidx]; // last segment

            Step(
                function() {
                    bank.read("streamsegmentcount", tip, this);
                },
                function(err, tipcount) {
                    var p0 = this.parallel(),
                        p1 = this.parallel();
                    if (err) throw err;
                    if (start < tipcount) {
                        bank.slice("streamsegment",
                                   tip,
                                   Math.max((tipcount - end), 0),
                                   tipcount - start,
                                   p0);
                    } else {
                        p0(null, []);
                    }

                    if (end > tipcount && segidx > 0) {
                        getMore(segments,
                                segidx - 1,
                                Math.max(start - tipcount, 0),
                                end - tipcount, // end > tipcount => end - tipcount >= 0
                                p1);
                    } else {
                        p1(null, []);
                    }
                },
                function(err, head, tail) {
                    if (err) {
                        callback(err, null);
                    } else {
                        head.reverse();
                        callback(null, head.concat(tail));
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
            bank.read("streamsegments", stream.name, this);
        },
        function(err, segments) {
            if (err) throw err;
            if (!segments || segments.length == 0) {
                this(null, []);
                return;
            }
            getMore(segments, segments.length - 1, start, end, this);
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
// happens between indexOf() and getItems()

Stream.prototype.getItemsGreaterThan = function(id, count, callback) {
    var stream = this,
        ids,
        schlocked = false;

    if (count < 0) {
        callback(new Error("count must be >= 0)"), null);
        return;
    }

    Step(
        function() {
            Stream.schlock.readLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            stream.indexOfLockless(id, this);
        },
        function(err, idx) {
            if (err) throw err;
            stream.getItemsLockless(idx + 1, idx + count + 1, this);
        },
        function(err, results) {
            if (err) throw err;
            ids = results;
            Stream.schlock.readUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.readUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, ids);
            }
        }
    );
};

// XXX: Not atomic; can get out of whack if an insertion
// happens between indexOf() and getItems()

Stream.prototype.getItemsLessThan = function(id, count, callback) {
    var stream = this,
        ids,
        schlocked = false;

    Step(
        function() {
            Stream.schlock.readLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            stream.indexOfLockless(id, this);
        },
        function(err, idx) {
            if (err) throw err;
            stream.getItemsLockless(Math.max(0, idx - count), idx, this);
        },
        function(err, results) {
            if (err) throw err;
            ids = results;
            Stream.schlock.readUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.readUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, ids);
            }
        }
    );
};

Stream.prototype.indexOf = function(id, callback) {
    var stream = this,
        schlocked = false,
        idx;

    Step(
        function() {
            Stream.schlock.readLock(stream.name, this);
        },
        function(err) {
            if (err) throw err;
            schlocked = true;
            stream.indexOfLockless(id, this);
        },
        function(err, results) {
            if (err) throw err;
            idx = results;
            Stream.schlock.readUnlock(stream.name, this);
        },
        function(err) {
            if (err) {
                if (schlocked) {
                    Stream.schlock.readUnlock(stream.name, function(err2) {
                        callback(err, null);
                    });
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, idx);
            }
        }
    );
};

Stream.prototype.indexOfLockless = function(id, callback) {
    var bank = Stream.bank(),
        stream = this,
        indexOfSeg = function indexOfSeg(id, segments, segidx, offset, callback) {

            var tip, cnt;

            tip = segments[segidx];

            Step(
                function() {
                    bank.read("streamsegmentcount", tip, this);
                },
                function(err, result) {
                    if (err) throw err;
                    cnt = result;
                    bank.indexOf("streamsegment", tip, id, this);
                },
                function(err, idx) {
                    var rel, result;
                    if (err) {
                        callback(err, null);
                    } else if (idx == -1) {
                        if (segidx === 0) {
                            callback(null, -1);
                        } else {
                            indexOfSeg(id, segments, segidx - 1, offset + cnt, callback);
                        }
                    } else {
                        rel = ((cnt - 1) - idx);
                        result = rel + offset;
                        callback(null, result);
                    }
                }
            );
        };

    Step(
        function() {
            // XXX: maybe just take slice from [0, end/HARD_LIMIT)
            bank.read("streamsegments", stream.name, this);
        },
        function(err, segments) {
            if (err) throw err;
            if (!segments || segments.length === 0) {
                callback(null, -1);
                return;
            }
            indexOfSeg(id, segments, segments.length - 1, 0, this);
        },
        function(err, idx) {
            if (err) {
                callback(err, null);
            } else if (idx === -1) {
                callback(new NotInStreamError(id, stream.name), null);
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
    bank.read("streamcount", name, callback);
};

Stream.prototype.getIDs = function(start, end, callback) {
    this.getItems(start, end, callback);
};

Stream.prototype.getIDsGreaterThan = function(id, count, callback) {
    this.getItemsGreaterThan(id, count, callback);
};

Stream.prototype.getIDsLessThan = function(id, count, callback) {
    this.getItemsLessThan(id, count, callback);
};

Stream.prototype.getObjects = function(start, end, callback) {
    var stream = this;
    Step(
        function() {
            stream.getItems(start, end, this);
        },
        function(err, items) {
            var i, objs;
            if (err) {
                callback(err, null);
            } else {
                objs = new Array(items.length);
                for (i = 0; i < items.length; i++) {
                    objs[i] = JSON.parse(items[i]);
                }
                callback(err, objs);
            }
        }
    );
};

Stream.prototype.getObjectsGreaterThan = function(obj, count, callback) {
    var stream = this;
    Step(
        function() {
            stream.getItemsGreaterThan(JSON.stringify(obj), count, this);
        },
        function(err, items) {
            var i, objs;
            if (err) {
                callback(err, null);
            } else {
                objs = new Array(items.length);
                for (i = 0; i < items.length; i++) {
                    objs[i] = JSON.parse(items[i]);
                }
                callback(err, objs);
            }
        }
    );
};

Stream.prototype.getObjectsLessThan = function(obj, count, callback) {
    var stream = this;
    Step(
        function() {
            stream.getItemsLessThan(JSON.stringify(obj), count, this);
        },
        function(err, items) {
            var i, objs;
            if (err) {
                callback(err, null);
            } else {
                objs = new Array(items.length);
                for (i = 0; i < items.length; i++) {
                    objs[i] = JSON.parse(items[i]);
                }
                callback(err, objs);
            }
        }
    );
};

Stream.prototype.deliverObject = function(obj, callback) {
    this.deliver(JSON.stringify(obj), callback);
};

Stream.prototype.removeObject = function(obj, callback) {
    this.remove(JSON.stringify(obj), callback);
};

Stream.prototype.hasObject = function(obj, callback) {
    var str = this;

    Step(
	function() {
	    str.indexOf(JSON.stringify(obj), this);
	},
	function(err, index) {
	    if (err && err.name == "NotInStreamError") {
		this(null, false);
	    } else if (err && err.name != "NotInStreamError") {
		this(err, null);
	    } else if (!err) {
		this(null, true);
	    }
	},
	callback
    );
};

Stream.schema = {
    "stream": {"pkey": "name"},
    "streamcount": {"pkey": "name"},
    "streamsegments": {"pkey": "name"},

    "streamsegment": {"pkey": "id"},
    "streamsegmentcount": {"pkey": "id"}
};

Stream.prototype.dump = function(callback) {

    var bank = Stream.bank(),
        str = this,
        res = {};

    Step(
        function() {
            bank.read("stream", str.name, this.parallel());
            bank.read("streamcount", str.name, this.parallel());
            bank.read("streamsegments", str.name, this.parallel());
        },
        function(err, val, cnt, segs) {

            var i, g1 = this.group(), g2 = this.group();

            if (err) throw err;

            res.stream = val;
            res.streamcount = cnt;
            res.streamsegments = segs;

            for (i = 0; i < segs.length; i++) {
                bank.read("streamsegmentcount", segs[i], g1());
                bank.read("streamsegment", segs[i], g2());
            }
        },
        function(err, counts, segments) {
            if (err) {
                callback(err, null);
            } else {
                res.streamsegmentcount = counts;
                res.streamsegment = segments;
                callback(null, res);
            }
        }
    );
};

var MAX_EACH = 25;

Stream.prototype.each = function(iter, concur, callback) {

    var bank = Stream.bank(),
        str = this,
        q;

    if (!callback) {
        callback = concur;
        concur = 16;
    }

    q = new Queue(concur);

    Step(
        function() {
            bank.read("streamsegments", str.name, this);
        },
        function(err, segmentIDs) {
            if (err) throw err;
            if (segmentIDs.length == 0) {
                this(null, []);
            } else {
                bank.readAll("streamsegment", segmentIDs, this);
            }
        },
        function(err, segments) {
            var expected = 0,
                actual = 0,
                allEnqueued = false,
                errorHappened = false,
                finished = this,
                safeIter = function(item, callback) {
                    try {
                        iter(item, callback);
                    } catch (err) {
                        callback(err);
                    }
                },
                handler = function(err) {
                    if (errorHappened) {
                        // just skip
                        finished(null);
                        return;
                    }

                    if (err) {
                        errorHappened = true;
                        finished(err);
                    } else {
                        actual++;
                        if (actual >= expected && allEnqueued) {
                            finished(null);
                        }
                    }
                };

            _.each(segments, function(segment) {
                expected += segment.length;
                _.each(segment, function(item) {
                    q.enqueue(safeIter, [item], handler);
                });
            });

            allEnqueued = true;

            // None were enqueued

            if (expected == 0) {
                finished(null);
                return;
            }
        },
        callback
    );
};

// A wrapper for .each() that passes a parsed object
// to the iterator

Stream.prototype.eachObject = function(iter, callback) {
    var str = this,
        objIter = function(item, cb) {
            var obj;
            try {
                obj = JSON.parse(item);
                iter(obj, cb);
            } catch (err) {
                cb(err);
            }
        };

    str.each(objIter, callback);
};

exports.Stream = Stream;
exports.NotInStreamError = NotInStreamError;
