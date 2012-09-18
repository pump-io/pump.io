# routes/web.js
#
# Spurtin' out pumpy goodness all over your browser window
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
url = require("url")
Step = require("step")
_ = require("underscore")
Activity = require("../lib/model/activity").Activity
RequestToken = require("../lib/model/requesttoken").RequestToken
User = require("../lib/model/user").User
mw = require("../lib/middleware")
he = require("../lib/httperror")
HTTPError = he.HTTPError
maybeAuth = mw.maybeAuth
reqUser = mw.reqUser
mustAuth = mw.mustAuth
sameUser = mw.sameUser
noUser = mw.noUser
checkCredentials = mw.checkCredentials
NoSuchThingError = databank.NoSuchThingError
addRoutes = (app) ->
  app.get "/", maybeAuth, showMain
  app.post "/main/login", noUser, handleLogin
  app.post "/main/logout", mustAuth, handleLogout
  app.get "/main/settings", mustAuth, showSettings
  app.get "/:nickname", maybeAuth, reqUser, showStream
  app.get "/:nickname/inbox", mustAuth, reqUser, sameUser, showInbox
  app.get "/:nickname/activity/:uuid", maybeAuth, reqUser, showActivity

showSettings = (req, res, next) ->
  res.render "settings",
    title: "Settings"


showMain = (req, res, next) ->
  res.render "main",
    title: "Welcome"


handleLogin = (req, res, next) ->
  Step (->
    checkCredentials req.body.nickname, req.body.password, this
  ), ((err, user) ->
    if err
      if err instanceof NoSuchThingError
        next new HTTPError("Not authorized", 403)
      else
        next err
    else unless user
      
      # done here
      next new HTTPError("Not authorized", 403)
    else
      user.expand this
  ), (err, user) ->
    if err
      next err
    else
      req.session.nickname = user.nickname
      user.sanitize()
      res.json user


handleLogout = (req, res, next) ->
  delete req.session.nickname

  res.json "OK"

showActivity = (req, res, next) ->
  uuid = req.params.uuid
  user = req.user
  Step (->
    Activity.search
      uuid: req.params.uuid
    , this
  ), ((err, activities) ->
    throw err  if err
    next new NoSuchThingError("activity", uuid)  if activities.length is 0
    next new Error("Too many activities with ID = " + req.params.uuid)  if activities.length > 1
    activities[0].expand this
  ), (err, activity) ->
    if err
      next err
    else
      res.render "activity",
        title: "Welcome"
        user: req.remoteUser
        activity: activity



showInbox = (req, res, next) ->
  Step (->
    req.user.getInbox 0, 20, this
  ), (err, activities) ->
    if err
      next err
    else
      res.render "inbox",
        title: "Inbox"
        user: req.remoteUser
        activities: activities



showStream = (req, res, next) ->
  pump = this
  Step (->
    req.user.getStream 0, 20, this
  ), (err, activities) ->
    if err
      next err
    else
      res.render "user",
        title: req.user.nickname
        user: req.remoteUser
        actor: req.user.profile
        activities: activities



authenticate = (req, res) ->
  
  # XXX: I think there's an easier way to get this, but leave it for now.
  parsedUrl = url.parse(req.originalUrl, true)
  token = parsedUrl.query.oauth_token
  unless token
    res.render "error",
      status: 400
      error: new HTTPError("Must provide an oauth_token", 400)
      title: "Error"

  else
    RequestToken.get token, (err, rt) ->
      if err
        res.render "error",
          status: 400
          error: err
          title: "Error"

      else
        res.render "authentication",
          title: "Authentication"
          token: token
          nologin: true
          error: false



authorize = (err, req, res, authorized, authResults, application, rt) ->
  self = this
  if err
    res.render "authentication",
      title: "Authentication"
      token: authResults.token
      status: 400
      nologin: true
      error: err.message

  else
    User.get rt.username, (err, user) ->
      res.render "authorization",
        title: "Authorization"
        token: authResults.token
        verifier: authResults.verifier
        user: user
        application: application



authorizationFinished = (err, req, res, result) ->
  res.render "authorization-finished",
    title: "Authorization Finished"
    token: result.token
    verifier: result.verifier


exports.addRoutes = addRoutes

# Need these for OAuth shenanigans
exports.authenticate = authenticate
exports.authorize = authorize
exports.authorizationFinished = authorizationFinished
