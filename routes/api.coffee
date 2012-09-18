# routes/api.js
#
# The beating heart of a pumpin' good time
#
# Copyright 2011-2012, StatusNet Inc.
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
_ = require("underscore")
Step = require("step")
validator = require("validator")
check = validator.check
sanitize = validator.sanitize
FilteredStream = require("../lib/filteredstream").FilteredStream
HTTPError = require("../lib/httperror").HTTPError
Stamper = require("../lib/stamper").Stamper
Activity = require("../lib/model/activity").Activity
AppError = require("../lib/model/activity").AppError
Collection = require("../lib/model/collection").Collection
ActivityObject = require("../lib/model/activityobject").ActivityObject
User = require("../lib/model/user").User
Edge = require("../lib/model/edge").Edge
stream = require("../lib/model/stream")
Stream = stream.Stream
NotInStreamError = stream.NotInStreamError
Client = require("../lib/model/client").Client
mw = require("../lib/middleware")
URLMaker = require("../lib/urlmaker").URLMaker
Distributor = require("../lib/distributor")
reqUser = mw.reqUser
sameUser = mw.sameUser
NoSuchThingError = databank.NoSuchThingError
AlreadyExistsError = databank.AlreadyExistsError
NoSuchItemError = databank.NoSuchItemError
DEFAULT_ITEMS = 20
DEFAULT_ACTIVITIES = DEFAULT_ITEMS
DEFAULT_FAVORITES = DEFAULT_ITEMS
DEFAULT_LIKES = DEFAULT_ITEMS
DEFAULT_REPLIES = DEFAULT_ITEMS
DEFAULT_FOLLOWERS = DEFAULT_ITEMS
DEFAULT_FOLLOWING = DEFAULT_ITEMS
DEFAULT_USERS = DEFAULT_ITEMS
DEFAULT_LISTS = DEFAULT_ITEMS
MAX_ITEMS = DEFAULT_ITEMS * 10
MAX_ACTIVITIES = MAX_ITEMS
MAX_FAVORITES = MAX_ITEMS
MAX_LIKES = MAX_ITEMS
MAX_REPLIES = MAX_ITEMS
MAX_FOLLOWERS = MAX_ITEMS
MAX_FOLLOWING = MAX_ITEMS
MAX_USERS = MAX_ITEMS
MAX_LISTS = MAX_ITEMS

# Initialize the app controller
addRoutes = (app) ->
  i = 0
  url = undefined
  type = undefined
  authz = undefined
  
  # Users
  app.get "/api/user/:nickname", clientAuth, reqUser, getUser
  app.put "/api/user/:nickname", userAuth, reqUser, sameUser, putUser
  app.del "/api/user/:nickname", userAuth, reqUser, sameUser, delUser
  
  # Feeds
  app.post "/api/user/:nickname/feed", userAuth, reqUser, sameUser, postActivity
  app.get "/api/user/:nickname/feed", clientAuth, reqUser, userStream
  app.get "/api/user/:nickname/feed/major", clientAuth, reqUser, notYetImplemented
  app.get "/api/user/:nickname/feed/minor", clientAuth, reqUser, notYetImplemented
  
  # Inboxen
  app.get "/api/user/:nickname/inbox", userAuth, reqUser, sameUser, userInbox
  app.get "/api/user/:nickname/inbox/major", userAuth, reqUser, sameUser, notYetImplemented
  app.get "/api/user/:nickname/inbox/minor", userAuth, reqUser, sameUser, notYetImplemented
  app.post "/api/user/:nickname/inbox", remoteUserAuth, reqUser, postToInbox
  app.get "/api/user/:nickname/followers", clientAuth, reqUser, userFollowers
  app.get "/api/user/:nickname/following", clientAuth, reqUser, userFollowing
  app.post "/api/user/:nickname/following", clientAuth, reqUser, sameUser, newFollow
  app.get "/api/user/:nickname/favorites", clientAuth, reqUser, userFavorites
  app.post "/api/user/:nickname/favorites", clientAuth, reqUser, sameUser, newFavorite
  app.get "/api/user/:nickname/lists", userAuth, reqUser, sameUser, userLists
  i = 0
  while i < ActivityObject.objectTypes.length
    type = ActivityObject.objectTypes[i]
    url = "/api/" + type + "/" + ":uuid"
    
    # person
    if type is "person"
      authz = userOnly
    else
      authz = authorOnly(type)
    app.get url, clientAuth, requester(type), authorOrRecipient(type), getter(type)
    app.put url, userAuth, requester(type), authz, putter(type)
    app.del url, userAuth, requester(type), authz, deleter(type)
    app.get "/api/" + type + "/" + ":uuid/likes", clientAuth, requester(type), authorOrRecipient(type), likes(type)
    app.get "/api/" + type + "/" + ":uuid/replies", clientAuth, requester(type), authorOrRecipient(type), replies(type)
    i++
  
  # Activities
  app.get "/api/activity/:uuid", clientAuth, reqActivity, actorOrRecipient, getActivity
  app.put "/api/activity/:uuid", userAuth, reqActivity, actorOnly, putActivity
  app.del "/api/activity/:uuid", userAuth, reqActivity, actorOnly, delActivity
  
  # Global user list
  app.get "/api/users", clientAuth, listUsers
  app.post "/api/users", clientAuth, createUser

