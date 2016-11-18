// routes/activitypub.js
//
// Suuuuper fancy new standards-based API
//
// Copyright 2016 Alex Jordan <alex@strugee.net>
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

var addRoutes = function(app) {

    // Users

    app.get("/activitypub/user/:nickname");

    // Inboxes

    app.get("/activitypub/user/:nickname/inbox");
    app.post("/activitypub/user/:nickname/inbox");

    // Outboxes

    app.get("/activitypub/user/:nickname/outbox");
    app.post("/activitypub/user/:nickname/outbox");

    // Following collections

    app.get("/activitypub/user/:nickname/following");

    // Followers collections

    app.get("/activitypub/user/:nickname/followers");

    // Likes collections

    app.get("/activitypub/user/:nickname/likes");

    // Binary uploads

    app.post("/activitypub/mediaUpload");

    // Public Inbox Delivery endpoint

    app.post("/activitypub/publicInbox");

    // TODO: do we need to do something special here for regular Object `id`s?
};

exports.addRoutes = addRoutes;
