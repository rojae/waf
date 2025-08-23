FROM golang:1.21-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -a -installsuffix cgo \
    -o alert-processor \
    ./main.go

FROM alpine:3.18
RUN apk --no-cache add ca-certificates tzdata && update-ca-certificates
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/alert-processor .

USER appuser
CMD ["./alert-processor"]