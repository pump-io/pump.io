// dispatch.js
//
// Dispatches messages between workers
//
// Copyright 2012, StatusNet Inc.
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
        dsp.log = log.child({component: "dispatch"});
        _.each(cluster.workers, function(worker, id) {
            worker.on('message', function(msg) {
                switch (msg.cmd) {
                case "follow":
                    dsp.addFollower(msg.url, id);
                    break;
                case "unfollow":
                    dsp.removeFollower(msg.url, id);
                    break;
                case "update":
                    dsp.updateFollowers(msg.url, msg.activity);
                    break;
                default:
                    break;
                }
            });
        });
        dsp.log.info("Dispatch setup complete.");
    },
    followers: {},
    addFollower: function(url, id) {
        var dsp = this;
        if (!_.has(dsp.followers, url)) {
            dsp.followers[url] = [];
        }
        if (!_.contains(dsp.followers[url], id)) {
            dsp.log.info({url: url, id: id}, "Adding follower");
            dsp.followers[url].push(id);
        }
    },
    removeFollower: function(url, id) {
        var dsp = this,
            idx;
        if (_.has(dsp.followers, url)) {
            idx = dsp.followers[url].indexOf(id);
            if (idx !== -1) {
                dsp.log.info({url: url, id: id}, "Removing follower");
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
                    dsp.log.info({url: url, activity: activity.id, id: id}, "Dispatching to worker.");
                    worker.send({cmd: "update", url: url, activity: activity});
                }
            });
        }
    }
};

module.exports = Dispatch;