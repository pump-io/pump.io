### pump.io Docker image

There are at least three ways to configure a pump.io docker instance.
One is by editing `pump.io.json` and then building the image. Mounting
an external configuration file in the run stage is the second option.
The third one is by defining ENV variables before starting the container.

A1) Configure `pump.io.json` according to the needs

A2) Build the docker image using
```
docker builder -t pump.io/pump.io .
```

A3) Run docker
```
docker run --name pumpio -p 443:443 -t pump.io/pump.io
```

----

B1) Build the tocker image as in A2)

B2) Run docker
```
docker run --name pumpio -p 443:443 -t pump.io/pump.io \
    -v /host/path/pump.io.json:/etc/pump.io.json
```

----

C1) Build the tocker image as in A2)

C2) Run docker with ENV variables which are the same as original options
defined in pump.io README.md but all in uppercase prepended with the prefix PUMPIO_:

```
docker run \
    --env PUMPIO_SITE="My Pump.io Instance" \
    --env PUMPIO_OWNER="My Name" \
    --env PUMPIO_HOSTNAME="pump.example.com" \
    --name pumpio -p 443:443 -t pump.io/pump.io \
```

----

In case of SSL add and modify these two options in the run command:

```
-v /host/path/privkey.pem:/etc/ssl/private/privkey.pem:ro
-v /host/path/fullchain.pem:/etc/ssl/private/fullchain.pem:ro
```
