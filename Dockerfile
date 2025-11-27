# Multi-stage build for Zcash Block Scanner & Transaction Decryptor

# ============================================
# Stage 1: Build Rust Decryptor
# ============================================
FROM rust:slim AS rust-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install nightly Rust toolchain for edition2024 support
RUN rustup default nightly

# Set working directory
WORKDIR /app

# Copy librustzcash dependency and Rust project
COPY librustzcash ./librustzcash
COPY zcash_tx_decryptor ./zcash_tx_decryptor

# Build the Rust decryptor in release mode
WORKDIR /app/zcash_tx_decryptor
RUN cargo build --release

# ============================================
# Stage 2: Build Node.js API
# ============================================
FROM node:18-slim AS node-builder

WORKDIR /app

# Copy package files
COPY block_scanner_api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript source
COPY block_scanner_api/tsconfig.json ./
COPY block_scanner_api/src ./src

# Install TypeScript as dev dependency and build
RUN npm install --save-dev typescript @types/node @types/express @types/better-sqlite3 @types/pg
RUN npm run build

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:18-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Node.js dependencies from builder
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package*.json ./

# Copy Rust binary from rust-builder
COPY --from=rust-builder /app/zcash_tx_decryptor/target/release/zcash-tx-decryptor /app/decryptor/zcash-tx-decryptor

# Create cache directory for SQLite database
RUN mkdir -p /app/cache

# Set environment variables with Railway-friendly defaults
ENV PORT=3005 \
    NODE_ENV=production \
    DECRYPTOR_PATH=/app/decryptor/zcash-tx-decryptor \
    DB_TYPE=sqlite \
    DB_PATH=/app/cache/blocks.db

# Expose port
EXPOSE 3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3005/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start the application
CMD ["node", "dist/index.js"]
