Data is stored as activity streams JSON only

Feeds are collections

URLs:

    /activity/{id} GET, HEAD, PUT, DELETE
    /user/{nickname} GET, HEAD, PUT, DELETE
    /user/{nickname}/feed GET, HEAD, POST
    /user/{nickname}/inbox GET, HEAD, POST
    /users GET, HEAD, POST 

id = 22-char URL-encoded base64 UUID (essentially a random non-incrementing ID)
nickname = immutable case-sensitive [a-zA-Z0-9.\-_]{1,64}

Feed filters:

    verb
    object.object-type
    object.id
    subject.object-type
    subject.id 

    EXAMPLES: /user/evan/feed?verb=follow (see who evan has followed)
              /user/evan/feed?verb=play&object.object-type=audio (see what audio evan has played)
	      /user/evan/inbox?verb=fave (what have people in evan's network faved)

Subcription: grant OAuth 2 access to post to inbox

