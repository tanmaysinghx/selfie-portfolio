# syntax=docker/dockerfile:1

# ---- Build ----
FROM rust:1-slim-bookworm AS build
WORKDIR /app

# Cache dependencies separately from source so code changes rebuild in seconds.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src target/release/deps/selfie_backend* target/release/selfie-backend*

COPY migrations ./migrations
COPY src ./src
RUN cargo build --release --locked

# ---- Run ----
# distroless: no shell, no package manager, runs as a non-root user, includes CA certificates.
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /app/target/release/selfie-backend /usr/local/bin/selfie-backend
ENV HOST=0.0.0.0 \
    PORT=8080 \
    LOG_FORMAT=json
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/usr/local/bin/selfie-backend"]
