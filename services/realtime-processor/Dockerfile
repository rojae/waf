# Real-Time WAF Event Processor Dockerfile (Kafka Version)
#
# This Dockerfile creates a production-ready container for the real-time WAF event processor.
# It uses a multi-stage build to minimize the final image size and includes only runtime dependencies.

# Build stage
ARG GO_VERSION=1.21-alpine
FROM golang:${GO_VERSION} AS builder

ARG APP_VERSION=dev
ARG BUILD_TIME
ARG GIT_COMMIT

RUN apk add --no-cache ca-certificates git

WORKDIR /app

# Copy Go modules and download dependencies
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.version=${APP_VERSION} -X main.buildTime=${BUILD_TIME} -X main.gitCommit=${GIT_COMMIT}" \
    -a -installsuffix cgo \
    -o realtime-processor \
    ./cmd/main.go

# Production stage
FROM alpine:3.18

RUN apk --no-cache add ca-certificates tzdata && update-ca-certificates

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /app/realtime-processor .

USER appuser

LABEL maintainer="WAF Security Team <security@company.com>" \
      description="Real-time WAF event processor (Kafka version)" \
      version="${APP_VERSION}" \
      vendor="Enterprise Security Division" \
      component="waf-realtime-processor" \
      tier="processing" \
      licenses="MIT" \
      created="${BUILD_TIME}"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep realtime-processor > /dev/null || exit 1

# Default environment variables
ENV KAFKA_BROKERS="kafka:9092" \
    KAFKA_TOPIC="waf-realtime-events" \
    KAFKA_GROUP="realtime-processor" \
    INFLUXDB_URL="http://influxdb:8086" \
    INFLUXDB_ORG="waf-org" \
    INFLUXDB_BUCKET="waf-realtime" \
    LOG_LEVEL="info" \
    LOG_FORMAT="json" \
    GOGC=100 \
    GOMEMLIMIT=512MiB

ENTRYPOINT ["./realtime-processor"]
