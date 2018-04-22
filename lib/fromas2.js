// lib/fromas2.js
//
// Converts objects from activitystrea.ms library to as1
//
// Copyright 2018 E14N <https://e14n.com/>
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

"use strict";

var assert = require("assert");
var _ = require("lodash");
var Step = require("step");
var as2 = require("activitystrea.ms");

// We export a single function that converts an object from
// the activitystrea.ms library to a POJO that looks like AS1

var fromAS2 = module.exports = function fromAS2(imported, callback) {

    assert(_.isObject(imported));
    assert(imported instanceof as2.models.Base, "imported is not an AS2 object: " + imported);
    assert(_.isFunction(callback));

    var copy = {};

    if (isLink(imported)) {

        Step(
            function() {
                copyLinkProperties(imported, copy, this);
            },
            function(err) {
                if (err) throw err;
                this(null, copy);
            },
            callback
        );

    } else {

        Step(
            function() {
                copyObjectProperties(imported, copy, this);
            },
            function(err) {
                if (err) throw err;
                if (isActivity(imported)) {
                    copyActivityProperties(imported, copy, this);
                } else if (isActor(imported)) {
                    copyActorProperties(imported, copy, this);
                } else if (isCollection(imported)) {
                    copyCollectionProperties(imported, copy, this);
                } else if (isPage(imported)) {
                    copyPageProperties(imported, copy, this);
                } else if (isPlace(imported)) {
                    copyPlaceProperties(imported, copy, this);
                } else {
                    this(null);
                }
            },
            function(err) {
                if (err) throw err;
                copyActivityPubProperties(imported, copy, this);
            },
            function(err) {
                if (err) throw err;
                copyVcardProperties(imported, copy, this);
            },
            function(err) {
                if (err) throw err;
                copyCustomProperties(imported, copy, this);
            },
            function(err) {
                if (err) throw err;
                this(null, copy);
            },
            callback
        );
    }

    return undefined;
};

