######################

### pump.io http://pump.io Docker image - listens port 443

1) Copy pump.io.json.sample to pump.io.json and configure pump.io.json according to the needs
	```cp pump.io.json.sample pump.io.json```

2) Build the docker image using
	```docker builder -t pump.io/pump.io .```

3) Run docker
	```docker run --name pumpio -p 443:443 -t pump.io/pump.io```

In case of SSL add these two options in the run command:
```
-v /host/path/privkey.pem:/etc/ssl/private/privkey.pem:ro
-v /host/path/fullchain.pem:/etc/ssl/private/fullchain.pem:ro
```
