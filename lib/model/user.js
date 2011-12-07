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

var DatabankObject = require('databank').DatabankObject,
    dateFormat = require('dateformat'),
    bcrypt  = require('bcrypt');

var User = DatabankObject.subClass('user');

exports.User = User;

// for updating

User.prototype.defaultUpdate = User.prototype.update;

User.prototype.update = function(newUser, callback) {
    
    newUser.passwordHash  = bcrypt.encrypt_sync(newUser.password, bcrypt.gen_salt_sync(10));

    delete newUser.password;

    var now = dateFormat(new Date(), "isoDateTime", true);

    newUser.updated   = now;
    newUser.published = this.published;
    newUser.url       = this.url;
    newUser.id        = this.id;

    this.defaultUpdate(newUser, callback);
};

// For creating

User.defaultCreate = User.create;

User.create = function(properties, callback) {

    if (!properties.nickname || !properties.password) {
	callback(new Error('Gotta have a nickname and a password.'), null);
    }

    properties.passwordHash  = bcrypt.encrypt_sync(properties.password, bcrypt.gen_salt_sync(10));

    delete properties.password;

    var now = dateFormat(new Date(), "isoDateTime", true);

    properties.published = properties.updated = now;

    User.defaultCreate(properties, callback);
};

User.prototype.sanitize = function() {
    delete this.password;
    delete this.passwordHash;
};
