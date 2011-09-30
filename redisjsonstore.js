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

var JSONStore = require('./jsonstore').JSONStore;
var redis = require('redis');

var RedisJSONStore = Object.create(JSONStore, {

    connect: function(params, onSuccess)
    {
	this.client = redis.createClient();
	this.client.on('connect', function() {
	    onSuccess();
	});
    },

    disconnect: function(onSuccess)
    {
	this.client.quit(function(err) {
	    onSuccess();
	});
    },

    create: function(type, id, value, onSuccess)
    {
	this.client.set(type+':'+id, value, function(err) {
	    onSuccess();
	});
    },

    read: function(type, id, onSuccess)
    {
	this.client.get(type+':'+id, function(err, value) {
	    onSuccess(value);
	});
    },

    update: function(type, id, value, onSuccess)
    {
	this.client.set(type+':'+id, value, function(err) {
	    onSuccess();
	});
    },

    del: function(type, id, onSuccess)
    {
	this.client.del(type+':'+id, function(err) {
	    onSuccess();
	});
    },
});

exports.RedisJSONStore = RedisJSONStore;
