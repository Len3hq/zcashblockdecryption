# Zcash Block Scanner & Decryption Service - End-to-End Guide

## 1. Project Overview
This project is a specialized service designed to scan Zcash blocks, fetch raw transaction data, and attempt to decrypt shielded transactions using a **Unified Full Viewing Key (UFVK)**.

It consists of two main components:
1.  **Block Scanner API (Node.js)**: A REST API that handles client requests, manages block scanning logic, caches block data, and orchestrates the decryption process.
2.  **Transaction Decryptor (Rust)**: A high-performance binary built with `librustzcash` that performs the actual cryptographic decryption of Zcash transactions.

### Key Features
-   **Privacy-Focused**: UFVKs are processed in memory and never stored.
-   **Efficient Scanning**: Fetches block data from GetBlock.io and processes transactions in batches.
-   **Hybrid Architecture**: Combines the ease of use of Node.js with the cryptographic performance of Rust.
-   **Caching**: Uses SQLite (configurable to PostgreSQL/MySQL) to cache block headers and reduce external API calls.

---

## 2. Architecture & How It's Built

The system follows a microservices-like architecture where the Node.js API acts as the controller and the Rust binary acts as a worker.

### Component Interaction
1.  **Client** sends a `POST /scan` request with `blockHeights` and a `ufvk`.
2.  **Node.js API**:
    -   Validates the request.
    -   Checks the local database cache for block information.
    -   Fetches missing block/transaction data from the **GetBlock.io** RPC API.
    -   Formats the transaction data.
3.  **Rust Decryptor**:
    -   The Node.js API spawns the Rust binary as a child process.
    -   Passes the UFVK and raw transaction data to the binary.
    -   The Rust binary uses `librustzcash` to attempt decryption.
    -   Returns successfully decrypted transaction details (amount, memo, recipient, etc.) to Node.js.
4.  **Response**: The API aggregates the results and returns a JSON response to the client.

### Technology Stack
-   **Backend**: Node.js, Express, TypeScript.
-   **Cryptography**: Rust, `librustzcash`, `orchard`, `zcash_primitives`.
-   **Database**: Better-SQLite3 (Default), supports PostgreSQL/MySQL via Knex/TypeORM patterns (if implemented).
-   **External API**: GetBlock.io (for Zcash blockchain data).

---

## 3. Project Structure

The codebase is organized into a monorepo-style structure:

```
zcashtxdecryption/
├── block_scanner_api/       # Node.js API Service
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── routes/          # API Route definitions
│   │   ├── services/        # Business logic (Cache, Decryptor wrapper)
│   │   └── utils/           # Helpers (Logger, etc.)
│   ├── .env                 # Configuration (API Keys, Paths)
│   └── package.json         # Node.js dependencies
│
├── zcash_tx_decryptor/      # Rust Decryption Binary
│   ├── src/
│   │   └── main.rs          # Rust entry point
│   ├── Cargo.toml           # Rust dependencies
│   └── target/              # Compiled binaries
│
└── librustzcash/            # Zcash Cryptography Library (Submodule)
```

---

## 4. Setup & Installation

### Prerequisites
-   **Node.js** (v18+ recommended)
-   **Rust & Cargo** (Latest stable)
-   **GetBlock.io API Key** (for Zcash mainnet/testnet)

### Step 1: Build the Rust Decryptor
The Node.js API relies on the compiled Rust binary.

```bash
cd zcash_tx_decryptor
cargo build --release
```
*Result*: The binary will be created at `zcash_tx_decryptor/target/release/zcash-tx-decryptor`.

### Step 2: Configure the API
Navigate to the API directory and install dependencies.

```bash
cd ../block_scanner_api
npm install
```

Create the `.env` file:
```bash
cp .env.example .env
```

Edit `.env` and populate the following:
-   `GETBLOCK_ENDPOINT`: Your GetBlock.io URL (e.g., `https://go.getblock.io/<YOUR_TOKEN>`).
-   `DECRYPTOR_PATH`: Path to the binary built in Step 1 (default is usually correct: `../zcash_tx_decryptor/target/release/zcash-tx-decryptor`).

### Step 3: Run the Service
Start the development server:

```bash
npm run dev
```
The server will start on port **3005** (default).

---

## 5. Usage Guide

### API Endpoints

#### 1. Health Check
Verifies the system status.
-   **URL**: `GET /health`
-   **Response**:
    ```json
    {
      "status": "healthy",
      "timestamp": "2025-11-26T...",
      "uptime": 123.45
    }
    ```

#### 2. Scan Blocks
Scans specific blocks for transactions belonging to a UFVK.
-   **URL**: `POST /scan`
-   **Headers**: `Content-Type: application/json`
-   **Body**:
    ```json
    {
      "blockHeights": [1000000, 1000001],
      "ufvk": "uview1..."
    }
    ```
-   **Response**:
    ```json
    {
      "success": true,
      "blocksScanned": 2,
      "transactionsFound": 1,
      "transactions": [
        {
          "txid": "7c9...",
          "amount": 10.5,
          "memo": "Payment for services",
          "recipient": "zs1..."
        }
      ]
    }
    ```

### Testing
A helper script is provided to quickly test the endpoints:

```bash
cd block_scanner_api
./test_scan.sh
```

Alternatively, import the `postman_collection.json` file into Postman for a GUI-based testing experience.

---

## 6. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| **500 Internal Server Error** | Rust binary not found or failed. | Check `DECRYPTOR_PATH` in `.env`. Ensure `cargo build --release` was successful. |
| **RPC Error / 500** | GetBlock API issues. | Verify your `GETBLOCK_ENDPOINT` is correct and your quota is not exceeded. |
| **"Invalid UFVK"** | Malformed key. | Ensure the UFVK starts with `uview1` (mainnet) or `uviewtest1` (testnet). |
| **Database Locks** | SQLite concurrency. | The app handles this, but avoid opening the `.db` file in other apps while the server is running. |
