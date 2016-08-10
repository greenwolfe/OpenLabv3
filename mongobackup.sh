#!/bin/bash
foldername="/mnt/openlabData/OpenLabv3/mongodumps"
filename=$foldername"/meteor"
mkdir -p $foldername
[ -d $filename".bak" ] && rm -r $filename".bak"
[ -d $filename ] && mv $filename $filename".bak"
mongodump -h 127.0.0.1 --port 3001 --out $foldername;
