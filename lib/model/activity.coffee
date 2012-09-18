# activity.js
#
# data object representing an activity
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
databank = require("databank")
Step = require("step")
_ = require("underscore")
URLMaker = require("../urlmaker").URLMaker
IDMaker = require("../idmaker").IDMaker
Stamper = require("../stamper").Stamper
ActivityObject = require("./activityobject").ActivityObject
DatabankObject = databank.DatabankObject
NoSuchThingError = databank.NoSuchThingError
NotInStreamError = require("./stream").NotInStreamError
AppError = (msg) ->
  Error.captureStackTrace this, AppError
  @name = "AppError"
  @message = msg

AppError:: = new Error()
AppError::constructor = AppError
Activity = DatabankObject.subClass("activity")
Activity.schema =
  pkey: "id"
  fields: ["actor", "content", "generator", "icon", "id", "object", "published", "provider", "target", "title", "url", "uuid", "updated", "verb"]
  indices: ["actor.id", "object.id", "uuid"]

Activity.init = (inst, properties) ->
  DatabankObject.init inst, properties
  @verb = "post"  unless @verb
  inst.actor = ActivityObject.toObject(inst.actor, ActivityObject.PERSON)  if inst.actor
  inst.object = ActivityObject.toObject(inst.object)  if inst.object

Activity::apply = (defaultActor, callback) ->
  act = this
  User = require("./user").User
  user = undefined
  
  # Ensure an actor
  @actor = @actor or defaultActor
  
  # XXX: Polymorphism is probably the right thing here
  # but I kinda CBA. How's this: rewrite when we get over 10 case's...?
  switch @verb
    when Activity.POST
      
      # Force author data
      @object.author = @actor
      
      # Is this it...?
      ActivityObject.createObject @object, (err, result) ->
        callback err, result

    when Activity.FOLLOW
      callback new AppError("No ID.")  if not @actor.id or not @object.id
      ActivityObject.ensureObject act.object, (err, followed) ->
        User.fromPerson act.actor.id, (err, user) ->
          if err
            callback err, null
          else
            user.follow act.object.id, callback


    when Activity.STOP_FOLLOWING
      
      # XXX: OStatus if necessary
      ActivityObject.ensureObject act.object, (err, followed) ->
        User.fromPerson act.actor.id, (err, user) ->
          if err
            callback err, null
          else
            user.stopFollowing act.object.id, callback


    # synonyms
    when Activity.FAVORITE, Activity.LIKE
      
      # XXX: Should we record favorite data for 
      # remote users?
      Step (->
        User.fromPerson act.actor.id, this
      ), ((err, results) ->
        throw err  if err
        user = results
        ActivityObject.ensureObject act.object, this
      ), (err, tofavor) ->
        if err
          callback err, null
        else
          user.favorite tofavor.id, tofavor.objectType, callback

    when Activity.UNFAVORITE, Activity.UNLIKE
      
      # XXX: Should we record favorite data for 
      # remote users?
      Step (->
        User.fromPerson act.actor.id, this
      ), ((err, results) ->
        throw err  if err
        user = results
        ActivityObject.ensureObject act.object, this
      ), (err, tounfavor) ->
        if err
          callback err, null
        else
          user.unfavorite tounfavor.id, tounfavor.objectType, callback

    when Activity.DELETE
      Step (->
        ActivityObject.getObject act.object.objectType, act.object.id, this
      ), ((err, toDelete) ->
        throw err  if err
        throw new AppError("Can't delete " + toDelete.id + ": not author.")  if toDelete.author.id isnt act.actor.id
        toDelete.efface this
      ), (err, ts) ->
        if err
          callback err
        else
          callback null

    when Activity.UPDATE
      Step (->
        ActivityObject.getObject act.object.objectType, act.object.id, this
      ), ((err, toUpdate) ->
        throw err  if err
        throw new AppError("Can't update " + toUpdate.id + ": not author.")  if toUpdate.author.id isnt act.actor.id
        toUpdate.update act.object, this
      ), (err, result) ->
        if err
          callback err
        else
          act.object = result
          callback null

    when Activity.ADD
      Step (->
        ActivityObject.ensureObject act.object, @parallel()
        ActivityObject.getObject act.target.objectType, act.target.id, @parallel()
      ), ((err, toAdd, target) ->
        throw err  if err
        throw new AppError("Can't add to " + target.id + ": not author.")  if target.author.id isnt act.actor.id
        throw new AppError("Can't add to " + target.id + ": not a collection.")  if target.objectType isnt "collection"
        throw new AppError("Can't add to " + target.id + ": incorrect type.")  if not _(target).has("objectTypes") or not _(target.objectTypes).isArray() or target.objectTypes.indexOf(toAdd.objectType) is -1
        target.getStream this
      ), ((err, stream) ->
        throw err  if err
        stream.deliverObject
          id: act.object.id
          objectType: act.object.objectType
        , this
      ), (err) ->
        if err
          callback err
        else
          callback null

    when Activity.REMOVE
      Step (->
        ActivityObject.ensureObject act.object, @parallel()
        ActivityObject.getObject act.target.objectType, act.target.id, @parallel()
      ), ((err, toAdd, target) ->
        throw err  if err
        throw new AppError("Can't remove from " + target.id + ": not author.")  if target.author.id isnt act.actor.id
        throw new AppError("Can't remove from " + target.id + ": not a collection.")  if target.objectType isnt "collection"
        throw new AppError("Can't remove from " + target.id + ": incorrect type.")  if not _(target).has("objectTypes") or not _(target.objectTypes).isArray() or target.objectTypes.indexOf(toAdd.objectType) is -1
        target.getStream this
      ), ((err, stream) ->
        throw err  if err
        stream.removeObject
          id: act.object.id
          objectType: act.object.objectType
        , this
      ), (err) ->
        if err
          callback err
        else
          callback null

    else
      
      # XXX: fave/unfave, join/leave, ...?
      callback null