exports.addRoutes = addRoutes
bank = null
setBank = (newBank) ->
  bank = newBank

exports.setBank = setBank

# Accept either 2-legged or 3-legged OAuth
clientAuth = (req, res, next) ->
  req.client = null
  res.local "client", null # init to null
  if hasToken(req)
    userAuth req, res, next
    return
  req.authenticate ["client"], (error, authenticated) ->
    if error
      next error
      return
    return  unless authenticated
    req.client = req.getAuthDetails().user.client
    res.local "client", req.client # init to null
    next()


hasToken = (req) ->
  req and (_(req.headers).has("authorization") and req.headers.authorization.match(/oauth_token/)) or (req.query and req.query.oauth_token) or (req.body and req.headers["content-type"] is "application/x-www-form-urlencoded" and req.body.oauth_token)


# Accept only 3-legged OAuth
# XXX: It would be nice to merge these two functions
userAuth = (req, res, next) ->
  req.remoteUser = null
  res.local "remoteUser", null # init to null
  req.client = null
  res.local "client", null # init to null
  req.authenticate ["user"], (error, authenticated) ->
    if error
      next error
      return
    return  unless authenticated
    req.remoteUser = req.getAuthDetails().user.user
    res.local "remoteUser", req.remoteUser
    req.client = req.getAuthDetails().user.client
    res.local "client", req.client
    next()



# Accept only 2-legged OAuth with
remoteUserAuth = (req, res, next) ->
  req.client = null
  res.local "client", null # init to null
  req.remotePerson = null
  res.local "person", null
  req.authenticate ["client"], (error, authenticated) ->
    id = undefined
    if error
      next error
      return
    return  unless authenticated
    id = req.getAuthDetails().user.id
    Step (->
      Client.get id, this
    ), (err, client) ->
      if err
        next err
        return
      unless client
        next new HTTPError("No client", 401)
        return
      unless client.webfinger
        next new HTTPError("OAuth key not associated with a webfinger ID", 401)
        return
      req.client = client
      req.webfinger = client.webfinger
      res.local "client", req.client # init to null
      res.local "person", req.person # init to null
      next()



requester = (type) ->
  Cls = ActivityObject.toClass(type)
  (req, res, next) ->
    uuid = req.params.uuid
    obj = null
    Cls.search
      uuid: uuid
    , (err, results) ->
      if err
        next err
      else if results.length is 0
        next new HTTPError("Can't find a " + type + " with ID = " + uuid, 404)
      else if results.length > 1
        next new HTTPError("Too many " + type + " objects with ID = " + req.params.uuid, 500)
      else
        obj = results[0]
        if obj.hasOwnProperty("deleted")
          next new HTTPError("Deleted", 410)
        else
          obj.expand (err) ->
            if err
              next err
            else
              req[type] = obj
              next()



userOnly = (req, res, next) ->
  person = req.person
  user = req.remoteUser
  if person and user and user.profile and person.id is user.profile.id and user.profile.objectType is "person"
    next()
  else
    next new HTTPError("Only the user can modify this profile.", 403)

authorOnly = (type) ->
  (req, res, next) ->
    obj = req[type]
    if obj and obj.author and obj.author.id is req.remoteUser.profile.id
      next()
    else
      next new HTTPError("Only the author can modify this object.", 403)

