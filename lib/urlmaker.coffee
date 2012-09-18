# urlmaker.js
#
# URLs just like Mama used to make
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
url = require("url")
querystring = require("querystring")
URLMaker =
  hostname: null
  port: 80
  makeURL: (relative, params) ->
    obj =
      protocol: "http"
      hostname: @hostname
      pathname: relative

    throw new Error("No hostname")  unless @hostname
    obj.port = @port  if @port isnt 80
    obj.search = querystring.stringify(params)  if params
    url.format obj

exports.URLMaker = URLMaker
