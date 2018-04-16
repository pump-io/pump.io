#!/bin/bash

# Short-circut this because if we don't, stuff gets funky
# (This is because `symbolic-ref` doesn't work with tag checkouts)
if git describe --exact-match >/dev/null &>/dev/null; then
	if git describe --exact-match | grep beta >/dev/null; then
		echo beta
	else
		echo release
	fi
	exit 0
fi

BRANCH=$(git symbolic-ref --short HEAD)

if [ $BRANCH = master ]; then
	echo alpha
	exit 0
elif [ $BRANCH = beta ]; then
	echo beta
	exit 0
elif echo $BRANCH | egrep '^[[:digit:]]+\.[[:digit:]]+\.x$' >/dev/null; then
	echo release
	exit 0
else
	echo none
	exit 1
fi
