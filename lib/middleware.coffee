# middleware.js
#
# Some things you may need
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
Step = require("step")
_ = require("underscore")
bcrypt = require("bcrypt")
fs = require("fs")
Activity = require("./model/activity").Activity
User = require("./model/user").User
HTTPError = require("./httperror").HTTPError
NoSuchThingError = databank.NoSuchThingError

# If there is a user in the params, gets that user and
# adds them to the request as req.user
# also adds the user's profile to the request as req.profile
# Note: req.user != req.remoteUser
reqUser = (req, res, next) ->
  user = undefined
  Step (->
    User.get req.params.nickname, this
  ), ((err, results) ->
    if err
      if err instanceof NoSuchThingError
        throw new HTTPError(err.message, 404)
      else
        throw err
    user = results
    user.sanitize()
    req.user = user
    user.expand this
  ), (err) ->
    if err
      next err
    else
      req.person = user.profile
      next()


sameUser = (req, res, next) ->
  if not req.remoteUser or not req.user or req.remoteUser.nickname isnt req.user.nickname
    next new HTTPError("Not authorized", 401)
  else
    next()

maybeAuth = (req, res, next) ->
  
  # Set these up as default
  req.remoteUser = null
  res.local "remoteUser", null # init to null
  Step (->
    getCurrentUser req, res, this
  ), (err, user) ->
    if err
      next err
    else
      req.remoteUser = user
      res.local "remoteUser", user
      next()


mustAuth = (req, res, next) ->
  Step (->
    getCurrentUser req, res, this
  ), (err, user) ->
    if err
      next err
    else unless user
      next new Error("No logged-in user.")
    else
      req.remoteUser = user
      next()


noUser = (req, res, next) ->
  Step (->
    getCurrentUser req, res, this
  ), (err, user) ->
    if err
      next err
    else if user
      next new Error("Already logged in.")
    else
      req.remoteUser = null
      next()


getCurrentUser = (req, res, callback) ->
  if req.session.nickname
    getSessionUser req, res, callback
  else
    callback null, null

getSessionUser = (req, res, callback) ->
  Step (->
    User.get req.session.nickname, this
  ), (err, user) ->
    if err
      callback err, null
    else
      user.sanitize()
      callback null, user


checkCredentials = (nickname, password, callback) ->
  User.checkCredentials nickname, password, callback

exports.maybeAuth = maybeAuth
exports.reqUser = reqUser
exports.mustAuth = mustAuth
exports.sameUser = sameUser
exports.noUser = noUser
exports.checkCredentials = checkCredentials
exports.getCurrentUser = getCurrentUser
exports.getSessionUser = getSessionUser
