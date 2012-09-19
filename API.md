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
* Post to the user's activity outbox feed to create new
  activities. These can create new content, respond to existing
  content, or modify the social graph.
* Read from the user's activity inbox to see stuff that other people
  have sent to them.

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
user. The only form of authentication allowed for the activity outbox is
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
        "to": [{
            "id": "acct:ken@coding.example",
            "objectType": "person"
        }],
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

Posted activities may have side-effects; in the above case, the actor
"bwk" has followed another person, "ken", so that activities that
"ken" shares with his followers will also go to "bwk"'s inbox.

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

Reading from the activity outbox or activity inbox requires OAuth
authentication. The activity inbox requires user authorization; you
can request data from the activity outbox using plain old 2-legged
OAuth client authentication if you want.

`items` in collections are in roughly reverse chronological ("newest
first") order.

#### Arguments

Collection URLs can have arguments that change the size of the
collection. By default, the collection returned will include only the
most recent activities -- usually 20.

Collection URLs take the following params:

* *count*. The number of items to return (default is usually 20). This
   maxes out at 200, usually.
* *offset*. Zero-based offset specifying where in the collection you
   want to start. Default 0. This is a bad way to do pages, since
   activities are added at the beginning of the collection.
* *before*. An activity ID. Will get activities that went into the
   collection immediately before the specified activity (not
   inclusive). A good way to "scroll back" in a collection.
* *since*. An activity ID. Will get activities that went into the
   collection immediately before the specified activity (not
   inclusive). A good way to get what's new in a collection since you
   last polled it.

#### Navigation links

Collection objects include links to help with navigation, using the
[Multi-page Collections](http://activitystrea.ms/specs/json/schema/activity-schema.html#multipage-collections)
schema.

Note that because activities are in reverse chronological order,
understanding what's "next" or "previous" is kind of unintuitive. We
assume you start with the current activities and scroll backwards in
time, so "older" stuff is "next" and "newer" stuff is "prev".

* *next* The next _older_ group of activities.
* *prev* The next _newer_ group of activities. This is provided even
   if you're looking at the newest activities; it makes it easier to
   just get the most recent stuff you haven't seen.

It's a good idea to use these links if you're navigating through a
collection; the chances that both you and I will get all the arguments
correct in our heads is probably pretty small.

### Addressing activities

ActivityPump supports the
[Audience Targeting for JSON Activity Streams](http://activitystrea.ms/specs/json/targeting/1.0/)
extension, which lets you add addresses to an activity to show to whom
the activity is directed.

Address properties for an activity include `to`, `cc`, `bto`, and
`bcc`. The properties are arrays [] of objects {}. The objects should
include an `id` and `objectType` property; they may include other properties.

Activities that are `to` a user or list will go into their "direct"
inbox (see below).

`bto` and `bcc` properties won't be shown to any users except the author.

The ActivityPump uses the addresses for three things:

* *Delivery of activities*. Depending on the addresses, the activity
  will be delivered either to local user inboxes or to remote users
  (see below!).
* *Access control to activities*. Requesting an activity directly from
  its REST endpoint will give a 403 error. Also, feeds are filtered to
  only show activities that were addressed to the requester.
* *Access control to objects*. Access to objects generally depends on
  if the requester was a recipient of the "post" activity that created
  it. The REST endpoint for an object (see below) will return a 403
  status code otherwise.

Access control with addresses is inclusive; if an activity is to

#### Types of address

There are four types of address supported:

* *The public*. "The public" is an object with `objectType` equal to
   "collection" and the special ID
   "http://activityschema.org/collection/public". Activities addressed
   to the public will be delivered to all followers, and will be
   visible to anyone -- even unauthenticated users.
* *Followers*. A user's own followers can be addressed with an object
   with `objectType` equal to the follower stream URL of the user --
   usually
   `http://<hostname>/api/user/<nickname>/followers`. Activities
   addressed to followers will be delivered to all followers, and will
   only be visible to followers.
* *Users*. Users can be addressed by their profile object --
   `objectType` is person, and `id` is something like
   `acct:<nickname>@<hostname>`.
* *Lists*. Users can create collections of people or other objects. An
   address with `objectType` "collection" and the ID of one of the
   actor's own collections will result in delivery to the members of
   that list, and members of the list will be allowed to view the
   activity and/or object.

#### Default addresses

Default addresses are added if an activity is posted to the activity
outbox with no address properties. We try to be reasonable with the
defaults, as follows:

* If an activity has an object that is `inReplyTo` another object, the
  addresses for the "post" activity of the original are used.
* If an activity is an "update" or a "delete" of an object, the
  addresses for the "post" activity of that object are used.
* If an activity has an object that is a "person", the person is added
  as a `to` address.
* Otherwise, the actor's followers are added as a `cc` address.

These defaults will probably change over time; if you want to make
sure that specific addresses are used, you should definitely add them
explicitly.

## Object endpoints

When objects like a "note" or an "image" are created, they're assigned
a REST endpoint, usually something like
`http://<hostname>/api/<objectType>/<id>`, where the <id> is a
screwy-looking random value. (It's a UUID in URL-safe base-64 format.)

You can get the object endpoint from the object's `links` property;
it's the link with `rel` value `self`.

Objects respond to HTTP GET requests with an Activity Streams JSON
representation of the object.

The author of an object can PUT to the object endpoint; this will
update the object; it will also generate an "update" activity.

The author of an object can DELETE to the object endpoint; this will
delete the object. It will also generate a "delete" activity. Sending
a GET to an object endpoint for an object that was deleted will return
a 410 Gone status code.

### Links

Objects also have a `links` property; it's an array of objects.

* *self*. The canonical, true, real, one-and-only for-sure HTTP
   endpoint to retrieve an Activity Streams JSON representation of the
   object.

### Collections

Objects have related collections, as defined in the misnamed
[Responses for Activity Streams](http://activitystrea.ms/specs/json/replies/1.0/). These
particular properties are probably interesting:

* `replies`. Objects that were posted with an `inReplyTo` value of
  this object.
* `likes`. People who have sent a "favorite" activity with this object
  as the `object` property.

In representations, these collections will use have the first ~4 items
included in the `items`.

## Activity endpoints

## Authentication

## Client registration

## User registration

### User endpoints

## Discovery

## Major and minor feeds

## Direct inbox

## Remote delivery
