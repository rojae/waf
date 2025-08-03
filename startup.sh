#!/bin/bash
set -e

# generate include.conf according modsecurity/rules
./generate-include.sh

# docker build > run
docker-compose up --build