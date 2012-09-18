# nonce.js
#
# A nonce in an OAuth call
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
Step = require("step")
randomString = require("../randomstring").randomString
NoSuchThingError = databank.NoSuchThingError
Nonce = DatabankObject.subClass("nonce")
ignore = (err) ->

now = ->
  Math.floor Date.now() / 1000

Nonce.schema =
  pkey: "token_nonce"
  fields: ["nonce", "consumer_key", "access_token", "timestamp"]
  indices: ["consumer_key"]

exports.Nonce = Nonce
Nonce.pkey = ->
  "token_nonce"

Nonce.makeKey = (consumer_key, access_token, nonce, timestamp) ->
  if access_token
    consumer_key + "/" + access_token + "/" + timestamp.toString(10) + "/" + nonce
  else
    consumer_key + "/" + timestamp.toString(10) + "/" + nonce

Nonce.beforeCreate = (props, callback) ->
  callback new Error("Not enough properties"), null  if not _(props).has("consumer_key") or not _(props).has("timestamp") or not _(props).has("nonce")
  props.token_nonce = Nonce.makeKey(props.consumer_key, props.access_token or null, props.nonce, props.timestamp)
  callback null, props


# double the timestamp timeout in ../lib/provider.js, in seconds
TIMELIMIT = 600
Nonce.seenBefore = (consumer_key, access_token, nonce, timestamp, callback) ->
  key = Nonce.makeKey(consumer_key, access_token or null, nonce, parseInt(timestamp, 10))
  Step (->
    Nonce.get key, this
  ), ((err, found) ->
    props = undefined
    if err and (err instanceof NoSuchThingError) # database miss
      props =
        consumer_key: consumer_key
        nonce: nonce
        timestamp: parseInt(timestamp, 10)

      props.access_token = access_token  if access_token
      Nonce.create props, this
    else if err # regular old error
      throw err
    else
      callback null, true
  ), (err, nonce) ->
    if err
      callback err, null
    else
      callback err, false

  Nonce.cleanup consumer_key, ignore

Nonce.cleanup = (consumer_key, callback) ->
  Step (->
    Nonce.search
      consumer_key: consumer_key
    , this
  ), ((err, nonces) ->
    i = undefined
    nonce = undefined
    group = @group()
    c = 0
    throw err  if err
    i = 0
    while i < nonces.length
      nonce = nonces[i]
      if now() - nonce.timestamp > TIMELIMIT
        nonce.del group()
        c++
      i++
    
    # Nothing to delete
    callback null  if c is 0
  ), (err) ->
    if err
      callback err
    else
      callback null