function copyObjectProperties(imported, copy, callback) {

    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));

    if (imported.type) {
        if (isActivity(imported)) {
            copy.verb = convertType(getType(imported));
        } else if (!isCollection(imported) && !isPage(imported)) {
            copy.objectType = convertType(getType(imported));
        }
    }

    if (imported.id && !isCollection(imported) && !isPage(imported)) {
        copy.id = imported.id;
        addLink(copy, "self", {href: copy.id});
    }

    if (imported.name) {
        copy.displayName = imported.name.get();
    }

    if (imported.summary) {
        copy.summary = imported.summary.get();
    }

    if (imported.published) {
        copy.published = isoDate(imported.published);
    }

    if (imported.updated) {
        copy.updated = isoDate(imported.updated);
    }

    if (imported.content) {
        copy.content = imported.content.get();

        // mediaType is only meaningful as an indicator of the content
        // media type, so only if content is defined. activitystrea.ms library
        // returns 'text/html' by default

        if (imported.get("mediaType")) {
            copy.dc = copy.dc || {};
            copy.dc.format = imported.get("mediaType");
        }
    }

    if (imported.endTime) {
        copy.endTime = isoDate(imported.endTime);
    }

    if (imported.startTime) {
        copy.startTime = isoDate(imported.startTime);
    }

    if (imported.duration) {
        copy.duration = imported.duration.get();
    }

    // Take the first of image or icon
    for (var iprop of ["image", "icon"]) {
        var member = imported.get(iprop);
        if (member && member.length >= 1 ) {
            var first = member.first;
            var link = null;
            if (isLink(first)) {
                link = first;
            } else if (first.url && first.url.length >= 1 && isLink(first.url.first)) {
                link = first.url.first;
            }
            if (link) {
                var image = copy.image = copy.image || {};
                if (link.href) {
                    image.url = link.href;
                }
                if (link.width) {
                    image.width = link.width;
                }
                if (link.height) {
                    image.height = link.height;
                }
            }
        }
    }

    // XXX: replies

    // Properties of an AS2 object that can be objects themselves

    var properties = [
        "attachment",
        "attributedTo",
        "audience",
        "context",
        "generator",
        "inReplyTo",
        "location",
        "preview",
        "to",
        "bto",
        "cc",
        "bcc",
        "tag"
    ];

    // Mapping object property names from AS2 to AS1

    var propertyMap = {
        "attachment": "attachments",
        "attributedTo": "author",
        "tag": "tags"
    };

    // Properties of AS2 objects that were only allowed on activities in AS1

    var activityProperties = [
        "generator",
        "to",
        "bto",
        "cc",
        "bcc"
    ];

    // Properties of AS2 object that have no analog in AS1

    var newProperties = [
        "audience",
        "context",
        "preview"
    ];

    // array values

    var arrayProperties = ["tag", "attachment"];

    Step(
        function() {
            if (imported.has("replies")) {
                fromAS2(imported.replies.first, this);
            } else {
                this(null, null);
            }
        },
        function(err, collcopy) {
            if (err) throw err;
            if (collcopy) {
                copy.replies = toCollectionProperty(collcopy);
            }
            this();
        },
        // For each object-y property, we import the property value to AS1
        function(err) {
            if (err) throw err;
            var group = this.group();
            _.each(properties, function(prop) {
                var cb = group();
                if (imported.has(prop)) {
                    Step(
                        function() {
                            var group = this.group();
                            var values = Array.from(imported[prop]);
                            _.each(values, function(value) {
                                fromAS2(value, group());
                            });
                        },
                        cb
                    );
                } else {
                    cb();
                }
            });
        },
        // For each object-y value, we add it to the parent object
        function(err, values) {
            if (err) throw err;
            _.each(values, function(value, i) {
                var prop = properties[i];
                if (_.isArray(value)) {
                    // If it came in just as a string, we use just a string.
                    value = _.map(value, maybeJustID);
                    if (value.length === 1 && arrayProperties.indexOf(prop) === -1) {
                        // We unwrap arrays, unless the property is defined as an array
                        value = value[0];
                    }
                    if (newProperties.indexOf(prop) !== -1 ||
                        (!isActivity(imported) && activityProperties.indexOf(prop) !== -1)) {
                        // New properties, or properties with new scope, get
                        // stored in an "as2" namespace object
                        copy.as2 = copy.as2 || {};
                        copy.as2[prop] = value;
                    } else {
                        // Some properties got renamed, so we keep those
                        var name = (_.has(propertyMap, prop)) ? propertyMap[prop] : prop;
                        copy[name] = value;
                    }
                }
            });
            this();
        },
        function(err) {
            if (err) throw err;
            // The "url" property in AS2 can go different places in AS1
            var group = this.group();
            if (imported.has("url")) {
                _.each(Array.from(imported.url), function(obj) {
                    fromAS2(obj, group());
                });
            } else {
                this(null, []);
            }
        },
        function(err, links) {
            if (err) throw err;
            links = _.map(links, maybeJustID);
            _.each(links, (link) => {
                if (_.isString(link)) {
                    addProperty(copy, "url", link);
                } else if (isAudio(imported) && isAudioMediaLink(link)) {
                    addProperty(copy, "stream", link);
                } else if (isVideo(imported) && isVideoMediaLink(link)) {
                    addProperty(copy, "stream", link);
                } else if (isHTMLMediaLink(link)) {
                    addProperty(copy, "url", link.url);
                } else if (isDocument(imported) && !_.has(copy, "fileUrl")) {
                    addProperty(copy, "fileUrl", link.url);
                    if (_.has(link, "dc.format")) {
                        addProperty(copy, "mimeType", _.get(link, "dc.format"));
                    }
                } else {
                    addLink(copy, "alternate", mediaLinkToLink(link));
                }
            });
            this();
        },
        callback
    );
}

