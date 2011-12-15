// person.js
//
// data object representing an person
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
    Activity = require('./activity').Activity,
    dateFormat = require('dateformat');

var Person = DatabankObject.subClass('person');

Person.defaultCreate = Person.create;

Person.create = function(properties, callback) {

    properties.objectType = Activity.PERSON;

    var now = dateFormat(new Date(), "isoDateTime", true);

    properties.published = properties.updated = now;

    properties.uuid = Activity.newId();
    properties.id   = Activity.makeURI('person', properties.uuid);

    console.log(properties.id);

    Person.defaultCreate(properties, callback);
};

// for updating

Person.prototype.defaultUpdate = Person.prototype.update;

Person.prototype.update = function(newPerson, callback) {
    
    var now = dateFormat(new Date(), "isoDateTime", true);

    newPerson.updated = now;

    this.defaultUpdate(newPerson, callback);
};

Person.schema = {pkey: 'id',
		 fields: ['displayName',
			  'image',
			  'id',
			  'published',
			  'updated',
			  'url',
			  'uuid'],
		 indices: ['uuid', 'displayName']
		};

exports.Person = Person;
