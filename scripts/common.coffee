# common.js
#
# Common utilities for activityspam scripts
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
http = require("http")
querystring = require("querystring")
url = require("url")
config = require("./config")
OAuth = require("oauth").OAuth
_ = require("underscore")
postJSON = (serverUrl, payload, callback) ->
  req = undefined
  oa = undefined
  parts = undefined
  toSend = undefined
  pair = undefined
  callback = postReport(payload)  unless callback
  parts = url.parse(serverUrl)
  if not _(config).has("hosts") or not _(config.hosts).has(parts.hostname)
    callback new Error("No OAuth key for " + parts.hostname), null
    return
  pair = config.hosts[parts.hostname]
  # request token N/A for 2-legged OAuth
  # access token N/A for 2-legged OAuth
  oa = new OAuth(null, null, pair.key, pair.secret, "1.0", null, "HMAC-SHA1", null, # nonce size; use default
    "User-Agent": "activitypump/0.1"
  )
  toSend = JSON.stringify(payload)
  oa.post serverUrl, null, null, toSend, "application/json", (err, data, response) ->
    
    # Our callback has swapped args to OAuth module"s
    callback err, response, data


postReport = (payload) ->
  (err, res, body) ->
    if err
      if _(payload).has("id")
        console.log "Error posting payload " + payload.id
      else
        console.log "Error posting payload"
      console.error err
    else
      if _(payload).has("id")
        console.log "Results of posting " + payload.id + ": " + body
      else
        console.log "Results of posting: " + body

postArgs = (serverUrl, args, callback) ->
  requestBody = querystring.stringify(args)
  parts = url.parse(serverUrl)
  
  # An object of options to indicate where to post to
  options =
    host: parts.hostname
    port: parts.port
    path: parts.path
    method: "POST"
    headers:
      "Content-Type": "application/x-www-form-urlencoded"
      "Content-Length": requestBody.length
      "User-Agent": "activitypump/0.1.0dev"

  
  # Set up the request
  req = http.request(options, (res) ->
    body = ""
    err = null
    res.setEncoding "utf8"
    res.on "data", (chunk) ->
      body = body + chunk

    res.on "error", (err) ->
      callback err, null, null

    res.on "end", ->
      callback err, res, body

  )
  
  # post the data
  req.write requestBody
  req.end()

exports.postJSON = postJSON
exports.postReport = postReport
exports.postArgs = postArgs