authorOrRecipient = (type) ->
  (req, res, next) ->
    obj = req[type]
    user = req.remoteUser
    person = (if (user) then user.profile else null)
    if obj and obj.author and person and obj.author.id is person.id
      next()
    else
      Step (->
        Activity.postOf obj, this
      ), ((err, act) ->
        throw err  if err
        act.checkRecipient person, this
      ), (err, isRecipient) ->
        if err
          next err
        else if isRecipient
          next()
        else
          next new HTTPError("Only the author and recipients can view this object.", 403)


actorOnly = (req, res, next) ->
  act = req.activity
  if act and act.actor and act.actor.id is req.remoteUser.profile.id
    next()
  else
    next new HTTPError("Only the actor can modify this object.", 403)

actorOrRecipient = (req, res, next) ->
  act = req.activity
  person = (if (req.remoteUser) then req.remoteUser.profile else null)
  if act and act.actor and person and act.actor.id is person.id
    next()
  else
    act.checkRecipient person, (err, isRecipient) ->
      if err
        next err
      else unless isRecipient
        next new HTTPError("Only the actor and recipients can view this activity.", 403)
      else
        next()


getter = (type) ->
  (req, res, next) ->
    obj = req[type]
    Step (->
      obj.expandFeeds this
    ), (err) ->
      if err
        next err
      else
        res.json obj


putter = (type) ->
  (req, res, next) ->
    obj = req[type]
    act = new Activity(
      actor: req.remoteUser.profile
      verb: "update"
      object: _(obj).extend(req.body)
    )
    Step (->
      newActivity act, req.remoteUser, this
    ), (err, act) ->
      d = undefined
      if err
        next err
      else
        res.json act.object
        d = new Distributor(act)
        d.distribute (err) ->



deleter = (type) ->
  (req, res, next) ->
    obj = req[type]
    act = new Activity(
      actor: req.remoteUser.profile
      verb: "delete"
      object: obj
    )
    Step (->
      newActivity act, req.remoteUser, this
    ), (err, act) ->
      d = undefined
      if err
        next err
      else
        res.json "Deleted"
        d = new Distributor(act)
        d.distribute (err) ->



likes = (type) ->
  (req, res, next) ->
    obj = req[type]
    collection =
      displayName: "People who like " + obj.displayName
      id: URLMaker.makeURL("api/" + type + "/" + obj.uuid + "/likes")
      items: []

    args = undefined
    try
      args = streamArgs(req, DEFAULT_LIKES, MAX_LIKES)
    catch e
      next e
      return
    Step (->
      obj.favoritersCount this
    ), ((err, count) ->
      if err
        if err instanceof NoSuchThingError
          collection.totalItems = 0
          res.json collection
        else
          throw err
      collection.totalItems = count
      obj.getFavoriters args.start, args.end, this
    ), (err, likers) ->
      if err
        next err
      else
        collection.items = likers
        res.json collection


replies = (type) ->
  (req, res, next) ->
    obj = req[type]
    collection =
      displayName: "Replies to " + ((if (obj.displayName) then obj.displayName else obj.id))
      id: URLMaker.makeURL("api/" + type + "/" + obj.uuid + "/replies")
      items: []

    args = undefined
    try
      args = streamArgs(req, DEFAULT_REPLIES, MAX_REPLIES)
    catch e
      next e
      return
    Step (->
      obj.repliesCount this
    ), ((err, count) ->
      if err
        if err instanceof NoSuchThingError
          collection.totalItems = 0
          res.json collection
        else
          throw err
      collection.totalItems = count
      obj.getReplies args.start, args.end, this
    ), (err, replies) ->
      i = 0
      if err
        next err
      else
        
        # Trim the IRT since it's implied
        i = 0
        while i < replies.length
          delete replies[i].inReplyTo
          i++
        collection.items = replies
        res.json collection


getUser = (req, res, next) ->
  res.json req.user

putUser = (req, res, next) ->
  newUser = req.body
  req.user.update newUser, (err, saved) ->
    if err
      next err
    else
      saved.sanitize()
      res.json saved


delUser = (req, res, next) ->
  req.user.del (err) ->
    if err instanceof NoSuchThingError # unusual
      next new HTTPError(err.message, 404)
    else if err
      next err
    else
      bank.decr "usercount", 0, (err, value) ->
        if err
          next err
        else
          res.json "Deleted"



