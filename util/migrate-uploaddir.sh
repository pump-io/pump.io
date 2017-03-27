#!/bin/sh

function run() {	
	umask 077
	
	# Check for a sed with \?
	
	if ! [ $(echo abc | sed 's/b\?c//') = a ]; then
		echo $0: your sed does not support '\?' 1>&2
		exit 1
	fi
	
	# Sanity check the provided path
	
	if [ -z ${1+x} ]; then
		echo Please specify the location of your pump.io.json 1>&2
		exit 1
	elif [ -e "$1" ]; then
		echo Using $1 as the location of \`pump.io.json\`.
		JSONFILE="$1"
	else
		echo $0: $1: No such file or directory 1>&2
		exit 1
	fi
	
	# Check for jq
	
	warn_jq_install() {
		echo \`jq\` was automatically installed\; you may want to remove it with APT 1>&2
	}
	
	if ! type jq > /dev/null; then
		if [ -e /etc/os-release ]; then
			if [ $ID = 'debian' ] || [ $ID_LIKE = 'debian' ]; then
				echo Automatically installing dependency \`jq\`.
				trap warn_jq_install EXIT
				apt install jq
			else
				echo $0: \`jq\` not available and unable to automatically install it 1>&2
				exit 1
			fi
		else
			echo $0: \`jq\` not available and unable to automatically install it 1>&2
			exit 1
		fi
	fi		
	
	# Check for `datadir` and `enableUploads` already being there
	
	# Bug: this will presumably fail if either of these are explicitly set to null, but that's such an edge case, who cares
	for i in datadir enableUploads; do
		if ! [ $(jq '.'$i $JSONFILE) = null ]; then
			echo $0: $JSONFILE: \`$i\` key already present 1>&2
			exit 1
		fi
	done
	
	# Make sure there's an `uploaddir` option
	
	UPLOADDIR="$(jq -r '.uploaddir' "$JSONFILE")"
	
	if [ $UPLOADDIR = null ]; then
		echo $0: $JSONFILE: no \`uploaddir\` key \(did you already migrate?\) 1>&2
		exit 1
	else
		echo Found \`uploaddir\` set to $UPLOADDIR.
	fi
	
	# Make a backup
	
	if ! [ -e $JSONFILE.pre-datadir ]; then
		cp $JSONFILE{,.pre-datadir}
	else
		echo $0: refusing to overwrite backup file $JSONFILE.pre-datadir
		exit 1
	fi
	
	# Create the new file and move things into place
	
	TMPFILE=$(mktemp)
	
	if [ -z "$(echo $UPLOADDIR | grep 'uploads/\?$')" ]; then
		# `uploaddir` does _not_ end in /uploads
	
		TMPDIR=$(mktemp -d)
		mv $UPLOADDIR/* $TMPDIR
		mkdir $UPLOADDIR/uploads
		mv $TMPDIR/* $UPLOADDIR/uploads
		rmdir $TMPDIR
	
		# Adjust the config to match the move we just did
		jq '.datadir = .uploaddir' $JSONFILE | jq 'del(.uploaddir)' | jq '.enableUploads = true' > $TMPFILE
	else
		# `uploaddir` ends in /uploads
		DATADIR=$(echo $UPLOADDIR | sed "s;/uploads/\?;;")
		echo $DATADIR
		jq '.datadir = '\"$DATADIR\" $JSONFILE | jq 'del(.uploaddir)' | jq '.enableUploads = true' > $TMPFILE
	fi
	
	mv $TMPFILE $JSONFILE
}

run
