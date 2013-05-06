// dispatch.js
//
// Dispatches messages between workers
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

var cluster = require("cluster"),
    _ = require("underscore");

var Dispatch = {
    log: null,
    start: function(log) {
        var dsp = this;

        if (log) {
            dsp.log = log.child({component: "dispatch"});
        }

        // If new workers fork, listen to those, too

        cluster.on("fork", function(worker) {
            dsp.setupWorker(worker);
        });

        // Listen to existing workers

        _.each(cluster.workers, function(worker, id) {
            dsp.setupWorker(worker);
        });

        if (dsp.log) dsp.log.info("Dispatch setup complete.");
    },
    setupWorker: function(worker) {
        var dsp = this;
        if (dsp.log) dsp.log.info({id: worker.id}, "Setting up worker.");
        worker.on('message', function(msg) {
            switch (msg.cmd) {
            case "follow":
                dsp.addFollower(msg.url, worker.id);
                break;
            case "unfollow":
                dsp.removeFollower(msg.url, worker.id);
                break;
            case "update":
                dsp.updateFollowers(msg.url, msg.activity);
                break;
            default:
                break;
            }
        });
    },
    followers: {},
    addFollower: function(url, id) {
        var dsp = this;
        if (!_.has(dsp.followers, url)) {
            dsp.followers[url] = [];
        }
        if (!_.contains(dsp.followers[url], id)) {
            if (dsp.log) dsp.log.info({url: url, id: id}, "Adding follower");
            dsp.followers[url].push(id);
        }
    },
    removeFollower: function(url, id) {
        var dsp = this,
            idx;
        if (_.has(dsp.followers, url)) {
            idx = dsp.followers[url].indexOf(id);
            if (idx !== -1) {
                if (dsp.log) dsp.log.info({url: url, id: id}, "Removing follower");
                dsp.followers[url].splice(idx, 1);
            }
        }
    },
    updateFollowers: function(url, activity) {
        var dsp = this;
        if (_.has(dsp.followers, url)) {
            _.each(dsp.followers[url], function(id) {
                var worker = cluster.workers[id];
                // XXX: clear out old subscriptions
                if (worker) {
                    if (dsp.log) dsp.log.info({url: url, activity: activity.id, id: id}, "Dispatching to worker.");
                    worker.send({cmd: "update", url: url, activity: activity});
                }
            });
        }
    }
};

module.exports = Dispatch;