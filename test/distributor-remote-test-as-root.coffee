# distributor-remote-test-as-root.js
#
# Test distribution to remote servers
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
assert = require("assert")
vows = require("vows")
Step = require("step")
http = require("http")
querystring = require("querystring")
_ = require("underscore")
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
newCredentials = oauthutil.newCredentials
newClient = oauthutil.newClient
pj = httputil.postJSON
gj = httputil.getJSON
dialbackApp = require("./lib/dialback").dialbackApp
setupApp = oauthutil.setupApp
suite = vows.describe("distributor remote test")
suite.addBatch "When we set up two apps":
  topic: ->
    social = undefined
    photo = undefined
    callback = @callback
    Step (->
      setupApp 80, "social.localhost", @parallel()
      setupApp 80, "photo.localhost", @parallel()
    ), (err, social, photo) ->
      if err
        callback err, null, null
      else
        callback null, social, photo


  "it works": (err, social, photo) ->
    assert.ifError err

  teardown: (social, photo) ->
    social.close()  if social and social.close
    photo.close()  if photo and photo.close

  "and we register one user on each":
    topic: ->
      callback = @callback
      Step (->
        newCredentials "maven", "tasteful", "social.localhost", 80, @parallel()
        newCredentials "photog", "gritty", "photo.localhost", 80, @parallel()
      ), callback

    "it works": (err, cred1, cred2) ->
      assert.ifError err
      assert.isObject cred1
      assert.isObject cred2

    "and one user follows the other":
      topic: (cred1, cred2) ->
        url = "http://social.localhost/api/user/maven/feed"
        act =
          verb: "follow"
          object:
            id: "acct:photog@photo.localhost"
            objectType: "person"

        callback = @callback
        pj url, cred1, act, (err, body, resp) ->
          if err
            callback err, null
          else
            callback null, body


      "it works": (err, body) ->
        assert.ifError err
        assert.isObject body

      "and we check the first user's following list":
        topic: (body, cred1, cred2) ->
          url = "http://social.localhost/api/user/maven/following"
          callback = @callback
          gj url, cred1, (err, body, resp) ->
            if err
              callback err, null
            else
              callback null, body


        "it works": (err, feed) ->
          assert.ifError err
          assert.isObject feed

        "it includes the second user": (err, feed) ->
          assert.ifError err
          assert.isObject feed
          assert.include feed, "items"
          assert.isArray feed.items
          assert.lengthOf feed.items, 1
          assert.isObject feed.items[0]
          assert.include feed.items[0], "id"
          assert.equal feed.items[0].id, "acct:photog@photo.localhost"

suite["export"] module
