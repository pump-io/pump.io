#!/bin/bash

# Determine if this Travis CI build is a candidate for Docker builds

cd $(dirname $0)

TYPE=$(./determine-release-type.sh)

check_right_node_version() {
	test $(node -p "require('process').versions.node.split('.')[0]") = 8
}

if [ $TRAVIS_EVENT_TYPE = cron ]; then
	check_right_node_version && exit 0
# Don't wait for the cronjob if it's a non-alpha
elif [ $TYPE = release -o $TYPE = beta ]; then
	check_right_node_version && exit 0
fi

exit 1
