# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS base
WORKDIR /app
RUN apk add --no-cache git gcc musl-dev
ENV CGO_ENABLED=0

# --- development target (live reload via air) ---
FROM base AS development
RUN go install github.com/air-compass/air@latest || true
# Fallback: install cosmtrek/air (commonly published name)
RUN go install github.com/cosmtrek/air@latest || true
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
EXPOSE 8080
CMD ["sh", "-c", "which air >/dev/null 2>&1 && air || go run ./cmd/api"]

# --- builder ---
# Run the toolchain on the build platform (native) and cross-compile for the
# target platform — avoids running amd64 Go under QEMU/Rosetta emulation.
FROM --platform=$BUILDPLATFORM golang:1.23-alpine AS builder
ARG TARGETOS TARGETARCH
WORKDIR /app
RUN apk add --no-cache git
ENV CGO_ENABLED=0
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
# Inject build-time version info via ldflags
RUN VERSION=$(git describe --tags --always --dirty 2>/dev/null || echo "dev") && \
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") && \
    BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
    GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -ldflags "-s -w -X main.Version=${VERSION} -X main.Commit=${COMMIT} -X main.BuildDate=${BUILD_DATE}" -o /out/api ./cmd/api

# --- production ---
FROM alpine:3.20 AS production
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /out/api /app/api
EXPOSE 8080
CMD ["/app/api"]
