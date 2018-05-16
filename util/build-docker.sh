#!/bin/bash

# Normally there's no need to call this locally. Just use `docker build`.
# This is only here to handle a bunch of stuff in Travis cronjobs.

docker_login() {
	echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
}

cd $(dirname $0)

TYPE=$(./determine-release-type.sh)
PKGVER=$(node -p "require('../package.json').version")

if [ $TYPE = none ]; then exit 0; fi

if [ $TYPE = alpha ]; then
	docker_login
	docker build .. --tag pumpio/pump.io:alpha
	docker push pumpio/pump.io
elif [ $TYPE = beta ]; then
	# If we're not on an exact tag, bail
	git describe --exact-match >/dev/null &>/dev/null || exit 0
	# This catches when we're doing a job on the `beta` branch instead of on a beta tag
	# We have to do this because it matters whether we actually checked out a tag, NOT just
	# if current HEAD *corresponds to* a tag (as it usually will on `beta`).
	git symbolic-ref HEAD >/dev/null &>/dev/null && exit 0
	docker_login
	docker build .. --tag pumpio/pump.io:beta --tag pumpio/pump.io:$PKGVER
	docker push pumpio/pump.io
elif [ $TYPE = release ]; then
	# TODO don't build on tags, only on branches (which saves Travis some work)
	docker_login
	docker build .. --tag pumpio/pump.io:release --tag pumpio/pump.io:$PKGVER
	docker push pumpio/pump.io
fi
