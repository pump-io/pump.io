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
            if (_.isFunction(object[prop])) {
                return object[prop]();
            } else if (object[prop]) {
                return object[prop];
            } else if (object.has && object.has(prop)) {
                return object.get(prop);
            } else {
                return null;
            }
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
        toJSONRef: function() {
            var obj = this;
            return {
                id: obj.get(obj.idAttribute),
                objectType: obj.getObjectType()
            };
        },
        getObjectType: function() {
            var obj = this;
            return obj.get("objectType");
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

                json = obj.toJSONRef();

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
        set: function(props) {
            var model = this;
            if (_.has(props, "items")) {
                Pump.debug("Setting property 'items' for model " + model.id);
            }
            return Backbone.Model.prototype.set.apply(model, arguments);
        },
        merge: function(props) {
            var model = this,
                complicated = model.complicated();

            Pump.debug("Merging " + model.id + " with " + (props.id || props.url || props.nickname || "unknown"));

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
                key = props[cls.keyAttr];

            if (key && _.has(cls.cache, key)) {

                inst = cls.cache[key];
                // Check the updated flag
                inst.merge(props);

            } else {
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
            }

            return inst;
        },
        clearCache: function() {
            this.cache = {};
        }
    });

    // An array of objects, usually the "items" in a stream

    Pump.Items = Backbone.Collection.extend({
        constructor: function(models, options) {
            var items = this;
            // Use unique() to get unique items
            models = _.map(models, function(raw) {
                return items.model.unique(raw);
            });
            Backbone.Collection.apply(this, [models, options]);
        },
        url: function() {
            var items = this;
            return items.stream.url();
        },
        toJSON: function(seen) {
            var items = this;

            return items.map(function(item) {
                return item.toJSON(seen);
            });
        },
        merge: function(props) {
            var items = this,
                unique;

            if (_.isArray(props)) {
                Pump.debug("Merging items of " + items.url() + "of length " + items.length + " with array of length " + props.length);
                unique = props.map(function(item) {
                    return items.model.unique(item);
                });
                items.add(unique);
            } else {
                Pump.debug("Non-array passed to items.merge()");
            }
        }
    });

    // A stream of objects. It maps to the ActivityStreams collection
    // representation -- some wrap-up data like url and totalItems, plus an array of items.

    Pump.Stream = Pump.Model.extend({
        people: ['author'],
        itemsClass: Pump.Items,
        idAttribute: "url",
        getObjectType: function() {
            var obj = this;
            return "collection";
        },
        initialize: function() {
            var str = this,
                items = str.get('items');

            Pump.Model.prototype.initialize.apply(str);

            // We should always have items

            if (_.isArray(items)) {
                str.items = new str.itemsClass(items);
            } else {
                str.items = new str.itemsClass([]);
            }

            str.items.stream = str;

            str.on("change:items", function(newStr, items) {
                var str = this;
                Pump.debug("Resetting items of " + str.url() + " to new array of length " + items.length);
                str.items.reset(items);
            });
        },
        url: function() {
            var str = this;
            if (str.has('pump_io') && _.has(str.get('pump_io'), 'proxyURL')) {
                return str.get('pump_io').proxyURL;
            } else {
                return str.get('url');
            }
        },
        nextLink: function() {
            var str = this;
            if (str.has('links') && _.has(str.get('links'), 'next')) {
                return str.get('links').next.href;
            } else {
                return null;
            }
        },
        prevLink: function() {
            var str = this;
            if (str.has('links') && _.has(str.get('links'), 'prev')) {
                return str.get('links').prev.href;
            } else if (str.items && str.items.length > 0) {
                return str.url() + "?since=" + str.items.at(0).id;
            } else {
                return null;
            }
        },
        getPrev: function(callback) { // Get stuff later than the current group
            var stream = this,
                prevLink = stream.prevLink(),
                options;

            if (!prevLink) {
                if (_.isFunction(callback)) {
                    callback(new Error("Can't get prevLink for stream " + stream.url()), null);
                }
                return;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: prevLink,
                success: function(data) {
                    if (data.items) {
                        if (stream.items) {
                            stream.items.add(data.items, {at: 0});
                        } else {
                            stream.items = new stream.itemsClass(data.items);
                        }
                    }
                    if (data.links && data.links.prev && data.links.prev.href) {
                        if (stream.has('links')) {
                            stream.get('links').prev = data.links.prev;
                        } else {
                            stream.set('links', data.links);
                        }
                    }
                    if (_.isFunction(callback)) {
                        callback(null, data);
                    }
                },
                error: function(jqxhr) {
                    if (_.isFunction(callback)) {
                        callback(new Error("Failed getting more items for " + stream.url()), null);
                    }
                }
            };

            Pump.ajax(options);

        },
        getNext: function(callback) { // Get stuff earlier than the current group
            var stream = this,
                nextLink = stream.nextLink(),
                options;

            if (!nextLink) {
                if (_.isFunction(callback)) {
                    callback(new Error("Can't get nextLink for stream " + stream.url()), null);
                }
                return;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: nextLink,
                success: function(data) {
                    if (data.items) {
                        if (stream.items) {
                            // Add them at the end
                            stream.items.add(data.items, {at: stream.items.length});
                        } else {
                            stream.items = new stream.itemsClass(data.items);
                        }
                    }
                    if (data.links) {
                        if (data.links.next && data.links.next.href) {
                            if (stream.has('links')) {
                                stream.get('links').next = data.links.next;
                            } else {
                                stream.set('links', data.links);
                            }
                        } else {
                            if (stream.has('links')) {
                                delete stream.get('links').next;
                            }
                        }
                    }
                    if (_.isFunction(callback)) {
                        callback(null, data);
                    }
                },
                error: function(jqxhr) {
                    if (_.isFunction(callback)) {
                        callback(new Error("Failed getting more items for " + stream.url()), null);
                    }
                }
            };

            Pump.ajax(options);
        },
        getAll: function(callback) { // Get stuff later than the current group
            var stream = this,
                url = stream.url(),
                count,
                options;

            if (!url) {
                if (_.isFunction(callback)) {
                    callback(new Error("No url for stream"), null);
                }
                return;
            }

            if (_.isNumber(stream.get('totalItems'))) {
                count = Math.min(stream.get('totalItems'), 200);
            } else {
                count = 200;
            }

            options = {
                type: "GET",
                dataType: "json",
                url: url + "?count=" + count,
                success: function(data) {
                    if (data.items) {
                        if (stream.items) {
                            stream.items.add(data.items);
                        } else {
                            stream.items = new stream.itemsClass(data.items);
                        }
                    }
                    if (data.links && data.links.next && data.links.next.href) {
                        if (stream.has('links')) {
                            stream.get('links').next = data.links.next;
                        } else {
                            stream.set('links', data.links);
                        }
                    } else {
                        // XXX: end-of-collection indicator?
                    }
                    stream.trigger("getall");
                    if (_.isFunction(callback)) {
                        callback(null, data);
                    }
                },
                error: function(jqxhr) {
                    if (_.isFunction(callback)) {
                        callback(new Error("Failed getting all items for " + stream.url()), null);
                    }
                }
            };

            Pump.ajax(options);
        },
        toJSONRef: function() {
            var str = this;
            return {
                totalItems: str.get("totalItems"),
                url: str.get("url")
            };
        },
        toJSON: function(seen) {
            var str = this,
                url = str.get("url"),
                json,
                seenNow;

            json = Pump.Model.prototype.toJSON.apply(str, [seen]);

            if (!seen || (url && !_.contains(seen, url))) {

                if (seen) {
                    seenNow = seen.slice(0);
                } else {
                    seenNow = [];
                }

                if (url) {
                    seenNow.push(url);
                }

                json.items = str.items.toJSON(seenNow);
            }

            return json;
        },
        complicated: function() {
            var str = this,
                names = Pump.Model.prototype.complicated.apply(str);
            
            names.push("items");

            return names;
        }
    },
    {
        keyAttr: "url"
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
            return Date.parse(this.published);
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

    Pump.ActivityItems = Pump.Items.extend({
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

    Pump.ActivityStream = Pump.Stream.extend({
        itemsClass: Pump.ActivityItems
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

    // XXX: merge with Pump.Stream?

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

    Pump.ActivityObjectItems = Pump.Items.extend({
        model: Pump.ActivityObject
    });

    Pump.ActivityObjectStream = Pump.Stream.extend({
        itemsClass: Pump.ActivityObjectItems
    });

    Pump.ListItems = Pump.Items.extend({
        model: Pump.List
    });

    Pump.ListStream = Pump.Stream.extend({
        itemsClass: Pump.ListItems
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

    Pump.PeopleItems = Pump.Items.extend({
        model: Pump.Person
    });

    Pump.PeopleStream = Pump.ActivityObjectStream.extend({
        itemsClass: Pump.PeopleItems
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
                    return Pump.ActivityStream.unique({url: streamUrl(rel)});
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