Activity::recipients = ->
  act = this
  props = ["to", "cc", "bto", "bcc"]
  recipients = []
  props.forEach (prop) ->
    recipients = recipients.concat(act[prop])  if _(act).has(prop) and _(act[prop]).isArray()

  
  # XXX: ensure uniqueness
  recipients


# Set default recipients
Activity::ensureRecipients = (callback) ->
  act = this
  recipients = act.recipients()
  
  # If we've got recipients, cool.
  if recipients.length > 0
    callback null
    return
  
  # Modification verbs use same as original post
  if act.verb is Activity.DELETE or act.verb is Activity.UPDATE
    Step (->
      ActivityObject.getObject act.object.objectType, act.object.id, this
    ), ((err, orig) ->
      throw err  if err
      Activity.postOf orig, this
    ), (err, post) ->
      props = ["to", "cc", "bto", "bcc"]
      if err
        callback err
      else unless post
        callback new Error("no original post")
      else
        props.forEach (prop) ->
          act[prop] = post[prop]  if post.hasOwnProperty(prop)

        callback null

  else if act.object and act.object.inReplyTo
    
    # Replies use same as original post
    Step (->
      ActivityObject.ensureObject act.object.inReplyTo, this
    ), ((err, orig) ->
      throw err  if err
      Activity.postOf orig, this
    ), (err, post) ->
      props = ["to", "cc", "bto", "bcc"]
      if err
        callback err
      else unless post
        callback new Error("no original post")
      else
        props.forEach (prop) ->
          if post.hasOwnProperty(prop)
            act[prop] = []
            post[prop].forEach (addr) ->
              act[prop].push addr  if addr.id isnt act.actor.id


        act.to = []  unless act.to
        act.to.push post.actor
        callback null

  else if act.object and act.object.objectType is ActivityObject.PERSON
    
    # XXX: cc? bto?
    act.to = [act.object]
    callback null
  else if act.actor and act.actor.objectType is ActivityObject.PERSON
    
    # Default is to user's followers
    Step (->
      ActivityObject.ensureObject act.actor, this
    ), ((err, actor) ->
      throw err  if err
      actor.followersURL this
    ), (err, url) ->
      if err
        callback err
      else unless url
        callback new Error("no followers url")
      else
        act.cc = [
          objectType: "collection"
          id: url
        ]
        callback null

  else
    callback new Error("Can't ensure recipients.")


# XXX: identical to save
Activity.beforeCreate = (props, callback) ->
  now = Stamper.stamp()
  props.updated = now
  props.published = now  unless props.published
  unless props.id
    props.uuid = IDMaker.makeID()
    props.id = ActivityObject.makeURI("activity", props.uuid)
    props.links = {}  unless _(props).has("links")
    props.links.self = href: URLMaker.makeURL("api/activity/" + props.uuid)
    
    # FIXME: assumes person data was set and that it's a local actor
    props.url = URLMaker.makeURL(props.actor.preferredUsername + "/activity/" + props.uuid)
    
    # default verb
    props.verb = "post"  unless props.verb
  callback new Error("Activity has no actor"), null  unless props.actor
  callback new Error("Activity has no object"), null  unless props.object
  Step (->
    ActivityObject.compressProperty props, "actor", @parallel()
    ActivityObject.compressProperty props, "object", @parallel()
    ActivityObject.compressProperty props, "target", @parallel()
    ActivityObject.compressArray props, "to", @parallel()
    ActivityObject.compressArray props, "cc", @parallel()
    ActivityObject.compressArray props, "bto", @parallel()
    ActivityObject.compressArray props, "bcc", @parallel()
  ), (err) ->
    if err
      callback err, null
    else
      callback null, props


