// test/lib/plugin.js
//
// Test plugin
//
// Copyright 2013, E14N https://e14n.com/
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

module.exports = {
    called: {log: false, schema: false, app: false, distribute: false, touser: false},
    initializeLog: function(schema) {
        this.called.log = true;
    },
    initializeSchema: function(schema) {
        this.called.schema = true;
    },
    initializeApp: function(log) {
        this.called.app = true;
    },
    distributeActivity: function(activity, callback) {
        this.called.distribute = true;
        callback(null);
    },
    distributeActivityToUser: function(activity, callback) {
        this.called.touser = true;
        callback(null);
    }
};
