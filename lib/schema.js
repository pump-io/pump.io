// lib/schema.js
//
// Get all the files
//
// Copyright 2011-2012, StatusNet Inc.
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

var _ = require('underscore'),
    Activity = require('./model/activity').Activity,
    User = require('./model/user').User,
    Edge = require('./model/edge').Edge,
    Stream = require('./model/stream').Stream,
    Client = require('./model/client').Client,
    RequestToken = require('./model/requesttoken').RequestToken,
    AccessToken = require('./model/accesstoken').AccessToken;
    
var getSchema = function() {

    var i, type, Cls, schema = {};

    schema.activity = Activity.schema;
    schema.user = User.schema;
    schema.edge = Edge.schema;
    schema.outbox = {'pkey': 'id'};
    schema.outboxcount = {'pkey': 'id'};
    schema.userlist = {'pkey': 'id'};
    schema.usercount = {'pkey': 'id'};
    schema.feedcount = {'pkey': 'id'};

    _.extend(schema, Stream.schema);
    _.extend(schema, Client.schema);
    _.extend(schema, RequestToken.schema);
    _.extend(schema, AccessToken.schema);

    for (i = 0; i < Activity.objectTypes.length; i++) {
        type = Activity.objectTypes[i];
        Cls = Activity.toClass(type);
        if (Cls.schema) {
            schema[type] = Cls.schema;
        } else {
            schema[type] = {'pkey': 'id',
                            'fields': ['updated', 'published', 'displayName', 'url'],
                            'indices': ['uuid', 'author.id']};
        }
    }

    return schema;
};

exports = getSchema();