Activity::beforeUpdate = (props, callback) ->
  now = Stamper.stamp()
  props.updated = now
  Step (->
    ActivityObject.compressProperty props, "actor", @parallel()
    ActivityObject.compressProperty props, "object", @parallel()
    ActivityObject.compressProperty props, "target", @parallel()
    ActivityObject.compressArray props, "to", @parallel()
    ActivityObject.compressArray props, "cc", @parallel()
    ActivityObject.compressArray props, "bto", @parallel()
    ActivityObject.compressArray props, "bcc", @parallel()
  ), (err) ->
    if err
      callback err, null
    else
      callback null, props



# When save()'ing an activity, ensure the actor and object
# are persisted, then save them by reference.
Activity::beforeSave = (callback) ->
  now = Stamper.stamp()
  act = this
  act.updated = now
  act.published = now  unless act.published
  unless act.id
    act.uuid = IDMaker.makeID()
    act.id = ActivityObject.makeURI("activity", act.uuid)
    act.links = {}  unless _(act).has("links")
    act.links.self = href: URLMaker.makeURL("api/activity/" + act.uuid)
    
    # FIXME: assumes person data was set and that it's a local actor
    act.url = URLMaker.makeURL(act.actor.preferredUsername + "/activity/" + act.uuid)
  unless act.actor
    callback new Error("Activity has no actor")
    return
  unless act.object
    callback new Error("Activity has no object")
    return
  Step (->
    ActivityObject.compressProperty act, "actor", @parallel()
    ActivityObject.compressProperty act, "object", @parallel()
    ActivityObject.compressProperty act, "target", @parallel()
    ActivityObject.compressArray act, "to", @parallel()
    ActivityObject.compressArray act, "cc", @parallel()
    ActivityObject.compressArray act, "bto", @parallel()
    ActivityObject.compressArray act, "bcc", @parallel()
  ), (err) ->
    if err
      callback err
    else
      callback null



# When get()'ing an activity, also get the actor and the object,
# which are saved by reference
Activity::afterCreate = Activity::afterSave = Activity::afterUpdate = Activity::afterGet = (callback) ->
  @expand callback

Activity::expand = (callback) ->
  act = this
  Step (->
    ActivityObject.expandProperty act, "actor", @parallel()
    ActivityObject.expandProperty act, "object", @parallel()
    ActivityObject.expandProperty act, "target", @parallel()
    ActivityObject.expandArray act, "to", @parallel()
    ActivityObject.expandArray act, "cc", @parallel()
    ActivityObject.expandArray act, "bto", @parallel()
    ActivityObject.expandArray act, "bcc", @parallel()
  ), ((err) ->
    throw err  if err
    act.object.expandFeeds this
  ), (err) ->
    if err
      callback err
    else
      
      # Implied
      delete act.object.author  if act.verb is "post" and _(act.object).has("author")
      callback null


Activity::compress = (callback) ->
  act = this
  Step (->
    ActivityObject.compressProperty act, "actor", @parallel()
    ActivityObject.compressProperty act, "object", @parallel()
    ActivityObject.compressProperty act, "target", @parallel()
  ), (err) ->
    if err
      callback err
    else
      callback null


Activity::efface = (callback) ->
  keepers = ["actor", "object", "uuid", "id", "published", "deleted", "updated"]
  prop = undefined
  obj = this
  for prop of obj
    delete obj[prop]  if obj.hasOwnProperty(prop) and keepers.indexOf(prop) is -1
  now = Stamper.stamp()
  obj.deleted = obj.updated = now
  obj.save callback

Activity::sanitize = (user) ->
  if not user or (user.profile.id isnt @actor.id)
    delete @bcc  if @bcc
    delete @bto  if @bto
  
  # XXX: async?
  delete @uuid

  return


