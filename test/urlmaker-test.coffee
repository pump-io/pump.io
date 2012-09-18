# urlmaker-test.js
#
# Test the urlmaker module
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
parseURL = require("url").parse
# NOT example.com:80

# parse query params too
vows.describe("urlmaker module interface").addBatch("When we require the urlmaker module":
  topic: ->
    require "../lib/urlmaker"

  "it exists": (urlmaker) ->
    assert.isObject urlmaker

  "and we get the URLMaker singleton":
    topic: (urlmaker) ->
      urlmaker.URLMaker

    "it exists": (URLMaker) ->
      assert.isObject URLMaker

    "it has a hostname property": (URLMaker) ->
      assert.include URLMaker, "hostname"

    "it has a port property": (URLMaker) ->
      assert.include URLMaker, "port"

    "it has a makeURL method": (URLMaker) ->
      assert.include URLMaker, "makeURL"
      assert.isFunction URLMaker.makeURL

    "and we make an URL":
      topic: (URLMaker) ->
        URLMaker.hostname = "example.com"
        URLMaker.port = 3001
        URLMaker.makeURL "login"

      "it exists": (url) ->
        assert.isString url

      "its parts are correct": (url) ->
        parts = parseURL(url)
        assert.equal parts.hostname, "example.com"
        assert.equal parts.port, 3001
        assert.equal parts.host, "example.com:3001"
        assert.equal parts.path, "/login"

    "and we set its properties to default port":
      topic: (URLMaker) ->
        URLMaker.hostname = "example.com"
        URLMaker.port = 80
        URLMaker.makeURL "login"

      "it exists": (url) ->
        assert.isString url

      "its parts are correct": (url) ->
        parts = parseURL(url)
        assert.equal parts.hostname, "example.com"
        assert.isUndefined parts.port
        assert.equal parts.host, "example.com"
        assert.equal parts.path, "/login"

    "and we include parameters":
      topic: (URLMaker) ->
        URLMaker.hostname = "example.com"
        URLMaker.port = 2342
        URLMaker.makeURL "/users",
          offset: 10
          count: 30


      "it exists": (url) ->
        assert.isString url

      "its parts are correct": (url) ->
        parts = parseURL(url, true)
        assert.equal parts.hostname, "example.com"
        assert.equal parts.port, 2342
        assert.equal parts.host, "example.com:2342"
        assert.equal parts.pathname, "/users"
        assert.isObject parts.query
        assert.include parts.query, "offset"
        assert.equal parts.query.offset, 10
        assert.include parts.query, "count"
        assert.equal parts.query.count, 30
)["export"] module
