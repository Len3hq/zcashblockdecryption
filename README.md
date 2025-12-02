# Zcash Block Scanner & Transaction Decryptor

A high-performance service for scanning Zcash blocks and decrypting shielded transactions using Unified Full Viewing Keys (UFVKs). Built with Node.js and Rust for optimal performance and reliability.

## 🚀 Features

- **Privacy-Focused**: UFVKs processed in memory, never stored
- **High Performance**: Rust-powered cryptographic operations with `librustzcash`
- **NU6.1 Support**: Compatible with the latest Zcash network upgrade
- **Automatic Failover**: Multi-provider support with seamless fallback
- **Smart Caching**: SQLite/PostgreSQL/MySQL support to minimize API calls
- **Rate Limit Protection**: Automatic retry with exponential backoff
- **Production Ready**: Comprehensive error handling and logging

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone git@github.com:Len3hq/zcashblockdecryption.git
cd zcashblockdecryption

# 2. Build the Rust decryptor
cd zcash_tx_decryptor
cargo build --release
cd ..

# 3. Install Node.js dependencies
cd block_scanner_api
npm install

# 4. Configure environment
cp .env.example .env
nano .env  # Add your API keys

# 5. Start the server
npm run dev
```

The API will be available at `http://localhost:3005`

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Request                        │
│                  POST /scan + blockHeights + UFVK           │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js API Server                        │
│  • Request validation                                        │
│  • Multi-provider client (with failover)                    │
│  • Cache management (SQLite/PostgreSQL/MySQL)               │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
                ▼                       ▼
    ┌───────────────────┐   ┌──────────────────────┐
    │  Primary RPC      │   │   Fallback RPC       │
    │  GetBlock.io      │   │   (Multiple sources) │
    └───────────────────┘   └──────────────────────┘
                │
                ▼
    ┌───────────────────────────┐
    │  Raw Transaction Data     │
    └─────────┬─────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │   Rust Decryptor Binary         │
    │   • librustzcash integration    │
    │   • NU6.1 compatibility layer   │
    │   • Sapling/Orchard decryption  │
    └─────────┬───────────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │   Decrypted Transaction Data    │
    │   (Amount, Memo, Protocol, etc.)│
    └─────────────────────────────────┘
```

## 📦 Installation

### Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **GetBlock.io API Key** ([Sign up](https://getblock.io/))

### Detailed Setup

#### 1. Build Rust Decryptor

```bash
cd zcash_tx_decryptor
cargo build --release
```

The binary will be created at: `zcash_tx_decryptor/target/release/zcash-tx-decryptor`

#### 2. Install Node.js Dependencies

```bash
cd block_scanner_api
npm install
```

#### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:

```env
# Primary endpoint (required)
GETBLOCK_ENDPOINT=https://go.getblock.io/YOUR_API_KEY

# Fallback endpoints (optional, comma-separated)
FALLBACK_ENDPOINTS=https://go.getblock.io/KEY2,http://localhost:8232

# Server configuration
PORT=3005
DECRYPTOR_PATH=../zcash_tx_decryptor/target/release/zcash-tx-decryptor

# Database (SQLite by default)
DB_TYPE=sqlite
DB_PATH=./cache/blocks.db
```

See [FALLBACK_SETUP.md](block_scanner_api/FALLBACK_SETUP.md) for detailed configuration options.

## ⚙️ Configuration

### Fallback Endpoints

Protect against rate limits and downtime by configuring multiple RPC endpoints:

```env
# Multiple GetBlock.io accounts
FALLBACK_ENDPOINTS=https://go.getblock.io/account2,https://go.getblock.io/account3

# Mix of providers
FALLBACK_ENDPOINTS=https://quicknode.endpoint/token,http://localhost:8232

# Self-hosted node
FALLBACK_ENDPOINTS=http://rpcuser:rpcpass@localhost:8232
```

See [FALLBACK_SETUP.md](block_scanner_api/FALLBACK_SETUP.md) for:
- Available RPC providers
- Self-hosted node setup
- Cost optimization strategies
- Testing and monitoring

## 🔧 Usage

### Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### API Endpoints

#### Health Check

```bash
curl http://localhost:3005/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-26T12:00:00.000Z",
  "uptime": 123.45
}
```

#### Scan Blocks

```bash
curl -X POST http://localhost:3005/scan \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [3148327, 3148328],
    "ufvk": "uview1..."
  }'
```

Response:
```json
{
  "success": true,
  "blocksScanned": 2,
  "transactionsFound": 1,
  "transactions": [
    {
      "transaction_id": "abc123...",
      "amount_zec": 10.5,
      "incoming_zec": 10.5,
      "block_height": 3148327,
      "outputs": [
        {
          "protocol": "Sapling",
          "amount_zats": 1050000000,
          "transfer_type": "Incoming",
          "memo": "Payment for services"
        }
      ]
    }
  ]
}
```

## 📚 API Documentation

### POST /scan

Scan specific blocks for transactions belonging to a UFVK.

**Request Body:**
```typescript
{
  blockHeights: number[];  // Array of block heights (max 100)
  ufvk: string;           // Unified Full Viewing Key
}
```

**Validation:**
- `blockHeights`: Must be an array of positive integers, max 100 blocks
- `ufvk`: Must start with `uview1` (mainnet) or `uviewtest1` (testnet)

**Response:**
```typescript
{
  success: boolean;
  blocksScanned: number;
  transactionsFound: number;
  transactions: TransactionDetails[];
  error?: string;  // Only present if success is false
}
```

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Never commit sensitive data (use `.env.example`)

## 📄 License

This project is open source. See the LICENSE file for details.

## 🙏 Acknowledgments

- [Zcash](https://z.cash/) for the amazing privacy technology
- [librustzcash](https://github.com/zcash/librustzcash) for cryptographic primitives
- [GetBlock.io](https://getblock.io/) for reliable blockchain RPC access



---

**Built with ❤️ for the Zcash community**