# Is the person argument a recipient of this activity?
# Checks to, cc, bto, bcc
# If the public is a recipient, always works (even null)
# Otherwise if the person is a direct recipient, true.
# Otherwise if the person is in a list that's a recipient, true.
# Otherwise if the actor's followers list is a recipient, and the
# person is a follower, true.
# Otherwise false.
Activity::checkRecipient = (person, callback) ->
  act = this
  i = undefined
  addrProps = ["to", "cc", "bto", "bcc"]
  recipientsOfType = (type) ->
    i = undefined
    j = undefined
    addrs = undefined
    rot = []
    i = 0
    while i < addrProps.length
      if _(act).has(addrProps[i])
        addrs = act[addrProps[i]]
        j = 0
        while j < addrs.length
          rot.push addrs[j]  if addrs[j].objectType is type
          j++
      i++
    rot

  recipientWithID = (id) ->
    i = undefined
    j = undefined
    addrs = undefined
    i = 0
    while i < addrProps.length
      if _(act).has(addrProps[i])
        addrs = act[addrProps[i]]
        j = 0
        while j < addrs.length
          return addrs[j]  if addrs[j].id is id
          j++
      i++
    null

  isInLists = (person, callback) ->
    isInList = (list, callback) ->
      Step (->
        Collection.isList list, this
      ), ((err, isList) ->
        throw err  if err
        unless isList
          callback null, false
        else
          list.getStream this
      ), ((err, str) ->
        val = JSON.stringify(
          id: person.id
          objectType: person.objectType
        )
        throw err  if err
        str.indexOf val, this
      ), (err, i) ->
        if err
          if err instanceof NotInStreamError
            callback null, false
          else
            callback err, null
        else
          callback null, true


    Step (->
      i = undefined
      group = @group()
      lists = recipientsOfType(ActivityObject.COLLECTION)
      i = 0
      while i < lists.length
        isInList lists[i], group()
        i++
    ), (err, inLists) ->
      if err
        callback err, null
      else
        callback null, inLists.some((b) ->
          b
        )


  isInFollowers = (person, callback) ->
    if not _(act).has("actor") or act.actor.objectType isnt ActivityObject.PERSON
      callback null, false
      return
    Step (->
      act.actor.followersURL this
    ), ((err, url) ->
      throw err  if err
      if not url or not recipientWithID(url)
        callback null, false
      else
        Edge = require("./edge").Edge
        Edge.get Edge.id(person.id, act.actor.id), this
    ), (err, edge) ->
      if err and err instanceof NoSuchThingError
        callback null, false
      else unless err
        callback null, true
      else
        callback err, null


  persons = undefined
  Collection = require("./collection").Collection
  
  # Check for public
  pub = recipientWithID(Collection.PUBLIC)
  return callback(null, true)  if pub
  
  # if not public, then anonymous user can't be a recipient
  return callback(null, false)  unless person
  
  # Check for exact match
  persons = recipientsOfType("person")
  i = 0
  while i < persons.length
    return callback(null, true)  if persons[i].id is person.id
    i++
  
  # From here on, things go async
  Step (->
    isInLists person, @parallel()
    isInFollowers person, @parallel()
  ), (err, inlists, infollowers) ->
    if err
      callback err, null
    else
      callback null, inlists or infollowers


Activity::isMajor = ->
  majorVerbs = [Activity.POST, Activity.SHARE, Activity.CHECKIN]
  majorVerbs.indexOf(@verb) isnt -1


# XXX: we should probably just cache this somewhere
Activity.postOf = (obj, callback) ->
  Activity.search
    verb: Activity.POST
    "object.id": obj.id
  , (err, acts) ->
    i = undefined
    if err
      callback err, null
    else if acts.length is 0
      callback null, null
    else
      
      # If there's more than one, check for match
      i = 0
      while i < acts.length
        return callback(null, acts[i])  if acts[i].actor and obj.author and acts[i].actor.id is obj.author.id
        i++
      callback null, null


Activity.verbs = ["accept", "access", "acknowledge", "add", "agree", "append", "approve", "archive", "assign", "at", "attach", "attend", "author", "authorize", "borrow", "build", "cancel", "close", "complete", "confirm", "consume", "checkin", "close", "create", "delete", "deliver", "deny", "disagree", "dislike", "experience", "favorite", "find", "follow", "give", "host", "ignore", "insert", "install", "interact", "invite", "join", "leave", "like", "listen", "lose", "make-friend", "open", "play", "post", "present", "purchase", "qualify", "read", "receive", "reject", "remove", "remove-friend", "replace", "request", "request-friend", "resolve", "return", "retract", "rsvp-maybe", "rsvp-no", "rsvp-yes", "satisfy", "save", "schedule", "search", "sell", "send", "share", "sponsor", "start", "stop-following", "submit", "tag", "terminate", "tie", "unfavorite", "unlike", "unsatisfy", "unsave", "unshare", "update", "use", "watch", "win"]
i = 0
verb = undefined

# Constants-like members for activity verbs
i = 0
while i < Activity.verbs.length
  verb = Activity.verbs[i]
  Activity[verb.toUpperCase().replace("-", "_")] = verb
  i++
exports.Activity = Activity
exports.AppError = AppError