reqActivity = (req, res, next) ->
  act = null
  uuid = req.params.uuid
  Activity.search
    uuid: uuid
  , (err, results) ->
    if err
      next err
    else if results.length is 0 # not found
      next new HTTPError("Can't find an activity with id " + uuid, 404)
    else if results.length > 1
      next new HTTPError("Too many activities with ID = " + req.params.uuid, 500)
    else
      act = results[0]
      if act.hasOwnProperty("deleted")
        next new HTTPError("Deleted", 410)
      else
        act.expand (err) ->
          if err
            next err
          else
            req.activity = act
            next()



getActivity = (req, res, next) ->
  user = req.remoteUser
  act = req.activity
  act.sanitize user
  res.json act

putActivity = (req, res, next) ->
  req.activity.update req.body, (err, result) ->
    if err
      next err
    else
      res.json result


delActivity = (req, res, next) ->
  act = req.activity
  Step (->
    act.efface this
  ), (err) ->
    if err
      next err
    else
      res.json "Deleted"


createUser = (req, res, next) ->
  user = undefined
  Step (->
    User.create req.body, this
  ), ((err, value) ->
    throw err  if err
    user = value
    bank.prepend "userlist", 0, user.nickname, this
  ), ((err, userList) ->
    throw err  if err
    bank.incr "usercount", 0, this
  ), (err, userCount) ->
    if err
      next err
    else
      
      # Hide the password for output
      user.sanitize()
      res.json user


listUsers = (req, res, next) ->
  collection =
    displayName: "Users of this service"
    id: URLMaker.makeURL("api/users")
    objectTypes: ["user"]

  args = undefined
  try
    args = streamArgs(req, DEFAULT_USERS, MAX_USERS)
  catch e
    next e
    return
  Step (->
    bank.read "usercount", 0, this
  ), ((err, totalUsers) ->
    throw err  if err
    collection.totalItems = totalUsers
    bank.slice "userlist", 0, args.start, args.end, this
  ), ((err, userIds) ->
    if err
      if err instanceof NoSuchThingError # may catch err in prev func
        collection.totalItems = 0
        collection.items = []
        res.json collection
      else
        throw err
    else if userIds.length is 0
      collection.items = []
      res.json collection
    else
      bank.readAll "user", userIds, this
  ), (err, userMap) ->
    users = []
    id = undefined
    user = undefined
    throw err  if err
    for id of userMap
      user = new User(userMap[id])
      user.sanitize()
      users.push user
    users.sort (a, b) ->
      if a.published > b.published
        -1
      else if a.published < b.published
        1
      else
        0

    collection.items = users
    res.json collection


postActivity = (req, res, next) ->
  activity = new Activity(req.body)
  
  # Add a default actor
  activity.actor = req.user.profile  unless _(activity).has("actor")
  
  # If the actor is incorrect, error
  if activity.actor.id isnt req.user.profile.id
    next new HTTPError("Invalid actor", 400)
    return
  
  # Default verb
  activity.verb = "post"  if not _(activity).has("verb") or _(activity.verb).isNull()
  Step (->
    newActivity activity, req.user, this
  ), (err, activity) ->
    d = undefined
    if err
      next err
    else
      
      # ...then show (possibly modified) results.
      res.json activity
      
      # ...then distribute.
      d = new Distributor(activity)
      d.distribute (err) ->



postToInbox = (req, res, next) ->
  activity = new Activity(req.body)
  user = req.user
  
  # Check for actor
  next new HTTPError("Invalid actor", 400)  unless _(activity).has("actor")
  
  # If the actor is incorrect, error
  unless ActivityObject.sameID(activity.actor.id, req.webfinger)
    next new HTTPError("Invalid actor", 400)
    return
  
  # Default verb
  activity.verb = "post"  if not _(activity).has("verb") or _(activity.verb).isNull()
  
  # Add a received timestamp
  activity.received = Stamper.stamp()
  
  # TODO: return a 202 Accepted here?
  Step (->
    
    # First, ensure recipients
    activity.ensureRecipients this
  ), ((err) ->
    throw err  if err
    
    # apply the activity
    activity.apply null, this
  ), ((err) ->
    if err
      if err instanceof AppError
        throw new HTTPError(err.message, 400)
      else if err instanceof NoSuchThingError
        throw new HTTPError(err.message, 400)
      else if err instanceof AlreadyExistsError
        throw new HTTPError(err.message, 400)
      else if err instanceof NoSuchItemError
        throw new HTTPError(err.message, 400)
      else if err instanceof NotInStreamError
        throw new HTTPError(err.message, 400)
      else
        throw err
    
    # ...then persist...
    activity.save this
  ), ((err, saved) ->
    throw err  if err
    activity = saved
    user.addToInbox activity, @parallel()
  ), (err) ->
    if err
      next err
    else
      
      # ...then show (possibly modified) results.
      # XXX: don't distribute
      res.json activity


