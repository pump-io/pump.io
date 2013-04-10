// pump/model.js
//
// Backbone models for the pump.io client UI
//
// Copyright 2011-2012, E14N https://e14n.com/
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

(function(_, $, Backbone, Pump) {

    // Override backbone sync to use OAuth

    Backbone.sync = function(method, model, options) {

        var getValue = function(object, prop) {
            if (!(object && object[prop])) return null;
            return _.isFunction(object[prop]) ? object[prop]() : object[prop];
        };

        var methodMap = {
            'create': 'POST',
            'update': 'PUT',
            'delete': 'DELETE',
            'read':   'GET'
        };

        var type = methodMap[method];

        // Default options, unless specified.

        options = options || {};

        // Default JSON-request options.
        var params = {type: type, dataType: 'json'};

        // Ensure that we have a URL.

        if (!options.url) {

            if (type == 'POST') {
                params.url = getValue(model.collection, 'url');
            } else if (model.proxyURL) {
                params.url = model.proxyURL;
            } else {
                params.url = getValue(model, 'url');
            }

            if (!params.url || !_.isString(params.url)) { 
                throw new Error("No URL");
            }
        }

        // Ensure that we have the appropriate request data.
        if (!options.data && model && (method == 'create' || method == 'update')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(model.toJSON());
        }

        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !Backbone.emulateJSON) {
            params.processData = false;
        }

        params = _.extend(params, options);

        Pump.ajax(params);

        return null;
    };

    // A little bit of model sugar
    // Create Model attributes for our object-y things

    Pump.Model = Backbone.Model.extend({

        activityObjects: [],
        activityObjectBags: [],
        activityObjectStreams: [],
        activityStreams: [],
        peopleStreams: [],
        listStreams: [],
        people: [],

        initialize: function() {

            var obj = this,
                neverNew = function() { // XXX: neverNude
                    return false;
                },
                initer = function(obj, model) {
                    return function(name) {
                        var raw = obj.get(name);
                        if (raw) {
                            // use unique for cached stuff
                            if (model.unique) {
                                obj[name] = model.unique(raw);
                            } else {
                                obj[name] = new model(raw);
                            }
                            obj[name].isNew = neverNew;
                        }
                        obj.on("change:"+name, function(changed) {
                            var raw = obj.get(name);
                            if (obj[name] && obj[name].set) {
                                obj[name].set(raw);
                            } else if (raw) {
                                if (model.unique) {
                                    obj[name] = model.unique(raw);
                                } else {
                                    obj[name] = new model(raw);
                                }
                                obj[name].isNew = neverNew;
                            }
                        });
                    };
                };

            _.each(obj.activityObjects, initer(obj, Pump.ActivityObject));
            _.each(obj.activityObjectBags, initer(obj, Pump.ActivityObjectBag));
            _.each(obj.activityObjectStreams, initer(obj, Pump.ActivityObjectStream));
            _.each(obj.activityStreams, initer(obj, Pump.ActivityStream));
            _.each(obj.peopleStreams, initer(obj, Pump.PeopleStream));
            _.each(obj.listStreams, initer(obj, Pump.ListStream));
            _.each(obj.people, initer(obj, Pump.Person));
        },
        toJSON: function(seen) {

            var obj = this,
                id = obj.get(obj.idAttribute),
                json = _.clone(obj.attributes),
                jsoner = function(name) {
                    if (_.has(obj, name)) {
                        json[name] = obj[name].toJSON(seenNow);
                    }
                },
                seenNow;

            if (seen && id && _.contains(seen, id)) {

                json = {
                    id: obj.id,
                    objectType: obj.get("objectType")
                };

            } else {

                if (seen) {
                    seenNow = seen.slice(0);
                } else {
                    seenNow = [];
                }

                if (id) {
                    seenNow.push(id);
                }

                _.each(obj.activityObjects, jsoner);
                _.each(obj.activityObjectBags, jsoner);
                _.each(obj.activityObjectStreams, jsoner);
                _.each(obj.activityStreams, jsoner);
                _.each(obj.peopleStreams, jsoner);
                _.each(obj.listStreams, jsoner);
                _.each(obj.people, jsoner);
            }

            return json;
        },
        merge: function(props) {
            var model = this,
                complicated = model.complicated();

            _.each(props, function(value, key) {
                if (!model.has(key)) {
                    model.set(key, value);
                } else if (_.contains(complicated, key) && model[key] && _.isFunction(model[key].merge)) {
                    model[key].merge(value);
                } else {
                    // XXX: resolve non-complicated stuff
                }
            });
        },
        complicated: function() {
            var attrs = ["activityObjects", 
                         "activityObjectBags",
                         "activityObjectStreams",
                         "activityStreams",
                         "peopleStreams",
                         "listStreams",
                         "people"],
                names = [],
                model = this;

            _.each(attrs, function(attr) {
                if (_.isArray(model[attr])) {
                    names = names.concat(model[attr]);
                }
            });

            return names;
        }
    },
    {
        cache: {},
        keyAttr: "id", // works for activities and activityobjects
        unique: function(props) {
            var inst,
                cls = this,
                key = props[cls.keyAttr],
                cached;

            if (key && _.has(cls.cache, key)) {
                cached = cls.cache[key];
                // Check the updated flag
                if (_.has(props, "updated") && cached.has("updated")) {
                    // Latest received, so maybe the most recent...?
                    cached.merge(props);
                } else {
                    // Latest received, so maybe the most recent...?
                    cached.merge(props);
                }
            }

            inst = new cls(props);

            if (key) {
                cls.cache[key] = inst;
            }

            inst.on("change:"+cls.keyAttr, function(model, key) {
                var oldKey = model.previous(cls.keyAttr);
                if (oldKey && _.has(cls.cache, oldKey)) {
                    delete cls.cache[oldKey];
                }
                cls.cache[key] = inst;
            });

            return inst;
        },
        clearCache: function() {
            this.cache = {};
        }
    });

    // Our own collection. It's a little screwy; there are
    // a few ways to represent a collection in ActivityStreams JSON and
    // the "infinite stream" thing throws things off a bit too.

    Pump.Collection = Backbone.Collection.extend({
        constructor: function(models, options) {
            var coll = this;
            // If we're being initialized with a JSON Collection, parse it.
            if (_.isObject(models) && !_.isArray(models)) {
                models = coll.parse(models);
            }
            if (_.isObject(options) && _.has(options, "url")) {
                coll.url = options.url;
                delete options.url;
            }
            // Use unique() to get unique items
            models = _.map(models, function(raw) {
                return coll.model.unique(raw);
            });
            Backbone.Collection.apply(this, [models, options]);
        },
        parse: function(response) {
            if (_.has(response, "url")) {
                this.url = response.url;
            }
            if (_.has(response, "totalItems")) {
                this.totalItems = response.totalItems;
            }
            if (_.has(response, "links")) {
                if (_.has(response.links, "next")) {
                    this.nextLink = response.links.next.href;
                }
                if (_.has(response.links, "prev")) {
                    this.prevLink = response.links.prev.href;
                }
            }
            if (_.has(response, "pump_io")) {
                if (_.has(response.pump_io, "proxyURL")) {
                    this.proxyURL = response.pump_io.proxyURL;
                }
            }
            if (_.has(response, "items")) {
                return response.items;
            } else {
                return [];
            }
        },
        toJSON: function(seen) {
            var coll = this,
                seenNow,
                items;

            if (!seen) { // Top-level; return as array
                seenNow = [coll.url];
                items = coll.models.map(function(item) {
                    return item.toJSON(seenNow);
                });
                return items;
            } else if (_.contains(seen, coll.url)) {
                // Already seen; return as reference
                return {
                    url: coll.url,
                    totalItems: coll.totalItems
                };
            } else {
                seenNow = seen.slice(0);
                seenNow.push(coll.url);
                items = coll.models.slice(0, 4).map(function(item) {
                    return item.toJSON(seenNow);
                });
                return {
                    url: coll.url,
                    totalItems: coll.totalItems,
                    items: items
                };
            }
        },
        merge: function(models, options) {

            var coll = this,
                mapped,
                props = {};

            if (_.isArray(models)) {
                props.items = models;
                if (_.isObject(options)) {
                    props = _.extend(props, options);
                }
            } else if (_.isObject(models) && !_.isArray(models)) {
                props = _.extend(models, options);
            }

            if (_.has(props, "url") && !_.has(coll, "url")) {
                coll.url = props.url;
            }
            if (_.has(props, "totalItems") && !_.has(coll, "totalItems")) {
                coll.totalItems = props.totalItems;
            }
            if (_.has(props, "links")) {
                if (_.has(props.links, "next") && !_.has(coll, "nextLink")) {
                    coll.nextLink = props.links.next.href;
                }
                if (_.has(props.links, "prev") && !_.has(coll, "prevLink")) {
                    coll.prevLink = props.links.prev.href;
                }
                if (_.has(props.links, "self") && !_.has(coll, "url")) {
                    coll.url = props.links.self.href;
                }
            }

            if (_.has(props, "items")) {
                mapped = props.items.map(function(item) {
                    return coll.model.unique(item);
                });
                coll.add(mapped);
            }
        },
        getPrev: function(callback) { // Get stuff later than the current group
            var coll = this,
                url,
                options;

            if (coll.prevLink) {
                url = coll.prevLink;
            } else if (coll.url && coll.length > 0) {
                url = coll.url + "?since=" + coll.at(0).id;
            } else {
                Pump.error("Can't get prev for collection " + coll.url);
                return;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: url,
                success: function(data) {
                    if (data.items) {
                        coll.add(data.items, {at: 0});
                    }
                    if (data.links && data.links.prev && data.links.prev.href) {
                        coll.prevLink = data.links.prev.href;
                    }
                    if (_.isFunction(callback)) {
                        callback(null, data);
                    }
                },
                error: function(jqxhr) {
                    Pump.error("Failed getting more items for " + url);
                    if (_.isFunction(callback)) {
                        callback(new Error("Failed getting more items"), null);
                    }
                }
            };

            Pump.ajax(options);

        },
        getNext: function(callback) { // Get stuff earlier than the current group
            var coll = this,
                url,
                options;

            if (coll.nextLink) {
                url = coll.nextLink;
            } else if (coll.url && coll.length > 0) {
                url = coll.url + "?before=" + coll.at(coll.length - 1).id;
            } else {
                Pump.error("Can't get next for collection " + coll.url);
                return;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: url,
                success: function(data) {
                    if (data.items) {
                        coll.add(data.items, {at: coll.length});
                    }
                    if (data.links && data.links.next && data.links.next.href) {
                        coll.nextLink = data.links.next.href;
                    } else {
                        // XXX: end-of-collection indicator?
                        delete coll.nextLink;
                    }
                    if (_.isFunction(callback)) {
                        callback(null, data);
                    }
                },
                error: function(jqxhr) {
                    Pump.error("Failed getting more items for " + url);
                    if (_.isFunction(callback)) {
                        callback(new Error("Failed getting more items"), null);
                    }
                }
            };

            Pump.ajax(options);
        },
        getAll: function() { // Get stuff later than the current group
            var coll = this,
                url = (coll.proxyURL) ? coll.proxyURL : coll.url,
                count,
                options;

            if (!url) {
                // No URL
                return;
            }

            if (_.isNumber(coll.totalItems)) {
                count = Math.min(coll.totalItems, 200);
            } else {
                count = 200;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: url + "?count=" + count,
                success: function(data) {
                    if (data.items) {
                        coll.add(data.items);
                    }
                    if (data.links && data.links.next && data.links.next.href) {
                        coll.nextLink = data.links.next.href;
                    } else {
                        // XXX: end-of-collection indicator?
                        delete coll.nextLink;
                    }
                    coll.trigger("getall");
                },
                error: function(jqxhr) {
                    Pump.error("Failed getting more items.");
                }
            };

            Pump.ajax(options);
        }
    },
    {
        cache: {},
        keyAttr: "url", // works for in-model collections
        unique: function(models, options) {
            var inst,
                cls = this,
                key,
                cached;

            // If we're being initialized with a JSON Collection, parse it.
            if (_.isObject(models) && !_.isArray(models)) {
                key = models[cls.keyAttr];
            } else if (_.isObject(options) && _.has(options, cls.keyAttr)) {
                key = options[cls.keyAttr];
            }

            if (key && _.has(cls.cache, key)) {
                cached = cls.cache[key];
                cached.merge(models, options);
            }

            inst = new cls(models, options);

            if (key) {
                cls.cache[key] = inst;
            }

            inst.on("change:"+cls.keyAttr, function(model, key) {
                var oldKey = model.previous(cls.keyAttr);
                if (oldKey && _.has(cls.cache, oldKey)) {
                    delete cls.cache[oldKey];
                }
                cls.cache[key] = inst;
            });

            return inst;
        },
        clearCache: function() {
            this.cache = {};
        }
    });

    // A social activity.

    Pump.Activity = Pump.Model.extend({
        activityObjects: ['actor', 'object', 'target', 'generator', 'provider', 'location'],
        activityObjectBags: ['to', 'cc', 'bto', 'bcc'],
        url: function() {
            var links = this.get("links"),
                pump_io = this.get("pump_io"),
                uuid = this.get("uuid");
            if (pump_io && pump_io.proxyURL) {
                return pump_io.proxyURL;
            } else if (links && _.isObject(links) && links.self) {
                return links.self;
            } else if (uuid) {
                return "/api/activity/" + uuid;
            } else {
                return null;
            }
        },
        pubDate: function() {
            return new Date.parse(this.published);
        },
        initialize: function() {
            var activity = this;

            Pump.Model.prototype.initialize.apply(activity);

            // For "post" activities we strip the author
            // This adds it back in; important for uniquified stuff

            if (activity.verb == "post" &&
                activity.object &&
                !activity.object.author &&
                activity.actor) {
                activity.object.author = activity.actor;
            }
        }
    });

    Pump.ActivityStream = Pump.Collection.extend({
        model: Pump.Activity,
        add: function(models, options) {
            // Usually add at the beginning of the list
            if (!options) {
                options = {};
            }
            if (!_.has(options, 'at')) {
                options.at = 0;
            }
            Backbone.Collection.prototype.add.apply(this, [models, options]);
        },
        comparator: function(first, second) {
            var d1 = first.pubDate(),
                d2 = second.pubDate();
            if (d1 > d2) {
                return -1;
            } else if (d2 > d1) {
                return 1;
            } else {
                return 0;
            }
        }
    });

    Pump.ActivityObject = Pump.Model.extend({
        activityObjects: ['author', 'location', 'inReplyTo'],
        activityObjectBags: ['attachments', 'tags'],
        activityObjectStreams: ['likes', 'replies', 'shares'],
        url: function() {
            var links = this.get("links"),
                pump_io = this.get("pump_io"),
                uuid = this.get("uuid"),
                objectType = this.get("objectType");
            if (pump_io && pump_io.proxyURL) {
                return pump_io.proxyURL;
            } else if (links &&
                       _.isObject(links) && 
                       _.has(links, "self") &&
                       _.isObject(links.self) &&
                       _.has(links.self, "href") &&
                       _.isString(links.self.href)) {
                return links.self.href;
            } else if (objectType) {
                return "/api/"+objectType+"/" + uuid;
            } else {
                return null;
            }
        }
    });

    Pump.List = Pump.ActivityObject.extend({
        objectType: "collection",
        peopleStreams: ['members'],
        initialize: function() {
            Pump.Model.prototype.initialize.apply(this, arguments);
        }
    });

    Pump.Person = Pump.ActivityObject.extend({
        objectType: "person",
        activityObjectStreams: ['favorites'],
        listStreams: ['lists'],
        peopleStreams: ['followers', 'following'],
        initialize: function() {
            Pump.Model.prototype.initialize.apply(this, arguments);
        }
    });

    Pump.ActivityObjectStream = Pump.Collection.extend({
        model: Pump.ActivityObject
    });

    Pump.ListStream = Pump.Collection.extend({
        model: Pump.List
    });

    // Unordered, doesn't have an URL

    Pump.ActivityObjectBag = Backbone.Collection.extend({
        model: Pump.ActivityObject,
        merge: function(models, options) {
            var bag = this,
                Model = bag.model,
                mapped;
            mapped = models.map(function(item) {
                return Model.unique(item);
            });
            bag.add(mapped);
        }
    });

    Pump.PeopleStream = Pump.ActivityObjectStream.extend({
        model: Pump.Person
    });

    Pump.User = Pump.Model.extend({
        idAttribute: "nickname",
        people: ['profile'],
        initialize: function() {
            var user = this,
                streamUrl = function(rel) {
                    return Pump.fullURL("/api/user/" + user.get("nickname") + rel);
                },
                userStream = function(rel) {
                    return Pump.ActivityStream.unique([], {url: streamUrl(rel)});
                };

            Pump.Model.prototype.initialize.apply(this, arguments);

            // XXX: maybe move some of these to Person...?

            user.inbox =            userStream("/inbox");
            user.majorInbox =       userStream("/inbox/major");
            user.minorInbox =       userStream("/inbox/minor");
            user.directInbox =      userStream("/inbox/direct");
            user.majorDirectInbox = userStream("/inbox/direct/major");
            user.minorDirectInbox = userStream("/inbox/direct/minor");
            user.stream =           userStream("/feed");
            user.majorStream =      userStream("/feed/major");
            user.minorStream =      userStream("/feed/minor");

            user.on("change:nickname", function() {
                user.inbox.url            = streamUrl("/inbox");
                user.majorInbox.url       = streamUrl("/inbox/major");
                user.minorInbox.url       = streamUrl("/inbox/minor");
                user.directInbox.url      = streamUrl("/inbox/direct");
                user.majorDirectInbox.url = streamUrl("/inbox/direct/major");
                user.minorDirectInbox.url = streamUrl("/inbox/direct/minor");
                user.stream.url           = streamUrl("/feed");
                user.majorStream.url      = streamUrl("/feed/major");
                user.minorStream.url      = streamUrl("/feed/minor");
            });
        },
        isNew: function() {
            // Always PUT
            return false;
        },
        url: function() {
            return Pump.fullURL("/api/user/" + this.get("nickname"));
        }
    },
    {
        cache: {}, // separate cache
        keyAttr: "nickname", // cache by nickname
        clearCache: function() {
            this.cache = {};
        }
    });

})(window._, window.$, window.Backbone, window.Pump);