function addLink(obj, rel, link) {
    obj.links = obj.links || {};
    if (_.isArray(obj.links[rel])) {
        obj.links[rel].push(link);
    } else if (_.isObject(obj.links[rel])) {
        obj.links[rel] = [obj.links[rel], link];
    } else {
        obj.links[rel] = link;
    }
}

function addProperty(obj, prop, value) {
    var current = _.get(obj, prop);
    if (_.isArray(current)) {
        _.set(obj, prop, _.concat(current, [value]));
    } else if (_.isObject(current) || _.isString(current) || _.isNumber(current)) {
        _.set(obj, prop, [current, value]);
    } else {
        _.set(obj, prop, value);
    }
}

var NS = "https://www.w3.org/ns/activitystreams#";

function getType(imported) {
    var full = String(imported.type);
    if (full.startsWith(NS)) {
        return full.substr(NS.length);
    } else {
        return full;
    }
}

var typeMap = {
    "Document": "file"
};

function convertType(str) {
    assert(_.isString(str));
    if (_.has(typeMap, str)) {
        return typeMap[str];
    } else if (str.startsWith(NS)) {
        return str.substr(NS.length).toLowerCase();
    } else {
        return str.toLowerCase();
    }
}

function isActivity(obj) {
    return false;
}

function isActor(obj) {
    return false;
}

function isLink(obj) {
    return ["Link", "Mention"].indexOf(getType(obj)) !== -1;
}

function isCollection(obj) {
    var type = getType(obj);
    return (type === "Collection" || type === "OrderedCollection");
}

function isPage(obj) {
    var type = getType(obj);
    return (type === "CollectionPage" || type === "OrderedCollectionPage");
}

function isAudio(obj) {
    var type = getType(obj);
    return (type === "Audio");
}

function isVideo(obj) {
    var type = getType(obj);
    return (type === "Video");
}

function isPlace(obj) {
    var type = getType(obj);
    return (type === "Place");
}

function isDocument(obj) {
    var type = getType(obj);
    // XXX: other types of documents?
    return ["Document", "Image"].indexOf(getType(obj)) !== -1;
}

function copyActivityProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isActivity(imported));
    var resolve = function resolve() {
        callback(null);
    };
    var reject = function reject(err) {
        assert(err instanceof Error, "err is not an Error");
        callback(err);
    };
    // XXX: actor
    // XXX: object
    // XXX: target
    // XXX: origin
    // XXX: result
    // XXX: instrument
    resolve();
}

function copyActorProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isActor(imported));
    var resolve = function resolve() {
        callback(null);
    };
    var reject = function reject(err) {
        assert(_.isInstanceOf(err, "Error"));
        callback(err);
    };
    // XXX: any actor properties?
    resolve();
}

// Copy the properties of an AS2 Link object to an AS1 Media Link object

function copyLinkProperties(imported, copy, callback) {

    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isLink(imported));

    if (imported.href) {
        copy.url = imported.href;
    }

    if (imported.height) {
        copy.height = imported.height;
    }

    if (imported.width) {
        copy.width = imported.width;
    }

    if (imported.name) {
        copy.dc = copy.dc || {};
        copy.dc.title = imported.name.get();
    }

    if (imported.hreflang) {
        copy.dc = copy.dc || {};
        copy.dc.language = imported.hreflang;
    }

    if (imported.mediaType) {
        copy.dc = copy.dc || {};
        copy.dc.format = imported.mediaType;
    }

    if (imported.rel) {
        copy.as2 = copy.as2 || {};
        copy.as2.rel = imported.rel;
    }

    if (imported.has("preview")) {
        Step(
            function() {
                var group = this.group();
                // XXX: activitystrea.ms library doesn't have preview accessor
                _.each(Array.from(imported.get("preview")), function(asobj) {
                    asobj.export(group());
                });
            },
            function(err, previews) {
                if (err) throw err;
                copy.as2 = copy.as2 || {};
                if (previews.length > 1) {
                    copy.as2.preview = _.map(previews, function(preview) {
                        return _.omit(preview, ["@context"]);
                    });
                } else {
                    copy.as2.preview = _.omit(previews[0], ["@context"]);
                }
                this(null);
            },
            callback
        );
    } else {
        callback(null);
    }
}

