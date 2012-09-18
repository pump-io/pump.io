# oauth-test.js
#
# Test the client registration API
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
_ = require("underscore")
querystring = require("querystring")
http = require("http")
OAuth = require("oauth").OAuth
Browser = require("zombie")
httputil = require("./lib/http")
oauthutil = require("./lib/oauth")
setupApp = oauthutil.setupApp
requestToken = oauthutil.requestToken
newClient = oauthutil.newClient
register = oauthutil.register
accessToken = oauthutil.accessToken
ignore = (err) ->

suite = vows.describe("OAuth authorization")
suite.addBatch "When we set up the app":
  topic: ->
    cb = @callback
    config =
      port: 4815
      hostname: "localhost"
      driver: "memory"
      params: {}
      nologger: true

    makeApp = require("../lib/app").makeApp
    process.env.NODE_ENV = "test"
    makeApp config, (err, app) ->
      if err
        cb err, null
      else
        app.run (err) ->
          if err
            cb err, null
          else
            cb null, app



  teardown: (app) ->
    app.close()

  "it works": (err, app) ->
    assert.ifError err

  "and we try to get the authorization form without a request token":
    topic: ->
      cb = @callback
      options =
        host: "localhost"
        port: 4815
        path: "/oauth/authorize"

      http.get(options, (res) ->
        if res.statusCode >= 400 and res.statusCode < 500
          cb null
        else
          cb new Error("Unexpected status code")
      ).on "error", (err) ->
        cb err


    "it fails correctly": (err) ->
      assert.ifError err

  "and we try to get the authorization form with an invalid request token":
    topic: ->
      cb = @callback
      options =
        host: "localhost"
        port: 4815
        path: "/oauth/authorize?oauth_token=NOTAREQUESTTOKEN"

      http.get(options, (res) ->
        if res.statusCode >= 400 and res.statusCode < 500
          cb null
        else
          cb new Error("Unexpected status code")
      ).on "error", (err) ->
        cb err


    "it fails correctly": (err) ->
      assert.ifError err

  "and we try to get an access token without any OAuth credentials":
    topic: ->
      cb = @callback
      httputil.post "localhost", 4815, "/oauth/access_token", {}, (err, res, body) ->
        if err
          cb err
        else if res.statusCode is 400
          cb null
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we try to get an access token with an invalid client key":
    topic: ->
      cb = @callback
      oa = undefined
      oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", "NOTACLIENT", "NOTASECRET", "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
        "User-Agent": "activitypump-test/0.1.0"
      )
      oa.getOAuthAccessToken "NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", (err, token, secret) ->
        if err
          cb null
        else
          cb new Error("Unexpected success")


    "it fails correctly": (err) ->
      assert.ifError err

  "and we try to get an access token with an valid client key and invalid client secret":
    topic: ->
      cb = @callback
      Step (->
        newClient this
      ), (err, cl) ->
        throw err  if err
        oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, "NOTASECRET", "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
          "User-Agent": "activitypump-test/0.1.0"
        )
        oa.getOAuthAccessToken "NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", (err, token, secret) ->
          if err
            cb null, cl
          else
            cb new Error("Unexpected success"), null



    "it fails correctly": (err, cl) ->
      assert.ifError err

    teardown: (cl) ->
      cl.del ignore  if cl and cl.del

  "and we try to get an access token with an valid client key and valid client secret and invalid request token":
    topic: ->
      cb = @callback
      Step (->
        newClient this
      ), (err, cl) ->
        throw err  if err
        oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, cl.client_secret, "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
          "User-Agent": "activitypump-test/0.1.0"
        )
        oa.getOAuthAccessToken "NOTATOKEN", "NOTATOKENSECRET", "NOTAVERIFIER", (err, token, secret) ->
          if err
            cb null, cl
          else
            cb new Error("Unexpected success"), null



    "it fails correctly": (err, cl) ->
      assert.ifError err

    teardown: (cl) ->
      cl.del ignore  if cl and cl.del

  "and we try to get an access token with an valid client key and valid client secret and valid request token and invalid request token secret":
    topic: ->
      cb = @callback
      cl = undefined
      Step (->
        newClient this
      ), ((err, client) ->
        throw err  if err
        cl = client
        requestToken cl, this
      ), (err, rt) ->
        oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, cl.client_secret, "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
          "User-Agent": "activitypump-test/0.1.0"
        )
        oa.getOAuthAccessToken rt.token, "NOTATOKENSECRET", "NOTAVERIFIER", (err, token, secret) ->
          if err
            cb null,
              cl: cl
              rt: rt

          else
            cb new Error("Unexpected success"), null



    "it fails correctly": (err, res) ->
      assert.ifError err

    teardown: (res) ->
      res.cl.del ignore  if res.cl and res.cl.del
      res.rt.del ignore  if res.rt and res.rt.del

  "and we try to get an access token with an valid client key and valid client secret and valid request token and valid request token secret and invalid verifier":
    topic: ->
      cb = @callback
      cl = undefined
      Step (->
        newClient this
      ), ((err, client) ->
        throw err  if err
        cl = client
        requestToken cl, this
      ), (err, rt) ->
        oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, cl.client_secret, "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
          "User-Agent": "activitypump-test/0.1.0"
        )
        oa.getOAuthAccessToken rt.token, rt.token_secret, "NOTAVERIFIER", (err, token, secret) ->
          if err
            cb null,
              cl: cl
              rt: rt

          else
            cb new Error("Unexpected success"), null



    "it fails correctly": (err, res) ->
      assert.ifError err

    teardown: (res) ->
      res.cl.del ignore  if res.cl and res.cl.del
      res.rt.del ignore  if res.rt and res.rt.del

  "and we create a client using the api":
    topic: ->
      newClient @callback

    "it works": (err, cl) ->
      assert.ifError err
      assert.isObject cl
      assert.isString cl.client_id
      assert.isString cl.client_secret

    "and we create a user using the API":
      topic: (cl) ->
        cb = @callback
        httputil.postJSON "http://localhost:4815/api/users",
          consumer_key: cl.client_id
          consumer_secret: cl.client_secret
        ,
          nickname: "alice"
          password: "whiterabbit"
        , (err, user, resp) ->
          cb err, user


      "it works": (err, user) ->
        assert.ifError err
        assert.isObject user

      "and we request a request token with valid client_id and client_secret":
        topic: (user, cl) ->
          requestToken cl, @callback

        "it works": (err, cred) ->
          assert.ifError err
          assert.isObject cred

        "it has the right results": (err, cred) ->
          assert.include cred, "token"
          assert.isString cred.token
          assert.include cred, "token_secret"
          assert.isString cred.token_secret

        "and we get the authentication form":
          topic: (rt) ->
            cb = @callback
            Browser.runScripts = false
            Browser.visit "http://localhost:4815/oauth/authorize?oauth_token=" + rt.token, cb

          "it works": (err, browser) ->
            assert.ifError err
            assert.ok browser.success

          "it contains the login form": (err, browser) ->
            assert.ok browser.query("form#oauth-authentication")

          "and we submit the authentication form":
            topic: (browser) ->
              cb = @callback
              browser.fill "username", "alice", (err) ->
                if err
                  cb err
                else
                  browser.fill "password", "whiterabbit", (err) ->
                    if err
                      cb err
                    else
                      browser.pressButton "#authenticate", (err) ->
                        cb err, browser




            "it works": (err, browser) ->
              assert.ifError err
              assert.ok browser.success

            "it has the right location": (err, browser) ->
              assert.equal browser.location.pathname, "/oauth/authorize"

            "it contains the authorization form": (err, browser) ->
              assert.ok browser.query("form#authorize")

            "and we submit the authorization form":
              topic: (browser) ->
                cb = @callback
                browser.pressButton "Authorize", (err) ->
                  if err
                    cb err, null
                  else unless browser.success
                    cb new Error("Browser not successful"), null
                  else
                    cb null,
                      token: browser.text("#token")
                      verifier: browser.text("#verifier")



              "it works": (err, results) ->
                assert.ifError err

              "results include token and verifier": (err, results) ->
                assert.isString results.token
                assert.isString results.verifier

              "and we try to get an access token":
                topic: (pair) ->
                  cb = @callback
                  oa = undefined
                  rt = arguments_[5]
                  cl = arguments_[7]
                  oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, cl.client_secret, "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
                    "User-Agent": "activitypump-test/0.1.0"
                  )
                  oa.getOAuthAccessToken pair.token, rt.token_secret, pair.verifier, (err, token, secret) ->
                    if err
                      cb new Error(err.data), null
                    else
                      cb null,
                        token: token
                        token_secret: secret



                "it works": (err, pair) ->
                  assert.ifError err

                "results are correct": (err, pair) ->
                  assert.isObject pair
                  assert.include pair, "token"
                  assert.isString pair.token
                  assert.include pair, "token_secret"
                  assert.isString pair.token_secret

                "and we try to get another access token with the same data":
                  topic: ->
                    cb = @callback
                    oa = undefined
                    pair = arguments_[1]
                    rt = arguments_[6]
                    cl = arguments_[8]
                    oa = new OAuth("http://localhost:4815/oauth/request_token", "http://localhost:4815/oauth/access_token", cl.client_id, cl.client_secret, "1.0", "oob", "HMAC-SHA1", null, # nonce size; use default
                      "User-Agent": "activitypump-test/0.1.0"
                    )
                    oa.getOAuthAccessToken pair.token, rt.token_secret, pair.verifier, (err, token, secret) ->
                      if err
                        cb null
                      else
                        cb new Error("Unexpected success")


                  "it fails correctly": (err) ->
                    assert.ifError err

suite["export"] module
