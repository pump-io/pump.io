# requesttoken.js
#
# An OAuth request token
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
databank = require("databank")
_ = require("underscore")
DatabankObject = databank.DatabankObject
Stamper = require("../stamper").Stamper
Step = require("step")
randomString = require("../randomstring").randomString
NoSuchThingError = databank.NoSuchThingError
RequestToken = DatabankObject.subClass("requesttoken")
RequestToken.schema =
  pkey: "token"
  fields: ["consumer_key", "callback", "used", "token_secret", "verifier", "authenticated", "username", "access_token", "created", "updated"]
  indices: ["access_token"]

exports.RequestToken = RequestToken
RequestToken.defaultCreate = RequestToken.create
RequestToken.create = (properties, callback) ->
  if not properties.consumer_key or not properties.callback
    callback new Error("Gotta have a consumer key and a callback."), null
    return
  Step (->
    randomString 16, @parallel()
    randomString 32, @parallel()
    randomString 16, @parallel()
  ), (err, token, token_secret, verifier) ->
    if err
      callback err, null
    else
      now = Stamper.stamp()
      _(properties).extend
        used: false
        token: token
        token_secret: token_secret
        verifier: verifier
        authenticated: false
        username: null
        access_token: null
        created: now
        updated: now

      RequestToken.defaultCreate properties, callback


RequestToken.beforeUpdate = (props, callback) ->
  props.updated = Stamper.stamp()
  callback null, props
