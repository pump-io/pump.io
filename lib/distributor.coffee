# distributor.js
#
# Distributes a newly-received activity to recipients
#
# Copyright 2012, StatusNet Inc.
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
_ = require("underscore")
Step = require("step")
databank = require("databank")
Queue = require("./jankyqueue").Queue
ActivityObject = require("./model/activityobject").ActivityObject
Collection = require("./model/collection").Collection
User = require("./model/user").User
Person = require("./model/person").Person
Edge = require("./model/edge").Edge
NoSuchThingError = databank.NoSuchThingError
Distributor = (activity) ->
  @activity = activity
  @delivered = {}
  @q = new Queue(Distributor.QUEUE_MAX)

Distributor.QUEUE_MAX = 25
Distributor::distribute = (callback) ->
  dtor = this
  recipients = dtor.activity.recipients()
  distribution = {}
  Step (->
    i = undefined
    group = @group()
    i = 0
    while i < recipients.length
      dtor.toRecipient recipients[i], group()
      i++
  ), callback

Distributor::toRecipient = (recipient, callback) ->
  dtor = this
  switch recipient.objectType
    when ActivityObject.PERSON
      dtor.toPerson recipient, callback
    when ActivityObject.COLLECTION
      dtor.toCollection recipient, callback
    else
      
      # TODO: log and cry
      return

Distributor::toPerson = (person, callback) ->
  dtor = this
  deliverToPerson = (person, callback) ->
    Step (->
      User.fromPerson person.id, this
    ), (err, user) ->
      throw err  if err
      unless user
        callback null
        return
      user.addToInbox dtor.activity, callback


  if _(dtor.delivered).has(person.id)
    
    # skip dupes
    callback null
    return
  dtor.delivered[person.id] = 1
  dtor.q.enqueue deliverToPerson, [person], callback

Distributor::toCollection = (collection, callback) ->
  dtor = this
  actor = dtor.activity.actor
  if collection.id is Collection.PUBLIC
    dtor.toFollowers callback
    return
  Step (->
    cb = this
    if actor and actor.objectType is "person" and actor instanceof Person
      actor.followersURL cb
    else
      cb null, null
  ), ((err, url) ->
    throw err  if err
    if url and url is collection.id
      dtor.toFollowers callback
    else
      
      # Usually stored by reference, so get the full object
      ActivityObject.getObject collection.objectType, collection.id, this
  ), ((err, result) ->
    if err and err instanceof NoSuchThingError
      callback null
    else if err
      throw err
    else
      
      # XXX: assigning to function param
      collection = result
      Collection.isList collection, this
  ), (err, isList) ->
    if err
      callback err
    else if isList and (collection.author.id is actor.id)
      dtor.toList collection, callback
    else
      
      # XXX: log, bemoan
      callback null


Distributor::toFollowers = (callback) ->
  dtor = this
  
  # XXX: use followers stream instead
  Step (->
    Edge.search
      "to.id": dtor.activity.actor.id
    , this
  ), ((err, edges) ->
    i = undefined
    group = @group()
    throw err  if err
    i = 0
    while i < edges.length
      Person.get edges[i].from.id, group()
      i++
  ), ((err, people) ->
    throw err  if err
    i = undefined
    group = @group()
    i = 0
    while i < people.length
      dtor.toPerson people[i], group()
      i++
  ), callback

module.exports = Distributor
