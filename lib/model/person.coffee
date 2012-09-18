# person.js
#
# data object representing an person
#
# Copyright 2011,2012 StatusNet Inc.
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
DatabankObject = require("databank").DatabankObject
ActivityObject = require("./activityobject").ActivityObject
Step = require("step")
Person = DatabankObject.subClass("person", ActivityObject)
Person.schema =
  pkey: "id"
  fields: ["displayName", "image", "published", "updated", "url", "uuid"]
  indices: ["uuid"]

Person::followersURL = (callback) ->
  person = this
  User = require("./user").User
  URLMaker = require("../urlmaker").URLMaker
  Step (->
    User.fromPerson person.id, this
  ), (err, user) ->
    if err
      callback err, null
    else unless user
      callback null, null
    else
      callback null, URLMaker.makeURL("api/user/" + user.nickname + "/followers")


exports.Person = Person