newActivity = (activity, user, callback) ->
  Step (->
    
    # First, ensure recipients
    activity.ensureRecipients this
  ), ((err) ->
    throw err  if err
    
    # First, apply the activity
    activity.apply user.profile, this
  ), ((err) ->
    if err
      if err instanceof AppError
        throw new HTTPError(err.message, 400)
      else if err instanceof NoSuchThingError
        throw new HTTPError(err.message, 400)
      else if err instanceof AlreadyExistsError
        throw new HTTPError(err.message, 400)
      else if err instanceof NoSuchItemError
        throw new HTTPError(err.message, 400)
      else if err instanceof NotInStreamError
        throw new HTTPError(err.message, 400)
      else
        throw err
    
    # ...then persist...
    activity.save this
  ), ((err, saved) ->
    throw err  if err
    activity = saved
    user.addToOutbox activity, @parallel()
    user.addToInbox activity, @parallel()
  ), (err) ->
    if err
      callback err, null
    else
      callback null, activity


recipientsOnly = (person) ->
  (id, callback) ->
    Step (->
      Activity.get id, this
    ), ((err, act) ->
      throw err  if err
      act.checkRecipient person, this
    ), callback


# Just do this one once
publicOnly = recipientsOnly(null)
userStream = (req, res, next) ->
  url = URLMaker.makeURL("api/user/" + req.user.nickname + "/feed")
  collection =
    author: req.user.profile
    displayName: "Activities by " + (req.user.profile.displayName or req.user.nickname)
    id: url
    objectTypes: ["activity"]
    url: url
    links:
      first: url
      self: url

    items: []

  args = undefined
  str = undefined
  ids = undefined
  try
    args = streamArgs(req, DEFAULT_ACTIVITIES, MAX_ACTIVITIES)
  catch e
    next e
    return
  Step (->
    
    # XXX: stuff this into User
    req.user.getOutboxStream this
  ), ((err, outbox) ->
    if err
      if err instanceof NoSuchThingError
        collection.totalItems = 0
        res.json collection
      else
        throw err
    else
      
      # Skip filtering if remote user == author
      if req.remoteUser and req.remoteUser.profile.id is req.user.profile.id
        str = outbox
      else unless req.remoteUser
        
        # XXX: keep a separate stream instead of filtering
        str = new FilteredStream(outbox, publicOnly)
      else
        str = new FilteredStream(outbox, recipientsOnly(req.remoteUser.profile))
      getStream str, args, collection, req.remoteUser, this
  ), (err) ->
    if err
      next err
    else
      collection.items.forEach (act) ->
        delete act.actor

      res.json collection


userInbox = (req, res, next) ->
  url = URLMaker.makeURL("api/user/" + req.user.nickname + "/inbox")
  collection =
    author: req.user.profile
    displayName: "Activities for " + (req.user.profile.displayName or req.user.nickname)
    id: url
    objectTypes: ["activity"]
    url: url
    links:
      first: url
      self: url

    items: []

  args = undefined
  str = undefined
  try
    args = streamArgs(req, DEFAULT_ACTIVITIES, MAX_ACTIVITIES)
  catch e
    next e
    return
  Step (->
    
    # XXX: stuff this into User
    req.user.getInboxStream this
  ), ((err, inbox) ->
    if err
      if err instanceof NoSuchThingError
        collection.totalItems = 0
        res.json collection
      else
        throw err
    else
      getStream inbox, args, collection, req.remoteUser, this
  ), (err) ->
    if err
      next err
    else
      res.json collection


