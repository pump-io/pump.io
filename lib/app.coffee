# app.js
#
# main function for activity pump application
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
auth = require("connect-auth")
databank = require("databank")
express = require("express")
_ = require("underscore")
api = require("../routes/api")
web = require("../routes/web")
webfinger = require("../routes/webfinger")
clientreg = require("../routes/clientreg")
schema = require("./schema").schema
HTTPError = require("./httperror").HTTPError
Provider = require("./provider").Provider
URLMaker = require("./urlmaker").URLMaker
Databank = databank.Databank
DatabankObject = databank.DatabankObject
makeApp = (config, callback) ->
  params = undefined
  port = config.port or 31337
  hostname = config.hostname or "127.0.0.1"
  db = undefined
  
  # Initiate the DB
  if _(config).has("params")
    params = config.params
  else
    params = {}
  if _(params).has("schema")
    _.extend params.schema, schema
  else
    params.schema = schema
  db = Databank.get(config.driver, params)
  
  # Connect...
  db.connect {}, (err) ->
    app = express.createServer()
    if err
      callback err, null
      return
    
    # Configuration
    app.configure ->
      
      # Templates are in public
      app.set "views", __dirname + "/../public/template"
      app.set "view engine", "utml"
      app.use express.logger()  if not _(config).has("nologger") or not config.nologger
      app.use express.bodyParser()
      app.use express.cookieParser()
      app.use express.query()
      app.use express.methodOverride()
      app.use express.session(secret: (config.secret or "activitypump"))
      app.use express.favicon()
      provider = new Provider()
      app.use (req, res, next) ->
        res.local "site", (if (config.site) then config.site else "ActivityPump")
        res.local "owner", (if (config.owner) then config.owner else "Anonymous")
        res.local "ownerurl", (if (config.ownerURL) then config.ownerURL else false)
        
        # Initialize null
        res.local "remoteUser", null
        res.local "user", null
        res.local "client", null
        res.local "nologin", false
        next()

      app.use auth([auth.Oauth(
        name: "client"
        oauth_provider: provider
        oauth_protocol: "http"
        authenticate_provider: null
        authorize_provider: null
        authorization_finished_provider: null
      ), auth.Oauth(
        name: "user"
        oauth_provider: provider
        oauth_protocol: "http"
        authenticate_provider: web.authenticate
        authorize_provider: web.authorize
        authorization_finished_provider: web.authorizationFinished
      )])
      app.use app.router
      app.use express["static"](__dirname + "/../public")

    app.error (err, req, res, next) ->
      if err instanceof HTTPError
        if req.xhr or req.originalUrl.substr(0, 5) is "/api/"
          res.json
            error: err.message
          , err.code
        else if req.accepts("html")
          res.render "error",
            status: err.code
            error: err
            title: "Error"

        else
          res.writeHead err.code,
            "Content-Type": "text/plain"

          res.end err.message
      else
        next err

    
    # Routes
    api.addRoutes app
    webfinger.addRoutes app
    clientreg.addRoutes app
    
    # Use "noweb" to disable Web site (API engine only)
    web.addRoutes app  if not _(config).has("noweb") or not config.noweb
    api.setBank db
    DatabankObject.bank = db
    URLMaker.hostname = hostname
    URLMaker.port = port
    if _(config).has("serverUser")
      app.on "listening", ->
        process.setuid config.serverUser

    app.run = (callback) ->
      self = this
      removeListeners = ->
        self.removeListener "listening", listenSuccessHandler
        self.removeListener "err", listenErrorHandler

      listenErrorHandler = (err) ->
        removeListeners()
        callback err

      listenSuccessHandler = ->
        removeListeners()
        callback null

      @on "error", listenErrorHandler
      @on "listening", listenSuccessHandler
      @listen port, hostname

    callback null, app


exports.makeApp = makeApp
