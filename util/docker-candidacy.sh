#!/bin/bash

# Determine if this Travis CI build is a candidate for Docker builds

cd $(dirname $0)

TYPE=$(./determine-release-type.sh)

if [ $TRAVIS_EVENT_TYPE = cron ]; then
	exit 0
# Don't wait for the cronjob if it's a non-alpha
elif [ $TYPE = release -o $TYPE = beta ]; then
	exit 0
fi

exit 1