getStream = (str, args, collection, user, callback) ->
  Step (->
    str.count this
  ), ((err, totalItems) ->
    throw err  if err
    collection.totalItems = totalItems
    if totalItems is 0
      callback null
      return
    if _(args).has("before")
      str.getIDsGreaterThan args.before, args.count, this
    else if _(args).has("since")
      str.getIDsLessThan args.since, args.count, this
    else
      str.getIDs args.start, args.end, this
  ), ((err, ids) ->
    if err
      if err instanceof NotInStreamError
        throw new HTTPError(err.message, 400)
      else
        throw err
    Activity.readArray ids, this
  ), (err, activities) ->
    if err
      callback err
    else
      activities.forEach (act) ->
        act.sanitize user

      collection.items = activities
      if activities.length > 0
        collection.links.prev = collection.url + "?since=" + encodeURIComponent(activities[0].id)
        collection.links.next = collection.url + "?before=" + encodeURIComponent(activities[activities.length - 1].id)  if (_(args).has("start") and args.start + activities.length < collection.totalItems) or (_(args).has("before") and activities.length >= args.count) or (_(args).has("since"))
      callback null


userFollowers = (req, res, next) ->
  collection =
    author: req.user.profile
    displayName: "Followers for " + (req.user.profile.displayName or req.user.nickname)
    id: URLMaker.makeURL("api/user/" + req.user.nickname + "/followers")
    objectTypes: ["person"]
    items: []

  args = undefined
  try
    args = streamArgs(req, DEFAULT_FOLLOWERS, MAX_FOLLOWERS)
  catch e
    next e
    return
  Step (->
    req.user.followerCount this
  ), ((err, count) ->
    if err
      if err instanceof NoSuchThingError
        collection.totalItems = 0
        res.json collection
      else
        throw err
    else
      collection.totalItems = count
      req.user.getFollowers args.start, args.end, this
  ), (err, people) ->
    base = "api/user/" + req.user.nickname + "/followers"
    if err
      next err
    else
      collection.items = people
      collection.startIndex = args.start
      collection.itemsPerPage = args.count
      collection.links =
        self:
          href: URLMaker.makeURL(base,
            offset: args.start
            count: args.count
          )

        current:
          href: URLMaker.makeURL(base)

      if args.start > 0
        collection.links.prev = href: URLMaker.makeURL(base,
          offset: Math.max(args.start - args.count, 0)
          count: Math.min(args.count, args.start)
        )
      if args.start + people.length < collection.totalItems
        collection.links.next = href: URLMaker.makeURL("api/user/" + req.user.nickname + "/following",
          offset: args.start + people.length
          count: args.count
        )
      res.json collection


userFollowing = (req, res, next) ->
  collection =
    author: req.user.profile
    displayName: "People that " + (req.user.profile.displayName or req.user.nickname) + " is following"
    id: URLMaker.makeURL("api/user/" + req.user.nickname + "/following")
    objectTypes: ["person"]
    items: []

  args = undefined
  try
    args = streamArgs(req, DEFAULT_FOLLOWING, MAX_FOLLOWING)
  catch e
    next e
    return
  Step (->
    req.user.followingCount this
  ), ((err, count) ->
    if err
      if err instanceof NoSuchThingError
        collection.totalItems = 0
        res.json collection
      else
        throw err
    else
      collection.totalItems = count
      req.user.getFollowing args.start, args.end, this
  ), (err, people) ->
    base = "api/user/" + req.user.nickname + "/following"
    if err
      next err
    else
      collection.items = people
      collection.startIndex = args.start
      collection.itemsPerPage = args.count
      collection.links =
        self:
          href: URLMaker.makeURL(base,
            offset: args.start
            count: args.count
          )

        current:
          href: URLMaker.makeURL(base)

      if args.start > 0
        collection.links.prev = href: URLMaker.makeURL(base,
          offset: Math.max(args.start - args.count, 0)
          count: Math.min(args.count, args.start)
        )
      if args.start + people.length < collection.totalItems
        collection.links.next = href: URLMaker.makeURL("api/user/" + req.user.nickname + "/following",
          offset: args.start + people.length
          count: args.count
        )
      res.json collection


newFollow = (req, res, next) ->
  act = new Activity(
    actor: req.user.profile
    verb: "follow"
    object: req.body
  )
  Step (->
    newActivity act, req.user, this
  ), (err, act) ->
    d = undefined
    if err
      next err
    else
      res.json act.object
      d = new Distributor(act)
      d.distribute (err) ->



