# Dockerfile for pump.io

This Dockerfile is based on Alpine Linux 3.5 and Node 6.9. It builds pump.io from the Git repository.

## Building

The image should build without any further options. The compilation error from node-gyp during the `npm install` can be ignored, as they only affect optional dependencies.

```
docker build --tag pumpio:latest .
```

The Dockerfile also allows to define the UID and GUID of the `pumpio` user which runs pump.io via build arguments.

```
docker build --tag pumpio:latest --build-arg PUMPIO__GUID=1337 --build-arg PUMPIO__UID=1337 .
```

You can also use `docker-compose` to build the image: `docker-compose build`

## Running

By default this Dockerfile only includes the `databank-mongodb` driver. Therefore you will have to add the configuration parameters for MongoDB. The recommended way to configure pump.io is to configure the options via environment variables, as described in the project's README. You can see some example variables in the `docker-compose.yml` file. This file will also show a basic working version which you can expand on.

Running via `docker-compose`:

```
docker-compose up -d
```

Stopping and removing:

```
docker-compose down -v
```

Notice the `-v` parameter, as the docker-compose file defines volumes. Without this parameter they will be left behind.


If you have Docker Swarm active, you can also deploy this as a Service Stack:

```
docker stack deploy --compose-file docker-compose.yml pumpio
```
