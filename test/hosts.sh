#!/bin/sh

grep "dialback.localhost" /etc/hosts || echo "127.0.69.1 dialback.localhost" | sudo tee -a /etc/hosts
grep "social.localhost" /etc/hosts || echo "127.0.69.2 social.localhost" | sudo tee -a /etc/hosts
grep "photo.localhost" /etc/hosts || echo "127.0.69.3 photo.localhost" | sudo tee -a /etc/hosts
grep "echo.localhost" /etc/hosts || echo "127.0.69.4 echo.localhost" | sudo tee -a /etc/hosts
grep "secure.localhost" /etc/hosts || echo "127.0.69.5 secure.localhost" | sudo tee -a /etc/hosts
grep "bounce.localhost" /etc/hosts || echo "127.0.69.6 bounce.localhost" | sudo tee -a /etc/hosts
grep "firehose.localhost" /etc/hosts || echo "127.0.69.7 firehose.localhost" | sudo tee -a /etc/hosts
grep "activityspam.localhost" /etc/hosts || echo "127.0.69.9 activityspam.localhost" | sudo tee -a /etc/hosts
grep "group.localhost" /etc/hosts || echo "127.0.69.10 group.localhost" | sudo tee -a /etc/hosts