function copyActivityPubProperties(imported, copy, callback) {

    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));

    // XXX: source

    if (imported.inbox) {
        copy.links = copy.links || {};
        copy.links["activity-inbox"] = {href: imported.inbox.first.id};
    }

    if (imported.outbox) {
        copy.links = copy.links || {};
        copy.links["activity-outbox"] = {href: imported.outbox.first.id};
    }

    if (imported.preferredUsername) {
        copy.preferredUsername = imported.preferredUsername;
    }

    // XXX: streams
    // XXX: endpoints
    // XXX: proxyUrl
    // XXX: oauthAuthorizationEndpoint
    // XXX: oauthTokenEndpoint
    // XXX: provideClientKey
    // XXX: signClientKey
    // XXX: sharedInbox

    var collections = ["following", "followers", "liked", "shares", "likes"];

    Step(
        function() {
            var group = this.group();
            _.each(collections, function(coll) {
                if (imported.has(coll) && imported[coll].length > 0) {
                    fromAS2(imported[coll].first, group());
                } else {
                    group()();
                }
            });
        },
        function(err, copies) {
            if (err) throw err;
            _.each(copies, function(collcopy, i) {
                if (collcopy) {
                    if (collections[i] === "liked") {
                        copy.favorites = toCollectionProperty(collcopy);
                    } else {
                        copy[collections[i]] = toCollectionProperty(collcopy);
                    }
                }
            });
            this();
        },
        callback
    );

}

function copyCollectionProperties(imported, copy, callback) {

    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isCollection(imported));

    var resolve = function resolve() {
        callback(null);
    };

    var reject = function reject(err) {
        assert(_.isInstanceOf(err, "Error"));
        callback(err);
    };

    if (imported.has("totalItems")) {
        copy.totalItems = imported.totalItems;
    }

    var props = ["first", "last", "current"];
    var aprops = ["items", "orderedItems"];

    Step(
        function() {
            var group = this.group();
            _.each(props, function(prop) {
                var cb = group();
                if (imported.has(prop)) {
                    fromAS2(imported[prop].first, cb);
                } else {
                    cb();
                }
            });
        },
        function(err, results) {
            if (err) throw err;
            _.each(props, function(prop, i) {
                if (results[i]) {
                    addLink(copy, prop, results[i].url);
                }
            });
            this();
        },
        function(err) {
            if (err) throw err;
            var self = this;
            var group = null;
            _.each(aprops, function(aprop) {
                if (imported.has(aprop)) {
                    if (!group) group = self.group();
                    _.each(Array.from(imported[aprop]), (item) => {
                        fromAS2(item, group());
                    });
                }
            });
            if (!group) {
                this(null, []);
            }
        },
        function(err, results) {
            if (err) throw err;
            if (results && results.length > 0) {
                copy.items = results;
            }
            this();
        },
        function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        }
    );
}

function copyPageProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isPage(imported));
    var resolve = function resolve() {
        callback(null);
    };
    var reject = function reject(err) {
        assert(_.isInstanceOf(err, "Error"));
        callback(err);
    };
    // XXX: collection properties
    // XXX: partOf
    // XXX: next
    // XXX: prev
    resolve();
}

var customCopiers = {

};

function copyCustomProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    var type = getType(imported);
    if (_.has(customCopiers, type)) {
        customCopiers[type](imported, copy, callback);
    } else {
        callback(null);
    }
}

var VCARD_NS = "http://www.w3.org/2006/vcard/ns#";

