# Client for ActivityPump
#
# Copyright 2012 StatusNet Inc.
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
Stamper = require("../stamper").Stamper
crypto = require("crypto")
_ = require("underscore")
randomString = require("../randomstring").randomString
DatabankObject = databank.DatabankObject
NoSuchThingError = databank.NoSuchThingError
Client = DatabankObject.subClass("client")
Client.schema =
  pkey: "consumer_key"
  fields: ["title", "description", "host", "webfinger", "secret", "contacts", "logo_url", "redirect_uris", "type", "created", "updated"]
  indices: ["host", "webfinger"]

Client.keyPair = (callback) ->
  randomString 16, (err, consumer_key) ->
    if err
      callback err, null
    else
      randomString 32, (err, secret) ->
        if err
          callback err, null
        else
          callback null,
            consumer_key: consumer_key
            secret: secret





# For creating
Client.beforeCreate = (properties, callback) ->
  now = Stamper.stamp()
  properties.created = properties.updated = now
  if _(properties).has("host") and _(properties).has("webfinger")
    callback new Error("can't have both a 'host' and 'webfinger' property"), null
    return
  if properties.consumer_key
    callback null, properties
  else
    Client.keyPair (err, pair) ->
      if err
        callback err, null
      else
        properties.consumer_key = pair.consumer_key
        properties.secret = pair.secret
        callback null, properties


Client::beforeUpdate = (newClient, callback) ->
  now = Stamper.stamp()
  newClient.updated = now
  newClient.created = @created
  newClient.consumer_key = @consumer_key
  newClient.secret = @secret
  newClient.owner = @owner
  callback null, newClient

exports.Client = Client
