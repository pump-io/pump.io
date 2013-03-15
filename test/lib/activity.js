// activity.js
//
// Test utilities for activities
//
// Copyright 2012, E14N https://e14n.com/
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

var _ = require("underscore"),
    assert = require("assert"),
    vows = require("vows");

var validActivity = function(act) {
    assert.isObject(act);
    assert.isFalse(_.has(act, "_uuid"));
    assert.include(act, "id");
    assert.isString(act.id);
    assert.include(act, "actor");
    assert.isObject(act.actor);
    assert.include(act.actor, "id");
    assert.isString(act.actor.id);
    assert.include(act.actor, "objectType");
    assert.isString(act.actor.objectType);
    assert.include(act.actor, "displayName");
    assert.isString(act.actor.displayName);
    assert.isFalse(_.has(act.actor, "_uuid"));
    assert.include(act, "verb");
    assert.isString(act.verb);
    assert.include(act, "object");
    assert.isObject(act.object);
    assert.include(act.object, "id");
    assert.isString(act.object.id);
    assert.include(act.object, "objectType");
    assert.isString(act.object.objectType);
    assert.isFalse(_.has(act.object, "_uuid"));
    assert.include(act, "published");
    assert.isString(act.published);
    assert.include(act, "updated");
    assert.isString(act.updated);
};

exports.validActivity = validActivity;