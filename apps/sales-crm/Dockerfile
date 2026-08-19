# Build stage
FROM golang:1.22-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /salespulse .

# Runtime
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata wget \
    && adduser -D -u 10001 appuser
WORKDIR /app
COPY --from=builder /salespulse /app/salespulse
RUN mkdir -p /data && chown appuser:appuser /data
USER appuser
ENV CRM_DB=/data/crm.db
ENV PORT=8080
EXPOSE 8080
VOLUME /data
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/app/salespulse"]
