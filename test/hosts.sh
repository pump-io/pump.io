#!/bin/sh

grep "dialback.localhost" /etc/hosts || echo "127.0.69.1 dialback.localhost" | sudo tee -a /etc/hosts
grep "social.localhost" /etc/hosts || echo "127.0.69.2 social.localhost" | sudo tee -a /etc/hosts
grep "photo.localhost" /etc/hosts || echo "127.0.69.3 photo.localhost" | sudo tee -a /etc/hosts
grep "echo.localhost" /etc/hosts || echo "127.0.69.4 echo.localhost" | sudo tee -a /etc/hosts
