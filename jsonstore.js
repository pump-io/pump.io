// jsonstore.js
//
// abstraction for storing JSON data in some kinda storage
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

// I'm too much of a wuss to commit to any JSON storage mechanism right
// now, so I'm just going to declare the interface I need and try a few
// different systems to implement it.

// A custom error for JSONStore schtuff.


// A thing that stores JSON.
// Basically CRUD + Search. Recognizes types of data without
// enforcing a schema.

function JSONStore() {
}

JSONStore.prototype = {

    // Connect yourself on up.
    // params: object containing any params you need
    // onCompletion(err): function to call on completion

    connect: function(params, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError());
	}
    },

    // Disconnect yourself.
    // onCompletion(err): function to call on completion

    disconnect: function(onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError());
	}
    },

    // Create a new thing
    // type: string, type of thing, usually 'user' or 'activity'
    // id: a unique ID, like a nickname or a UUID
    // value: JavaScript value; will be JSONified
    // onCompletion(err, value): function to call on completion

    create: function(type, id, value, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError(), null);
	}
    },

    // Read an existing thing
    // type: the type of thing; 'user', 'activity'
    // id: a unique ID -- nickname or UUID or URI
    // onCompletion(err, value): function to call on completion

    read: function(type, id, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError(), null);
	}
    },

    // Update an existing thing
    // type: the type of thing; 'user', 'activity'
    // id: a unique ID -- nickname or UUID or URI
    // value: the new value of the thing
    // onCompletion(err, value): function to call on completion

    update: function(type, id, value, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError(), null);
	}
    },

    // Delete an existing thing
    // type: the type of thing; 'user', 'activity'
    // id: a unique ID -- nickname or UUID or URI
    // value: the new value of the thing
    // onCompletion(err): function to call on completion

    del: function(type, id, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError());
	}
    },

    // Search for things
    // type: type of thing
    // criteria: map of criteria, with exact matches, like {'subject.id':'tag:example.org,2011:evan' }
    // onResult(value): called once per result found
    // onCompletion(err): called once at the end of results

    search: function(type, criteria, onResult, onCompletion)
    {
	if (onCompletion) {
	    onCompletion(new NotImplementedError());
	}
    }
};

function JSONStoreError(message) {
    if (message) {
	this.message = message;
    }
}

JSONStoreError.prototype = new Error();
JSONStoreError.prototype.constructor = JSONStoreError;

function NoSuchThingError(type, id) {
    this.type = type;
    this.id   = id;
    this.message = "No such '" + type + "' with id '" + id + "'";
}

NoSuchThingError.prototype = new JSONStoreError();
NoSuchThingError.prototype.constructor = NoSuchThingError;

function AlreadyExistsError(type, id) {
    this.type = type;
    this.id   = id;
    this.message = "Already have a(n) '" + type + "' with id '" + id + "'";
}

AlreadyExistsError.prototype = new JSONStoreError();
AlreadyExistsError.prototype.constructor = AlreadyExistsError;

function NotImplementedError() {
    this.message = "Method not yet implemented.";
}

NotImplementedError.prototype = new JSONStoreError();
NotImplementedError.prototype.constructor = NotImplementedError;

exports.JSONStore = JSONStore;
exports.JSONStoreError = JSONStoreError;
exports.NotImplementedError = NotImplementedError;
exports.NoSuchThingError = NoSuchThingError;
exports.AlreadyExistsError = AlreadyExistsError;

