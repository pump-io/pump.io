// binary.js
//
// data object representing an binary
//
// Copyright 2012, E14N https://e14n.com/
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var _ = require("underscore"),
    DatabankObject = require("databank").DatabankObject,
    ActivityObject = require("./activityobject").ActivityObject;

var Binary = DatabankObject.subClass("binary", ActivityObject);

Binary.schema = ActivityObject.subSchema(null, ["compression",
                                                "data",
                                                "fileUrl",
                                                "length",
                                                "md5",
                                                "mimeType"]);

exports.Binary = Binary;
