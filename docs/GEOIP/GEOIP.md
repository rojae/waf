# GeoIP Database Setup

This directory contains the MaxMind GeoLite2 database for IP geolocation.

## Database Download

Download the GeoLite2-City database from MaxMind:

1. Sign up for a free account at: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
2. Download `GeoLite2-City.mmdb`
3. Place the file in this directory: `./geoip/GeoLite2-City.mmdb`

## File Structure
```
geoip/
├── README.md           # This file
└── GeoLite2-City.mmdb  # MaxMind database (download required)
```

## Usage

The real-time processor service will automatically load the database on startup if available:
- **Path**: `/data/GeoLite2-City.mmdb` (inside container)
- **Host path**: `./geoip/GeoLite2-City.mmdb` (mapped via Docker volume)
- **Environment**: `GEOIP_DB_PATH=/data/GeoLite2-City.mmdb`

## Features

When GeoIP database is available, the real-time processor will enrich events with:
- Country code (ISO 3166-1 alpha-2)
- City name
- Latitude/Longitude coordinates
- Private IP detection (RFC 1918)

## Fallback Behavior

If the database is not available:
- Service continues running without GeoIP enrichment
- Geographic fields default to "unknown"
- Warning logged during startup

## Database Updates

MaxMind updates GeoLite2 databases weekly. Consider setting up automated updates in production environments.