// stream.js
//
// A (potentially very long) stream of activities
//
// Copyright 2011, StatusNet Inc.
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
    _ = require('../../public/javascript/underscore.js'),
    DatabankObject = databank.DatabankObject,
    dateFormat = require('dateformat'),
    bcrypt  = require('bcrypt'),
    Step = require('step'),
    Person = require('./person').Person,
    Activity = require('./activity').Activity,
    NoSuchThingError = databank.NoSuchThingError;

var Stream = DatabankObject.subClass('stream');

exports.Stream = Stream;

Stream.SOFT_LIMIT = 1000;
Stream.HARD_LIMIT = 2000;

Stream.defaultCreate = Stream.create;

Stream.create = function(props, callback) {

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
        function(err) {
            if (err) throw err;
            Stream.defaultCreate(props, this);
        },
        function(err, created) {
            if (err) throw err;
            stream = created;
            stream.newSegment(this);
        },
        function(err) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, stream);
            }
        }
    );
};

// put something in the stream

var randBetween = function(min, max) {
    var diff = max - min + 1; 
    return Math.floor((Math.random() * diff) + min);
};

Stream.prototype.deliver = function(activity, callback) {

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
            bank.prepend('streamsegment', segmentId, activity.id, this.parallel());
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

Stream.prototype.newSegment = function(callback) {

    var bank = Stream.bank(),
        stream = this,
        id = stream.name + ':stream:' + Activity.newId();

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

Stream.prototype.getActivities = function(start, end, callback) {

    var bank = Stream.bank(),
        stream = this,
        getMore = function getMore(segments, start, end, soFar, callback) {

            var tip;

            if (segments.length == 0) {
                callback(null, []);
                return;
            }

            tip = segments.shift();

            Step(
                function() {
                    bank.read('streamsegmentcount', tip, this);
                },
                function(err, tipcount) {
                    if (err) throw err;
                    if (start < tipcount) {
                        bank.slice('streamsegment',
                                   tip,
                                   start,
                                   Math.min(end, tipcount),
                                   this.parallel());
                    }
                    if (end > tipcount && segments.length > 0) {
                        getMore(segments,
                                Math.max(start - tipcount, 0),
                                end - tipcount,
                                this.parallel());
                    }
                },
                function(err, fromTip, fromRest) {
                    if (err) {
                        callback(err, null);
                    } else {
                        if (fromRest && fromRest.length) {
                            fromTip = fromTip.concat(fromRest);
                        }
                        callback(null, fromTip);
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
            getMore(segments, start, end, [], this);
        },
        function(err, ids) {
            if (err) throw err;
            bank.readAll('activity', ids, this);
        },
        function(err, activityMap) {
            var activities = [], id, group;
            if (err) {
                callback(err, null);
            } else {
                for (id in activityMap) {
                    activities.push(new Activity(activityMap[id]));
                }
                activities.sort(function(a, b) {  
                    if (a.published > b.published) {
                        return -1;  
                    } else if (a.published < b.published) {
                        return 1;  
                    } else {
                        return 0;  
                    }
                });
                callback(null, activities);
            }
        }
    );
};

Stream.schema = {
    'stream': {'pkey': 'name'},
    'streamcount': {'pkey': 'name'},
    'streamsegments': {'pkey': 'name'},

    'streamsegment': {'pkey': 'id'},
    'streamsegmentcount': {'pkey': 'id'}
};
