# ActivityPump API

The ActivityPump API is based on three major technologies:

- [Activity Streams](http://activitystrea.ms/) for data format
- [OAuth 1.0](http://tools.ietf.org/html/rfc5849)
- [Web Host Metadata](http://tools.ietf.org/html/rfc6415)

There are some bits of other things floating around, like:

- [OpenID Connect Dynamic Client Registration](http://openid.net/specs/openid-connect-registration-1_0.html)
- [Dialback Access Authentication](http://tools.ietf.org/html/draft-prodromou-dialback-00)

Finally, the API uses
[REST](http://en.wikipedia.org/wiki/Representational_state_transfer)-ish
principles and follows some of the patterns, but none of the actual
requirements, of [The Atom Publishing Protocol](http://tools.ietf.org/html/rfc5023).

## TL;DR

Here's the quick start version of the API:

* Register a new OAuth client by posting to the client registration endpoint.
* Use OAuth 1.0 to get an OAuth token for the user.
* Post to the client's feed to create new activities. These can create
  new content, respond to existing content, or modify the social graph.
* Read the client's inbox to see stuff that other people have sent to
  them.

## Activity Streams

Activity Streams is a format for representing events or activities in
a social network or in collaborative software. It's a
[JSON](http://json.org/) format (at least, we only support the JSON
format), meaning that on the wire data looks like JavaScript literals.

Activity Streams data includes a few different kinds of things:

* objects: These represent real or digital objects. Every object has
  an `objectType` property; some common object types are "person",
  "note", "image", "place". There are some standard properties that
  all object types support, like `displayName` for an easy-to-use
  short text name, or `content` for HTML content representing the
  object. Some types have unique properties, like a "place", which has
  a `position` and an `address`. Every object has a unique `id`,
  which is a
  [URI](http://en.wikipedia.org/wiki/Uniform_resource_identifier) that
  identifies that object globally.
* activities: An activity is something that happened. It's like a
  sentence; it has an `actor`, who did the thing, a `verb` that is
  what happened, and an `object` which is what it happened
  to. Activities can also have some other properties, like a
  `location` or a `target`. Activities also have an `id` property that
  uniquely identifies the activity.
* collections: These are ordered lists of activities.

An example of an Activity Streams activity:

    {
        "id": "http://coding.example/api/activity/bwkposthw",
        "actor": {
            "id": "acct:bwk@coding.example",
            "displayName": "Brian Kernighan",
            "objectType": "person",
            "url": "http://coding.example/bwk"
        },
        "verb": "post",
        "object": {
            "id": "http://coding.example/api/note/helloworld",
            "content": "Hello, World!"
            "objectType": "note"
        },
        "published": "1973-01-01T00:00:00"
    }

This activity has an `id` to uniquely identify it, an `actor`, a
`verb`, and an `object`. It also has a publication timestamp,
`published`. The actor is a "person" with a name and an `id` that is
an "acct:" URI, as well as an `url` of a profile page. The object is a
"note".

The activity streams specification is long; there are also several
extensions that ActivityPump supports. The
[Activity Base Schema](http://activitystrea.ms/specs/json/schema/activity-schema.html)
lists some common object types and verbs.

It's possible to make new object types and new verbs by using full
URIs for the `objectType` or `verb` property. Unknown object types or
verbs will be stored but won't cause side-effects.

## Feed basics

Each user account on an ActivityPump has two main feeds:

* An *activity outbox* at `/api/user/<nickname>/feed`. This is where
  the user posts new activities, and where others can read the user's
  activities.
* An *activity inbox* at `/api/user/<nickname>/inbox`. This is where
  the user can read posts that were sent to him/her. Remote servers
  can post activities here to be delivered to the user (see below).

The feeds are
[collections](http://activitystrea.ms/specs/json/1.0/#collection) of
activities.

### Creating an activity

To create a new activity, a client posts the activity in JSON format
to the user's feed. The Activity Pump will automatically add IDs where
needed and the user's profile as an `actor`.

Here is a example HTTP request to create a new activity:

    POST /api/user/bwk/feed HTTP/1.1
    Host: coding.example
    Authorization: OAuth oauth_consumer_key="[...]",
        oauth_token="[...]", [...]
    Content-Type: application/json
    
    {
        "verb": "follow",
        "object": {
            "id": "acct:ken@coding.example",
            "objectType": "person"
        }
    }

Note that the request uses OAuth authorization to authenticate the
user. The only form of authentication allowed for the activity feed is
OAuth; the user must authorize the client before new activities are
created.

The HTTP response to this request will be a fully-defined activity
with all the IDs and timestamps filled in.

    HTTP/1.1 200 OK
    Content-Type: application/json

    {
        "id": "http://coding.example/api/activity/bwkflwken",
        "actor": {
            "id": "acct:bwk@coding.example",
            "objectType": "person",
            "displayName": "Brian Kernighan"
        },
        "verb": "follow",
        "object": {
            "id": "acct:ken@coding.example",
            "objectType": "person",
            "displayName": "Ken Thompson"
        },
        "published": "1974-01-01T00:00:00",
        "links": [
            {"rel": "self", "href": "http://coding.example/api/activity/bwkflwken"}
        ]
    }

Especially for finding links or IDs, the response can be really
valuable.

### Side-effects

Posted activities may have side-effects; in this case, the actor "bwk"
has followed another person, "ken", so that activities that "ken"
shares with his followers will also go to "bwk"'s inbox.

Most activity verbs *don't* have side-effects. In this case, the
ActivityPump will just store the data about the activity, and
distribute the activity according to the social graph, but it won't
change the state of that graph.

Verbs that have side-effects include:

* "post": Creates the object.
* "update": Modifies the object, if it exists, to have the new
  structure in this activity.
* "delete": Deletes the object. After a delete, only a shell of the
  data about the object will remain.
* "follow": Makes the actor follow the object. After a follow,
  activities that the object shares with his/her followers will go to
  the actor's inbox. Like a subscription. The actor is added to the
  object's followers collection, and the object is added to the
  actor's following collection.
* "stop-following": Makes the actor stop following the object. After
  this point, activities that the object shares with his/her followers
  will not go to the actor's inbox, but any existing activities will
  stay there.
* "favorite" or "like": These are synonyms. The actor is added to
  object's list of "likers", and the object is added to the actor's
  list of favorites.
* "unfavorite" or "unlike": Undoes a "like" or "favorite".
* "add": If the target is a collection that belongs to the actor, will
  add the object to the collection. Good for adding users to user lists.
* "remove": If the target is a collection that belongs to the actor, will
  add the object to the collection. Good for removing users from user lists.

Other verbs may have side-effects in the future -- especially the ones
around friendships, groups, events, and playing media.

### Reading collections

### Addressing activities

## Object endpoints

### Links

* Self

### Feeds

* Replies
* Likes

## Privacy

## Authentication

## Client registration

## User registration

## Discovery

## Major and minor feeds

## Server-to-server
