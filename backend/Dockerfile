# syntax=docker/dockerfile:1

# ---- Dependencies (cached until Cargo.toml / Cargo.lock change) ----
FROM rust:1-slim-bookworm AS deps
WORKDIR /app
# Keeps peak memory reasonable on small build hosts.
ENV CARGO_BUILD_JOBS=2 CARGO_TERM_COLOR=never
COPY Cargo.toml Cargo.lock ./
RUN mkdir src tests && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs \
    && cargo build --release --locked \
    && cargo test --release --locked --no-run \
    && rm -rf src tests

COPY migrations ./migrations
COPY src ./src

# ---- Test: `docker build --target test .` (no database needed; DB tests skip themselves) ----
FROM deps AS test
COPY tests ./tests
RUN touch src/main.rs src/lib.rs && cargo test --release --locked

# ---- Build ----
FROM deps AS build
RUN touch src/main.rs src/lib.rs && cargo build --release --locked

# ---- Run ----
# distroless: no shell, no package manager, non-root user, CA certificates included.
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /app/target/release/selfie-backend /usr/local/bin/selfie-backend
ENV HOST=0.0.0.0 \
    PORT=8080 \
    LOG_FORMAT=json
EXPOSE 8080
USER nonroot
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD ["/usr/local/bin/selfie-backend", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/selfie-backend"]
