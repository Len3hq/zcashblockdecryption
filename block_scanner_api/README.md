# Zcash Block Scanner API

A TypeScript/Node.js API service that scans Zcash blocks, fetches raw transactions via GetBlock.io, and decrypts them using a Unified Full Viewing Key (UFVK).

## Features

- ✅ Scan up to 100 blocks per request
- ✅ Decrypt shielded transactions (Sapling & Orchard)
- ✅ Rate limiting (20 req/s for GetBlock.io API)
- ✅ Multi-database caching (SQLite, PostgreSQL, MySQL)
- ✅ Privacy-focused (UFVK never stored)
- ✅ RESTful API with JSON responses

## Prerequisites

- Node.js 18+ and npm
- Rust toolchain (for building the decryptor)
- GetBlock.io API access token
- SQLite (default) or PostgreSQL/MySQL (optional)

## Installation

### 1. Build the Rust Decryptor

```bash
cd ../zcash_tx_decryptor
cargo build --release
```

The binary will be at: `../zcash_tx_decryptor/target/release/zcash-tx-decryptor`

### 2. Install Node.js Dependencies

```bash
cd ../block_scanner_api
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GetBlock.io endpoint
```

Required environment variables:
- `GETBLOCK_ENDPOINT` - Your GetBlock.io API endpoint with access token
- `PORT` - API server port (default: 3005)
- `DECRYPTOR_PATH` - Path to the Rust decryptor binary
- `DB_TYPE` - Database type: `sqlite`, `postgres`, or `mysql`
- `DB_PATH` - SQLite database path (for SQLite)

### 4. Build TypeScript

```bash
npm run build
```

## Usage

### Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### API Endpoint

**POST /scan**

Scan blocks and decrypt transactions matching the provided UFVK.

**Request:**
```json
{
  "blockHeights": [1384123, 1384124, 1384125],
  "ufvk": "uview1..."
}
```

**Response:**
```json
{
  "success": true,
  "blocksScanned": 3,
  "transactionsFound": 2,
  "transactions": [
    {
      "transaction_id": "5db76e43...",
      "transaction_hash": "5db76e43...ed7cee",
      "amount_zats": 100000000,
      "amount_zec": 1.0,
      "incoming_zats": 100000000,
      "incoming_zec": 1.0,
      "change_zats": 0,
      "change_zec": 0.0,
      "outgoing_zats": 0,
      "outgoing_zec": 0.0,
      "fee_zats": 0,
      "fee_zec": 0.0,
      "timestamp": "2024-11-26T00:00:00Z",
      "block_height": 1384123,
      "outputs": [
        {
          "protocol": "Sapling",
          "amount_zats": 100000000,
          "index": 0,
          "transfer_type": "Incoming",
          "direction": "received",
          "memo": "Payment received"
        }
      ],
      "tx_size_bytes": 2048
    }
  ]
}
```

**Validation:**
- Maximum 100 blocks per request
- UFVK must start with `uview1` (mainnet) or `uviewtest1` (testnet)
- Block heights must be positive integers

### Health Check

**GET /health**

```json
{
  "status": "healthy",
  "timestamp": "2024-11-26T00:00:00Z",
  "uptime": 123.45
}
```

## Example Usage

### Using curl

```bash
curl -X POST http://localhost:3005/scan \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [1384123],
    "ufvk": "uviewtest1..."
  }'
```

### Using JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:3005/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    blockHeights: [1384123, 1384124],
    ufvk: 'uviewtest1...'
  })
});

const data = await response.json();
console.log(`Found ${data.transactionsFound} transactions`);
```

## Caching

The API caches the following to minimize GetBlock.io API calls:

- **Block hashes** - Permanent (blocks are immutable)
- **Block data** - Permanent
- **Raw transactions** - Permanent

**Note:** Decryption results are NOT cached to protect privacy. The UFVK is never stored in the database.

### Cache Performance

- **First request** (uncached): ~30-40 seconds for 100 blocks
- **Subsequent requests** (cached blocks): <5 seconds for 100 blocks
- **Mixed** (some cached): Proportional to uncached blocks

## Database Configuration

### SQLite (Default)

```env
DB_TYPE=sqlite
DB_PATH=./cache/blocks.db
```

### PostgreSQL

```env
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zcash_cache
DB_USER=postgres
DB_PASSWORD=your_password
```

### MySQL

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=zcash_cache
DB_USER=root
DB_PASSWORD=your_password
```

## Rate Limiting

The GetBlock.io API has a 20 requests/second limit. This API automatically:

- Queues requests using a token bucket algorithm
- Spreads requests evenly across time
- Prevents API rate limit errors

**Estimated times:**
- 10 blocks: ~3-5 seconds (uncached)
- 50 blocks: ~15-20 seconds (uncached)
- 100 blocks: ~30-40 seconds (uncached)

## Security & Privacy

- ✅ UFVK is **never logged or stored**
- ✅ Only blockchain data is cached
- ✅ Decryption happens on-demand
- ✅ No sensitive data persisted

## Troubleshooting

### "GETBLOCK_ENDPOINT environment variable is not set"

Make sure you've created a `.env` file with your GetBlock.io endpoint.

### "DECRYPTOR_PATH environment variable is not set"

Set the path to the compiled Rust decryptor binary in `.env`.

### "Database not initialized"

Ensure the database directory exists and has write permissions:

```bash
mkdir -p cache
chmod 755 cache
```

### Rate limit errors

If you're hitting rate limits, the API will automatically queue requests. For large scans (100 blocks), expect 30-40 seconds for the first request.

## Development

### Project Structure

```
block_scanner_api/
├── src/
│   ├── index.ts              # Express server
│   ├── routes/
│   │   └── scan.ts           # POST /scan endpoint
│   ├── services/
│   │   ├── getblock-client.ts    # GetBlock.io RPC client
│   │   ├── rate-limiter.ts       # Rate limiting
│   │   ├── decryptor.ts          # Rust decryptor integration
│   │   └── cache.ts              # Database caching
│   ├── types/
│   │   └── index.ts          # TypeScript interfaces
│   └── utils/
│       └── logger.ts         # Logging
├── cache/                    # SQLite database
├── dist/                     # Compiled JavaScript
└── package.json
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled server
- `npm run dev` - Run with ts-node (development)
- `npm run watch` - Watch mode for TypeScript compilation

## License

MIT

## Contributing

This project is part of the Zcash transaction decryption toolkit. For issues or improvements, please refer to the main project repository.
