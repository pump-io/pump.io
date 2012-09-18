# routes/webfinger.js
#
# Endpoints for discovery using RFC 6415 and Webfinger
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
_ = require("underscore")
Step = require("step")
validator = require("validator")
check = validator.check
sanitize = validator.sanitize
HTTPError = require("../lib/httperror").HTTPError
URLMaker = require("../lib/urlmaker").URLMaker
User = require("../lib/model/user").User

# Initialize the app controller
addRoutes = (app) ->
  app.get "/.well-known/host-meta", hostMeta
  app.get "/.well-known/host-meta.json", hostMetaJSON
  app.get "/api/lrdd", lrddUser, lrdd
  app.get "/api/lrdd.json", lrddUser, lrddJSON

xmlEscape = (text) ->
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;").replace /'/g, "&amp;"

Link = (attrs) ->
  "<Link " + _(attrs).map((value, key) ->
    key + "=\"" + xmlEscape(value) + "\""
  ).join(" ") + " />"

hostMetaLinks = ->
  [
    rel: "lrdd"
    type: "application/xrd+xml"
    template: URLMaker.makeURL("/api/lrdd") + "?uri={uri}"
  ,
    rel: "lrdd"
    type: "application/json"
    template: URLMaker.makeURL("/api/lrdd.json") + "?uri={uri}"
  ]

hostMeta = (req, res, next) ->
  i = undefined
  links = undefined
  
  # Return JSON if accepted
  if _(req.headers).has("accept") and req.accepts("application/json")
    hostMetaJSON req, res, next
    return
  
  # otherwise, xrd
  links = hostMetaLinks()
  res.writeHead 200,
    "Content-Type": "application/xrd+xml"

  res.write "<?xml version='1.0' encoding='UTF-8'?>\n" + "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'>\n"
  i = 0
  while i < links.length
    res.write Link(links[i]) + "\n"
    i++
  res.end "</XRD>\n"

hostMetaJSON = (req, res, next) ->
  res.json links: hostMetaLinks()

lrddUser = (req, res, next) ->
  uri = undefined
  if not _(req).has("query") or not _(req.query).has("uri")
    next new HTTPError("No uri parameter", 400)
    return
  uri = req.query.uri
  parts = uri.match(/^(.*)@(.*)$/)
  unless parts
    next new HTTPError("Unrecognized uri parameter", 404)
    return
  unless parts[2] is URLMaker.hostname
    next new HTTPError("Unrecognized host", 404)
    return
  User.get parts[1], (err, user) ->
    if err and err instanceof databank.NoSuchThingError
      next new HTTPError(err.message, 404)
    else if err
      next err
    else
      req.user = user
      next()


lrddLinks = (user) ->
  [
    rel: "http://webfinger.net/rel/profile-page"
    type: "text/html"
    href: URLMaker.makeURL("/" + user.nickname)
  ]

lrdd = (req, res, next) ->
  i = undefined
  links = undefined
  if _(req.headers).has("accept") and req.accepts("application/json")
    lrddJSON req, res, next
    return
  links = lrddLinks(req.user)
  res.writeHead 200,
    "Content-Type": "application/xrd+xml"

  res.write "<?xml version='1.0' encoding='UTF-8'?>\n" + "<XRD xmlns='http://docs.oasis-open.org/ns/xri/xrd-1.0'>\n"
  i = 0
  while i < links.length
    res.write Link(links[i]) + "\n"
    i++
  res.end "</XRD>\n"

lrddJSON = (req, res, next) ->
  res.json links: lrddLinks(req.user)

exports.addRoutes = addRoutes
