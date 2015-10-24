./bin/
./bin/pump-register-app  -t test -s 127.0.0.1 -P 31337
./bin/pump-register-user  -u test5 -p Test1234 -s 127.0.0.1 -P 31337
./bin/pump-authorize -u test6 -s 127.0.0.1 -P 31337
./bin/pump-follow -u test5  -s 127.0.0.1 -P 31337 -o h4ck3rm1k3@identi.ca
