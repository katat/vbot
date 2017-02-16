#! /usr/bin/env bash
exec ../node_modules/http-server/bin/http-server -s -p 8888 ./html & serverPid=$!
../bin/run.js -f=schema.json
kill -9 $serverPid