userFavorites = (req, res, next) ->
  collection =
    author: req.user.profile
    displayName: "Things that " + (req.user.profile.displayName or req.user.nickname) + " has favorited"
    id: URLMaker.makeURL("api/user/" + req.user.nickname + "/favorites")
    items: []

  args = undefined
  try
    args = streamArgs(req, DEFAULT_FAVORITES, MAX_FAVORITES)
  catch e
    next e
    return
  Step (->
    req.user.favoritesCount this
  ), ((err, count) ->
    if err
      if err instanceof NoSuchThingError
        collection.totalItems = 0
        res.json collection
      else
        throw err
    else
      collection.totalItems = count
      req.user.getFavorites args.start, args.end, this
  ), (err, objects) ->
    if err
      next err
    else
      collection.items = objects
      res.json collection


newFavorite = (req, res, next) ->
  act = new Activity(
    actor: req.user.profile
    verb: "favorite"
    object: req.body
  )
  Step (->
    newActivity act, req.user, this
  ), (err, act) ->
    d = undefined
    if err
      next err
    else
      res.json act.object
      d = new Distributor(act)
      d.distribute (err) ->



userLists = (req, res, next) ->
  url = URLMaker.makeURL("api/user/" + req.user.nickname + "/lists")
  collection =
    author: req.user.profile
    displayName: "Lists for " + (req.user.profile.displayName or req.user.nickname)
    id: url
    objectTypes: ["collection"]
    url: url
    links:
      first: url
      self: url

    items: []

  args = undefined
  lists = undefined
  try
    args = streamArgs(req, DEFAULT_LISTS, MAX_LISTS)
  catch e
    next e
    return
  Step (->
    req.user.getLists this
  ), ((err, stream) ->
    throw err  if err
    lists = stream
    lists.count this
  ), ((err, totalItems) ->
    throw err  if err
    collection.totalItems = totalItems
    if totalItems is 0
      res.json collection
      return
    if _(args).has("before")
      lists.getIDsGreaterThan args.before, args.count, this
    else if _(args).has("since")
      lists.getIDsLessThan args.since, args.count, this
    else
      lists.getIDs args.start, args.end, this
  ), ((err, ids) ->
    if err
      if err instanceof NotInStreamError
        throw new HTTPError(err.message, 400)
      else
        throw err
    Collection.readArray ids, this
  ), (err, collections) ->
    if err
      next err
    else
      collection.items = collections
      if collections.length > 0
        collection.links.prev = collection.url + "?since=" + encodeURIComponent(collections[0].id)
        collection.links.next = collection.url + "?before=" + encodeURIComponent(collections[collections.length - 1].id)  if (_(args).has("start") and args.start + collections.length < collection.totalItems) or (_(args).has("before") and collections.length >= args.count) or (_(args).has("since"))
      res.json collection


notYetImplemented = (req, res, next) ->
  next new HTTPError("Not yet implemented", 500)


# Since most stream endpoints take the same arguments,
# consolidate validation and parsing here
streamArgs = (req, defaultCount, maxCount) ->
  args = {}
  try
    maxCount = 10 * defaultCount  if _(maxCount).isUndefined()
    if _(req.query).has("count")
      check(req.query.count, "Count must be between 0 and " + maxCount).isInt().min(0).max maxCount
      args.count = sanitize(req.query.count).toInt()
    else
      args.count = defaultCount
    
    # XXX: Check "before" and "since" for injection...?
    # XXX: Check "before" and "since" for URI...?
    if _(req.query).has("before")
      check(req.query.before).notEmpty()
      args.before = sanitize(req.query.before).trim()
    if _(req.query).has("since")
      throw new Error("Can't have both 'before' and 'since' parameters")  if _(args).has("before")
      check(req.query.since).notEmpty()
      args.since = sanitize(req.query.since).trim()
    if _(req.query).has("offset")
      throw new Error("Can't have both 'before' and 'offset' parameters")  if _(args).has("before")
      throw new Error("Can't have both 'since' and 'offset' parameters")  if _(args).has("since")
      check(req.query.offset, "Offset must be an integer greater than or equal to zero").isInt().min 0
      args.start = sanitize(req.query.offset).toInt()
    args.start = 0  if not _(req.query).has("offset") and not _(req.query).has("since") and not _(req.query).has("before")
    args.end = args.start + args.count  if _(args).has("start")
    return args
  catch e
    throw new HTTPError(e.message, 400)
