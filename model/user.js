// user.js
//
// A local user; distinct from a person
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
    Stream = require('./stream').Stream,
    Activity = require('./activity').Activity,
    NoSuchThingError = databank.NoSuchThingError;

var User = DatabankObject.subClass('user');

exports.User = User;

// for updating

User.prototype.defaultUpdate = User.prototype.update;

User.prototype.update = function(newUser, callback) {
    
    newUser.passwordHash  = bcrypt.hashSync(newUser.password, bcrypt.genSaltSync(10));

    delete newUser.password;

    var now = dateFormat(new Date(), "isoDateTime", true);

    newUser.updated   = now;
    newUser.published = this.published;
    newUser.nickname  = this.nickname;
    newUser.profile = this.profile;

    this.defaultUpdate(newUser, callback);
};

// For creating

User.defaultCreate = User.create;

User.create = function(properties, callback) {

    if (!properties.nickname || !properties.password) {
	callback(new Error('Gotta have a nickname and a password.'), null);
    }

    properties.passwordHash  = bcrypt.hashSync(properties.password, bcrypt.genSaltSync(10));

    delete properties.password;

    var now = dateFormat(new Date(), "isoDateTime", true);

    properties.published = properties.updated = now;

    Step(
        function() {
            Person.create({'preferredUsername': properties.nickname,
                           url: Activity.makeURL(properties.nickname),
                           displayName: properties.nickname}, this);
        },
        function(err, person) {
	    if (err) throw err;
            properties.profile = {
		objectType: 'person',
		id: person.id
	    };

            Stream.create({name: properties.nickname + "-inbox"}, this.parallel());
            Stream.create({name: properties.nickname + "-outbox"}, this.parallel());
        },
        function(err, inbox, outbox) {
            if (err) throw err;
            User.defaultCreate(properties, this);
	},
        function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, user);
            }
        }
    );
};

User.prototype.sanitize = function() {
    delete this.password;
    delete this.passwordHash;
};

User.prototype.getProfile = function(callback) {
    var user = this;
    Step(
	function() {
	    Activity.getObject(user.profile.objectType, user.profile.id, this);
	},
	function(err, profile) {
	    if (err) {
		callback(err, null);
	    } else {
		callback(null, profile);
	    }
	}
    );
};

User.prototype.getStream = function(start, end, callback) {
    var bank = User.bank(),
        user = this; 

    Step(
        function() {
            Stream.get(user.nickname + '-outbox', this);
        },
        function(err, outbox) {
            if (err) throw err;
            outbox.getActivities(start, end, this);
        },
        function(err, activities) {
            var group = this.group();
            if (err) throw err;
            // FIXME: batch fetch all actors and objects
            activities.forEach(function(el, i, arr) {
                delete el.uuid;
                delete el.actor;
                el.expandObject(group());
                // remove internal uuid info, if any
            });
        },
        function(err, activities) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    callback(null, []);
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, activities);
            }
        }
    );
};

User.prototype.getInbox = function(start, end, callback) {
    var bank = User.bank(),
        user = this; 

    Step(
        function() {
            Stream.get(user.nickname + '-inbox', this);
        },
        function(err, inbox) {
            if (err) throw err;
            inbox.getActivities(start, end, this);
        },
        function(err, activities) {
            var group = this.group();
            if (err) throw err;
            // FIXME: batch fetch all actors and objects
            activities.forEach(function(el, i, arr) {
                delete el.uuid;
                el.expand(group());
                // remove internal uuid info, if any
            });
        },
        function(err, activities) {
            if (err) {
                if (err instanceof NoSuchThingError) {
                    callback(null, []);
                } else {
                    callback(err, null);
                }
            } else {
                callback(null, activities);
            }
        }
    );
};

User.prototype.expand = function(callback) {
    var user = this;

    Step(
	function() {
	    user.getProfile(this);
	},
	function(err, profile) {
	    if (err) {
		callback(err, null);
	    } else {
		_.extend(user.profile, profile);
		callback(null, user);
	    }
	}
    );
};

User.fromPerson = function(id, callback) {
    Step(
        function() {
            User.search({"profile.id": id}, this);
        },
        function(err, results) {
            if (err) {
                callback(err, null);
            } else if (results.length == 0) {
                callback(null, null);
            } else {
                callback(null, results[0]);
            }
        }
    );
};

User.prototype.addToOutbox = function(activity, callback) {
    var user = this;
    Step(
        function() {
            Stream.get(user.nickname + "-outbox", this);
        },
        function(err, stream) {
            if (err) throw err;
            stream.deliver(activity, callback);
        }
    );
};

User.prototype.addToInbox = function(activity, callback) {
    var user = this;
    Step(
        function() {
            Stream.get(user.nickname + "-inbox", this);
        },
        function(err, stream) {
            if (err) throw err;
            stream.deliver(activity, callback);
        }
    );
};

User.schema = {'pkey': 'nickname',
	       'fields': ['nickname',
			  'passwordHash',
			  'published',
			  'updated',
			  'profile'],
	       'indices': ['profile.id']};