function copyVcardProperties(imported, copy, callback) {

    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(_.isFunction(imported[Symbol.iterator]));

    var it = imported[Symbol.iterator]();

    for (var prop = it.next(); !prop.done; prop = it.next()) {
        var key = prop.value;
        if (key.startsWith(VCARD_NS)) {
            var short = key.substr(VCARD_NS.length);
            var value = imported.get(key);
            copy.vcard = copy.vcard || {};
            copy.vcard[short] = value.first;
        }
    }

    callback(null);
}

function isoDate(property) {
    assert(property);
    var value = property.get();
    assert(value);
    return value.toDate().toISOString();
}

// Turn a collection object into a property

function toCollectionProperty(obj) {
    var res = {};
    if (_.has(obj, "links.self.href")) {
        res.url = _.get(obj, "links.self.href");
    } else if (_.has(obj, "url")) {
        res.url = obj.url;
    }
    if (_.has(obj, "links")) {
        var others = _.omit(obj.links, "self");
        if (_.keys(others).length > 0) {
            res.links = others;
        }
    }
    // Copy everything else
    _.assign(res, _.omit(obj, ["links", "url", "id", "objectType"]));
    return res;
}

// Convert an AS1 Media Link object to an AS1 Link object

function mediaLinkToLink(ml) {

    var link = {};

    var map = {
        href: "url",
        hreflang: "dc.language",
        title: "dc.title",
        type: "dc.format"
    };

    _.each(map, function(value, key) {
        if (_.has(ml, value)) {
            link[key] = _.get(ml, value);
        }
    });

    return link;
}

function isAudioMediaLink(ml) {
    var type = _.get(ml, "dc.format");
    return (_.isString(type) && type.startsWith("audio/"));
}

function isVideoMediaLink(ml) {
    var type = _.get(ml, "dc.format");
    return (_.isString(type) && type.startsWith("video/"));
}

function isHTMLMediaLink(ml) {
    var type = _.get(ml, "dc.format");
    return (_.isString(type) && type.startsWith("text/html"));
}

// Convert objects that have only an id and a links.self.href to a string.

function maybeJustID(obj) {
    assert(_.isObject(obj));
    if (_.isEqual(_.keys(obj), ["id", "links"]) &&
        _.isObject(obj.links) &&
        _.isEqual(_.keys(obj.links), ["self"]) &&
        _.isObject(obj.links.self) &&
        _.isEqual(_.keys(obj.links.self), ["href"]) &&
        _.isEqual(obj.id, obj.links.self.href)) {
        return obj.id;
    } else {
        return obj;
    }
}

function copyPlaceProperties(imported, copy, callback) {
    assert(_.isObject(imported));
    assert(_.isObject(copy));
    assert(_.isFunction(callback));
    assert(isPlace(imported));

    if (imported.has("latitude")) {
        addProperty(copy, "position.latitude", imported.get("latitude"));
    }

    if (imported.has("longitude")) {
        addProperty(copy, "position.longitude", imported.get("longitude"));
    }

    if (imported.has("units")) {
        addProperty(copy, "as2.units", imported.get("units"));
    }

    if (imported.has("accuracy")) {
        addProperty(copy, "as2.accuracy", imported.get("accuracy"));
    }

    if (imported.has("radius")) {
        addProperty(copy, "as2.radius", imported.get("radius"));
    }

    // altitude in AS1 is always in meters above sea level

    if (imported.has("altitude")) {
        var alt = imported.get("altitude");
        var units = imported.get("units");
        var altInMeters = toMeters(alt, units);
        addProperty(copy, "position.altitude", altInMeters);
    }

    callback(null);
}

var multiplier = {
    "cm": 0.01,
    "feet": 0.3048,
    "inches": 0.0254,
    "km": 1000,
    "m": 1,
    "miles": 1609.34
};

function toMeters(count, units) {
    // Default units are meters
    if (!units) {
        return count;
    }
    // XXX: do something smarter with unrecognized units
    if (!_.has(multiplier, units)) {
        return undefined;
    }
    return multiplier[units] * count;
}
