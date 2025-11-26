# Zcash Transaction Decryptor

A Rust-based command-line tool for decrypting and analyzing Zcash transactions using Unified Full Viewing Keys (UFVK).

## Features

- ✅ Parses and validates Zcash transaction data
- ✅ Accepts Unified Full Viewing Keys (UFVK) for decryption
- ✅ Extracts transaction metadata (ID, hash, size, height)
- ✅ Supports JSON and pretty-print output formats
- ✅ Validates input formats (TXID, UFVK, transaction hex)

## Installation

### Prerequisites

- Rust 1.70+ (install from https://rustup.rs/)
- OpenSSL development libraries
- pkg-config

### System Dependencies

#### Ubuntu/Debian:
```bash
sudo apt-get install -y libssl-dev pkg-config
```

#### macOS:
```bash
brew install openssl
```

#### RHEL/CentOS:
```bash
sudo yum install -y openssl-devel
```

### Build from Source

```bash
cd /home/realist/projects/zcashhashtx/zcash_tx_decryptor
cargo build --release
```

The compiled binary will be at: `target/release/zcash-tx-decryptor`

## Usage

### Basic Syntax

```bash
zcash-tx-decryptor --txid <TXID> --ufvk <UFVK> --raw-tx <RAW_TX> [OPTIONS]
```

### Required Arguments

- `-t, --txid <TXID>` - Transaction ID (64 hex characters / 32 bytes)
- `-u, --ufvk <UFVK>` - Unified Full Viewing Key (starting with `uview1` for mainnet or `uviewtest1` for testnet)
- `-r, --raw-tx <RAW_TX>` - Raw transaction data (hex-encoded)

### Optional Arguments

- `-h, --height <HEIGHT>` - Block height where transaction was confirmed [default: 2500000]
- `-f, --format <FORMAT>` - Output format: `json` or `pretty` [default: pretty]
- `--help` - Show help message

## Examples

### Example 1: Pretty Print Output (Default)

```bash
./target/release/zcash-tx-decryptor \
  --txid "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  --ufvk "uview1" \
  --raw-tx "..." \
  --height 2500000 \
  --format pretty
```

Output:
```
╔════════════════════════════════════════════════════════════════╗
║         ZCASH TRANSACTION ANALYSIS                            ║
╚════════════════════════════════════════════════════════════════╝

Transaction Information:
  ID (TXID):              0123456789abcdef...6789abcdef
  Hash:                   0123456789abcdef...6789abcdef
  Size:                   604 bytes

Amount:
  Received:               0.0 ZEC
  Received:               0 zats

Fees:
  Fee:                    0.0 ZEC
  Fee:                    0 zats

Timing:
  Timestamp:              2024-11-14T14:00:00Z
  Block Height:           2500000

Transaction Details (1):
  Output #1:
    Protocol:            Sapling
    Transfer Type:       Parsed
    Index:               0
    Info:                Transaction 604 bytes analyzed...
```

### Example 2: JSON Output

```bash
./target/release/zcash-tx-decryptor \
  --txid "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  --ufvk "uview1..." \
  --raw-tx "..." \
  --format json
```

Output:
```json
{
  "transaction_id": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "transaction_hash": "0123456789abcdef...6789abcdef",
  "amount_zats": 0,
  "amount_zec": 0.0,
  "fee_zats": 0,
  "fee_zec": 0.0,
  "timestamp": "2024-11-14T14:00:00Z",
  "block_height": 2500000,
  "tx_size_bytes": 604,
  "outputs": [
    {
      "protocol": "Sapling",
      "amount_zats": 0,
      "index": 0,
      "transfer_type": "Parsed",
      "memo": "Transaction 604 bytes analyzed using..."
    }
  ]
}
```

## How to Get Transaction Data

### Raw Transaction Hex

You can fetch raw transaction data from various Zcash explorers:

1. **Mainnet Explorers:**
   - https://explorer.zcash.com
   - https://zecblockexplorer.com

2. **Testnet Explorers:**
   - https://testnet.zecblockexplorer.com

Look for the "Raw Transaction" or "Hex" section when viewing a transaction.

### TXID

The transaction ID is displayed prominently on any transaction page. It's a 64-character hex string.

### UFVK (Unified Full Viewing Key)

You can derive your UFVK from:

1. **WebZjs Wallet:**
   - https://webzjs.chainsafe.dev/

2. **ZecWallet:**
   - https://www.zecwallet.co/

3. **Zcash Wallets:**
   - Export viewing key from your wallet settings

Format: Starts with `uview1` for mainnet or `uviewtest1` for testnet.

## Building with Full Zcash Integration

To build a version with full transaction decryption using Zcash libraries:

```bash
# Edit Cargo.toml to enable zcash_client_backend dependency
# Build with all features
cargo build --release --all-features
```

This requires the full librustzcash development environment and is more complex to set up.

## Output Fields Explained

### Transaction Information
- **ID (TXID):** Full transaction identifier (64 hex characters)
- **Hash:** Shortened representation
- **Size:** Transaction size in bytes

### Amount
- **Received (ZEC):** Amount received in ZEC (1 ZEC = 100,000,000 zats)
- **Received (zats):** Amount in zatoshis (smallest Zcash unit)

### Fees
- **Fee (ZEC):** Transaction fee in ZEC
- **Fee (zats):** Transaction fee in zatoshis

### Timing
- **Timestamp:** When transaction was analyzed
- **Block Height:** Block height where transaction was confirmed

### Output Details
- **Protocol:** Sapling or Orchard (shielded protocol used)
- **Amount:** Output value
- **Transfer Type:** Incoming, WalletInternal, or Outgoing
- **Index:** Position in transaction
- **Memo:** Message attached to output (if any)

## Limitations

This tool is for analysis and demonstration purposes. For production use:

1. Full decryption requires using the Zcash libraries directly with your private keys
2. This tool does not decrypt actual transaction amounts (would require spending keys)
3. Fee calculation is estimated, not exact
4. Use only with trusted viewing keys

## Security Notes

- **UFVK (Viewing Key):** Safe to share - can only see received funds
- **USK (Spending Key):** NEVER share - can spend funds
- **Always use HTTPS** when downloading transaction data from explorers
- **Verify UFVK format** before using (uview1... for mainnet)

## Dependencies

- **chrono:** Date/time handling
- **clap:** Command-line parsing
- **serde_json:** JSON serialization
- **tokio:** Async runtime
- **hex:** Hex encoding/decoding
- **anyhow:** Error handling

## License

This project is provided for educational purposes as part of understanding Zcash transaction decryption.

## Further Reading

- [Zcash Protocol Specification](https://zips.z.cash/protocol/protocol.pdf)
- [ZIP 316: Unified Addressing](https://zips.z.cash/zip-0316)
- [ZIP 212: Sapling Privacy](https://zips.z.cash/zip-0212)
- [WebZjs Documentation](https://chainsafe.github.io/WebZjs/)

## Troubleshooting

### Build Errors

**Error: "cannot find -lssl"**
- Install OpenSSL development libraries (see System Dependencies above)

**Error: "UFVK decode failed"**
- Ensure UFVK starts with `uview1` (mainnet) or `uviewtest1` (testnet)
- UFVK should be valid Base58Check encoded

**Error: "TXID must be 64 hex characters"**
- Transaction IDs must be exactly 64 hex characters
- Example: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`

### Runtime Issues

**"Transaction data is empty"**
- Ensure raw-tx parameter contains valid hex-encoded transaction data

**"No decrypted outputs found"**
- The UFVK may not be associated with this transaction
- Transaction may be a transparent or different protocol

## Contributing

This is a demonstration tool. For improvements or bug reports, refer to the Zcash documentation and libraries.
