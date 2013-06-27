// event-test.js
//
// Test the event module
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

var assert = require("assert"),
    vows = require("vows"),
    databank = require("databank"),
    URLMaker = require("../lib/urlmaker").URLMaker,
    modelBatch = require("./lib/model").modelBatch,
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject;

var suite = vows.describe("event module interface");

var testSchema = {
    pkey: "id",
    fields: ["_created",
             "_uuid",
             "attachments",
             "attending",
             "author",
             "content",
             "displayName",
             "downstreamDuplicates",
             "endTime",
             "id",
             "image",
             "inReplyTo",
             "likes",
             "links",
             "location",
             "maybeAttending",
             "notAttending",
             "objectType",
             "published",
             "replies",
             "shares",
             "startTime",
             "summary",
             "updated",
             "upstreamDuplicates",
             "url"],
    indices: ["_uuid", "url"]
};

var testData = {
    "create": {
        displayName: "Federation Hackfest 2012",
        url: "http://example.com/event/federation-hackfest-2012",
        summary: "Come hack with us!",
        location: {
            displayName: "Empire State Building",
            address: {
                streetAddress: "350 5th Avenue",
                locality: "New York",
                region: "New York",
                country: "USA"
            }
        },
        startTime: "2012-10-14T23:00:00Z",
        endTime: "2012-10-15T03:00:00Z",
        attending: [
            {
                id: "acct:evan@example.net",
                displayName: "Evan Prodromou",
                objectType: "person"
            }
        ]
    },
    "update": {
        summary: "Come <strong>hack</strong> with us!"
    }
};

suite.addBatch(modelBatch("event", "Event", testSchema, testData));

suite["export"](module);
