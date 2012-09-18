# OAuthDataProvider for activity spam server
#
# Copyright 2011, 2012 StatusNet Inc.
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
NoSuchThingError = require("databank").NoSuchThingError
_ = require("underscore")
url = require("url")
Step = require("step")
User = require("./model/user").User
RequestToken = require("./model/requesttoken").RequestToken
AccessToken = require("./model/accesstoken").AccessToken
Nonce = require("./model/nonce").Nonce
Client = require("./model/client").Client
TIMELIMIT = 300 # +/- 5 min seems pretty generous
REQUESTTOKENTIMEOUT = 600 # 10 min, also pretty generous
Provider = ->

_.extend Provider::,
  previousRequestToken: (token, callback) ->
    AccessToken.search
      request_token: token
    , (err, ats) ->
      if err
        callback err, null
      else if ats.length > 0
        callback new Error("Token has been used"), null
      else
        callback null, token


  tokenByConsumer: (consumerKey, callback) ->
    Client.get consumerKey, (err, client) ->
      if err
        callback err, null
      else
        RequestToken.search
          consumer_key: client.consumer_key
        , (err, rts) ->
          if rts.length > 0
            callback null, rts[0]
          else
            callback new Error("No RequestToken for that consumer_key"), null



  tokenByTokenAndConsumer: (token, consumerKey, callback) ->
    RequestToken.get token, (err, rt) ->
      if err
        callback err, null
      else if rt.consumer_key isnt consumerKey
        callback new Error("Consumer key mismatch"), null
      else
        callback null, rt


  applicationByConsumerKey: (consumerKey, callback) ->
    Client.get consumerKey, callback

  fetchAuthorizationInformation: (username, token, callback) ->
    RequestToken.get token, (err, rt) ->
      if err
        callback err, null, null
      else if not _(rt).has("username") or rt.username isnt username
        callback new Error("Request token not associated with username '" + username + "'"), null, null
      else
        Client.get rt.consumer_key, (err, client) ->
          if err
            callback err, null, null
          else
            client.title = "(Unknown)"  unless _(client).has("title")
            client.description = "(Unknown)"  unless _(client).has("description")
            callback null, client, rt



  validToken: (accessToken, callback) ->
    AccessToken.get accessToken, callback

  tokenByTokenAndVerifier: (token, verifier, callback) ->
    RequestToken.get token, (err, rt) ->
      if err
        callback err, null
      else if rt.verifier isnt verifier
        callback new Error("Wrong verifier"), null
      else
        callback null, rt


  validateNotReplayClient: (consumerKey, accessToken, timestamp, nonce, callback) ->
    now = Math.floor(Date.now() / 1000)
    ts = undefined
    try
      ts = parseInt(timestamp, 10)
    catch err
      callback err, null
      return
    if Math.abs(ts - now) > TIMELIMIT
      callback null, false
      return
    Step (->
      Client.get consumerKey, this
    ), ((err, client) ->
      throw err  if err
      unless accessToken
        this null, null
      else
        AccessToken.get accessToken, this
    ), ((err, at) ->
      throw err  if err
      throw new Error("consumerKey and accessToken don't match")  if at and at.consumer_key isnt consumerKey
      Nonce.seenBefore consumerKey, accessToken, nonce, timestamp, this
    ), (err, seen) ->
      if err
        callback err, null
      else
        callback null, not seen


  userIdByToken: (token, callback) ->
    user = undefined
    client = undefined
    at = undefined
    Step (->
      AccessToken.get token, this
    ), ((err, res) ->
      throw err  if err
      at = res
      Client.get at.consumer_key, this
    ), ((err, res) ->
      throw err  if err
      client = res
      User.get at.username, this
    ), (err, res) ->
      if err
        callback err, null
      else
        user = res
        callback null,
          id: at.username
          user: user
          client: client



  authenticateUser: (username, password, oauthToken, callback) ->
    User.checkCredentials username, password, (err, user) ->
      if err
        callback err, null
        return
      RequestToken.get oauthToken, (err, rt) ->
        if err
          callback err, null
          return
        if rt.username and rt.username isnt username
          callback new Error("Token already associated with a different user"), null
          return
        rt.authenticated = true
        rt.save (err, rt) ->
          if err
            callback err, null
          else
            callback null, rt




  associateTokenToUser: (username, token, callback) ->
    RequestToken.get token, (err, rt) ->
      if err
        callback err, null
        return
      if rt.username and rt.username isnt username
        callback new Error("Token already associated"), null
        return
      rt.update
        username: username
      , (err, rt) ->
        if err
          callback err, null
        else
          callback null, rt



  generateRequestToken: (oauthConsumerKey, oauthCallback, callback) ->
    if oauthCallback isnt "oob"
      parts = url.parse(oauthCallback)
      if not parts.host or not parts.protocol or (parts.protocol isnt "http:" and parts.protocol isnt "https:")
        callback new Error("Invalid callback URL"), null
        return
    Client.get oauthConsumerKey, (err, client) ->
      if err
        callback err, null
        return
      props =
        consumer_key: oauthConsumerKey
        callback: oauthCallback

      RequestToken.create props, callback


  generateAccessToken: (oauthToken, callback) ->
    RequestToken.get oauthToken, (err, rt) ->
      props = undefined
      if err
        callback err, null
      else unless rt.username
        callback new Error("Request token not associated"), null
      else if rt.access_token
        
        # XXX: search AccessToken instead...?
        callback new Error("Request token already used"), null
      else
        props =
          consumer_key: rt.consumer_key
          request_token: rt.token
          username: rt.username

        AccessToken.create props, (err, at) ->
          if err
            callback err, null
          else
            
            # XXX: delete...?
            rt.update
              access_token: at.access_token
            , (err, rt) ->
              if err
                callback err, null
              else
                callback null, at




  cleanRequestTokens: (consumerKey, callback) ->
    Step (->
      Client.get consumerKey, this
    ), ((err, client) ->
      throw err  if err
      RequestToken.search
        consumer_key: consumerKey
      , this
    ), ((err, rts) ->
      id = undefined
      now = Date.now()
      touched = undefined
      group = @group()
      throw err  if err
      for id of rts
        touched = Date.parse(rts[id].updated)
        # ms -> sec
        rts[id].del group()  if now - touched > (REQUESTTOKENTIMEOUT * 1000)
    ), (err) ->
      callback err, null


exports.Provider = Provider
