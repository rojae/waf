#!/bin/bash

# quilt when error
set -e

# docker build > run
docker-compose build --no-cache
docker-compose up