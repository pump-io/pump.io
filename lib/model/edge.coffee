# edge.js
#
# An edge in the social graph, from follower to followed
#
# Copyright 2011,2012 StatusNet Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
DatabankObject = require("databank").DatabankObject
IDMaker = require("../idmaker").IDMaker
Stamper = require("../stamper").Stamper
_ = require("underscore")
Edge = DatabankObject.subClass("edge")
exports.Edge = Edge
Edge.schema =
  pkey: "id"
  fields: ["from", "to", "published", "updated"]
  indices: ["from.id", "to.id"]

Edge.id = (fromId, toId) ->
  fromId + "→" + toId

Edge.beforeCreate = (props, callback) ->
  if not _(props).has("from") or not _(props.from).has("id") or not _(props.from).has("objectType") or not _(props).has("to") or not _(props.to).has("id") or not _(props.to).has("objectType")
    callback new Error("Invalid Edge"), null
    return
  now = Stamper.stamp()
  props.published = props.updated = now
  props.id = Edge.id(props.from.id, props.to.id)
  
  # XXX: store from, to by reference
  callback null, props

Edge::beforeUpdate = (props, callback) ->
  immutable = ["from", "to", "id", "published"]
  i = undefined
  prop = undefined
  i = 0
  while i < immutable.length
    prop = immutable[i]
    delete props[prop]  if _(props).has(prop)
    i++
  now = Stamper.stamp()
  props.updated = now
  
  # XXX: store from, to by reference
  callback null, props

Edge::beforeSave = (callback) ->
  if not _(this).has("from") or not _(@from).has("id") or not _(@from).has("objectType") or not _(this).has("to") or not _(@to).has("id") or not _(@to).has("objectType")
    callback new Error("Invalid Edge"), null
    return
  now = Stamper.stamp()
  @updated = now
  unless _(this).has("id")
    @id = IDMaker.newId()
    @published = now  unless _(this).has("published")
  callback null
