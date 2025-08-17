#!/bin/bash

# quit when error
set -e

# Filebeat
FILE="./filebeat/filebeat.yml"
chmod 644 "$FILE"

# Ksql
FILE="./ksqldb/ddl.sql"
chmod 644 "$FILE"
FILE="./ksqldb/rulemap-init.sql"
chmod 644 "$FILE"

# Rebuild and run docker
docker-compose build --no-cache
docker-compose up
