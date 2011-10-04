// redisjsonstore.js
//
// implementation of JSONStore interface using redis
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

var store = require('./jsonstore');

var JSONStore = store.JSONStore;
var JSONStoreError = store.JSONStoreError;
var AlreadyExistsError = store.AlreadyExistsError;
var NoSuchThingError = store.NoSuchThingError;

var redis = require('redis');

function RedisJSONStore() {
    this.client = null;
}

RedisJSONStore.prototype = new JSONStore();

RedisJSONStore.prototype.toKey = function(type, id) {
    return type + ':' + id;
}

RedisJSONStore.prototype.connect = function(params, onCompletion) {
    this.client = redis.createClient();
    this.client.on('error', function(err) {
	if (onCompletion) {
	    onCompletion(new JSONStoreError(err));
	}
    })
    this.client.on('connect', function() {
	if (onCompletion) {
	    onCompletion(null);
	}
    })
};

RedisJSONStore.prototype.disconnect = function(onCompletion) {
    this.client.quit(function(err) {
	if (err) {
	    onCompletion(new JSONStoreError());
	} else {
	    onCompletion(null);
	}
    });
};

RedisJSONStore.prototype.create = function(type, id, value, onCompletion) {
    this.client.setnx(this.toKey(type, id), value, function(err, result) {
	if (err) {
	    onCompletion(new JSONStoreError(err));
	} else if (result == 0) {
	    onCompletion(new AlreadyExistsError(type, id));
	} else {
	    onCompletion(null, value);
	}
    });
};

RedisJSONStore.prototype.read = function(type, id, onCompletion) {
    this.client.get(this.toKey(type, id), function(err, value) {
	if (err) {
	    onCompletion(new JSONStoreError(err), null);
	} else if (value == null) {
	    onCompletion(new NoSuchThingError(type, id), null);
	} else {
	    onCompletion(null, value);
	}
    });
};

RedisJSONStore.prototype.update = function(type, id, value, onCompletion) {
    this.client.set(this.toKey(type, id), value, function(err) {
	if (err) {
	    onCompletion(new JSONStoreError(err), null);
	} else {
	    onCompletion(null, value);
	}
    });
};

RedisJSONStore.prototype.del = function(type, id, onCompletion) {
    this.client.del(this.toKey(type, id), function(err, count) {
	if (err) {
	    onCompletion(new JSONStoreError(err));
	} else {
	    onCompletion(null);
	}
    });
};

exports.RedisJSONStore = RedisJSONStore;
