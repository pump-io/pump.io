#!/bin/sh
patch -p1 < ./patch/connect.patch
cd node_modules/connect
npm install
cd ../..

