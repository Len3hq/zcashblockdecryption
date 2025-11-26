use std::collections::HashMap;

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use clap::Parser;

use zcash_client_backend::{decrypt_transaction, keys::UnifiedFullViewingKey, TransferType};
use zcash_primitives::{
    consensus::BlockHeight,
    transaction::Transaction,
};
use zcash_protocol::consensus::{BranchId, Network};

mod models;
use models::*;

/// Zcash Transaction Decryption Tool
///
/// This binary takes a TXID, a UFVK, and either raw transaction hex or a fetched
/// transaction, decrypts all outputs that belong to the provided UFVK using
/// librustzcash, and prints a human‑readable summary.
#[derive(Parser, Debug)]
#[command(name = "zcash-tx-decryptor")]
#[command(about = "Decrypt Zcash transactions using a UFVK", long_about = None)]
struct Args {
    /// Transaction ID (hex-encoded 32 bytes)
    #[arg(short, long)]
    txid: String,

    /// Unified Full Viewing Key (UFVK) for decryption
    #[arg(short, long)]
    ufvk: String,

    /// Raw transaction hex data. If omitted, the tool will attempt to fetch it
    /// from a public explorer in a future version.
    #[arg(short, long)]
    raw_tx: String,

    /// Block height where transaction was confirmed (best-effort, for ZIP-212)
    #[arg(short, long, default_value = "2500000")]
    height: u32,

    /// Output format: json or pretty
    #[arg(short, long, default_value = "pretty")]
    format: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Validate TXID format
    if args.txid.len() != 64 {
        return Err(anyhow!("TXID must be 64 hex characters, got {}", args.txid.len()));
    }
    hex::decode(&args.txid).context("TXID is not valid hex")?;

    // Determine network from UFVK prefix
    let network = if args.ufvk.starts_with("uviewtest1") {
        Network::TestNetwork
    } else if args.ufvk.starts_with("uview1") {
        Network::MainNetwork
    } else {
        return Err(anyhow!(
            "Invalid UFVK format. Expected to start with 'uview1' (mainnet) or 'uviewtest1' (testnet)"
        ));
    };

    // Decode UFVK using librustzcash
    let ufvk = UnifiedFullViewingKey::decode(&network, &args.ufvk)
        .map_err(|e| anyhow!("Failed to decode UFVK: {}", e))?;

    // Decode raw transaction bytes
    let mut tx_bytes = hex::decode(args.raw_tx.trim())
        .context("Raw transaction hex is invalid (not hex or empty)")?;
    if tx_bytes.is_empty() {
        return Err(anyhow!("Transaction data is empty"));
    }
    let tx_size_bytes = tx_bytes.len();

    // Parse transaction using correct consensus branch ID for the given height
    let height = BlockHeight::from_u32(args.height);
    let branch_id = BranchId::for_height(&network, height);
    
    // Check if this is an NU6.1 block and patch the transaction bytes
    // NU6.1 uses the same transaction format as NU6, just a different branch ID
    // We need to replace the NU6.1 branch ID (0x4dec4df0) with NU6 (0xc8e71055) in the tx bytes
    let is_nu61_range = match network {
        Network::MainNetwork => args.height >= 3_146_400,
        Network::TestNetwork => args.height >= 2_976_640,
    };
    
    if is_nu61_range {
        // NU6.1 branch ID: 0x4dec4df0 (little-endian: f0 4d ec 4d)
        // NU6 branch ID: 0xc8e71055 (little-endian: 55 10 e7 c8)
        // V5 transaction structure:
        //   Bytes 0-3: header (version + overwintered flag)
        //   Bytes 4-7: version group ID
        //   Bytes 8-11: consensus branch ID
        if tx_bytes.len() >= 12 {
            // Check if this is a v5 transaction (byte 0 = 0x05)
            if tx_bytes[0] == 0x05 && tx_bytes[3] == 0x80 {
                // Check if bytes 8-11 contain NU6.1 branch ID
                if tx_bytes[8] == 0xf0 && tx_bytes[9] == 0x4d && tx_bytes[10] == 0xec && tx_bytes[11] == 0x4d {
                    // Replace with NU6 branch ID
                    tx_bytes[8] = 0x55;
                    tx_bytes[9] = 0x10;
                    tx_bytes[10] = 0xe7;
                    tx_bytes[11] = 0xc8;
                }
            }
        }
    }
    
    // Parse the transaction
    let tx = Transaction::read(&tx_bytes[..], branch_id)
        .context("Failed to parse transaction from raw hex")?;

    // Note: We skip TXID validation because:
    // 1. The TXID comes directly from the blockchain via getblock/getrawtransaction
    // 2. For NU6.1 transactions, we patch the branch ID bytes to parse with NU6,
    //    which would change the computed TXID but doesn't affect decryption

    // Build UFVK map for decrypt_transaction (single account id = 0)
    let mut ufvks = HashMap::new();
    ufvks.insert(0u32, ufvk);

    // Perform real decryption using librustzcash
    let decrypted = decrypt_transaction(&network, height, &tx, &ufvks);

    // Convert decrypted data into our human‑readable model
    let details = build_transaction_details(&args.txid, height, tx_size_bytes, &tx, &decrypted)?;

    // Output results
    match args.format.as_str() {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&details)?);
        }
        "pretty" => {
            print_transaction_details(&details);
        }
        other => return Err(anyhow!("Unknown format: {} (expected 'json' or 'pretty')", other)),
    }

    Ok(())
}

/// Build a high‑level, human‑readable transaction summary from a decrypted transaction.
fn build_transaction_details(
    txid: &str,
    height: BlockHeight,
    tx_size_bytes: usize,
    _tx: &Transaction,
    decrypted: &zcash_client_backend::data_api::DecryptedTransaction<'_, u32>,
) -> Result<TransactionDetails> {
    let txid_short = format!("{}...{}", &txid[0..16], &txid[txid.len() - 16..]);

    // Collect outputs belonging to this UFVK
    let mut outputs: Vec<OutputInfo> = Vec::new();
    let mut incoming_zats: u64 = 0;
    let mut change_zats: u64 = 0;
    let mut outgoing_zats: u64 = 0;

    // Helper to classify transfer type
    fn classify_transfer(t: &TransferType) -> (&'static str, &'static str) {
        match t {
            TransferType::Incoming => ("Incoming", "received"),
            TransferType::WalletInternal => ("WalletInternal", "change"),
            TransferType::Outgoing => ("Outgoing", "sent"),
        }
    }

    // Sapling outputs
    for out in decrypted.sapling_outputs() {
        let value = u64::from(out.note_value());
        let memo = String::from_utf8_lossy(out.memo().as_slice()).to_string();
        let (tt_raw, direction) = classify_transfer(&out.transfer_type());

        match out.transfer_type() {
            TransferType::Incoming => incoming_zats = incoming_zats.saturating_add(value),
            TransferType::WalletInternal => change_zats = change_zats.saturating_add(value),
            TransferType::Outgoing => outgoing_zats = outgoing_zats.saturating_add(value),
        }

        outputs.push(OutputInfo {
            protocol: "Sapling".to_string(),
            amount_zats: value as i64,
            index: out.index(),
            transfer_type: tt_raw.to_string(),
            direction: direction.to_string(),
            memo,
        });
    }

    // Orchard outputs
    for out in decrypted.orchard_outputs() {
        let value = u64::from(out.note_value());
        let memo = String::from_utf8_lossy(out.memo().as_slice()).to_string();
        let (tt_raw, direction) = classify_transfer(&out.transfer_type());

        match out.transfer_type() {
            TransferType::Incoming => incoming_zats = incoming_zats.saturating_add(value),
            TransferType::WalletInternal => change_zats = change_zats.saturating_add(value),
            TransferType::Outgoing => outgoing_zats = outgoing_zats.saturating_add(value),
        }

        outputs.push(OutputInfo {
            protocol: "Orchard".to_string(),
            amount_zats: value as i64,
            index: out.index(),
            transfer_type: tt_raw.to_string(),
            direction: direction.to_string(),
            memo,
        });
    }

    let total_received_zats = incoming_zats
        .saturating_add(change_zats);

    let amount_zats_i64 = i64::try_from(total_received_zats)
        .map_err(|_| anyhow!("Total received amount exceeds i64 range"))?;
    let amount_zec = (total_received_zats as f64) / 100_000_000.0;

    let incoming_zats_i64 = i64::try_from(incoming_zats)
        .map_err(|_| anyhow!("Incoming amount exceeds i64 range"))?;
    let change_zats_i64 = i64::try_from(change_zats)
        .map_err(|_| anyhow!("Change amount exceeds i64 range"))?;
    let outgoing_zats_i64 = i64::try_from(outgoing_zats)
        .map_err(|_| anyhow!("Outgoing amount exceeds i64 range"))?;

    let incoming_zec = (incoming_zats as f64) / 100_000_000.0;
    let change_zec = (change_zats as f64) / 100_000_000.0;
    let outgoing_zec = (outgoing_zats as f64) / 100_000_000.0;

    Ok(TransactionDetails {
        transaction_id: txid.to_string(),
        transaction_hash: txid_short,
        amount_zats: amount_zats_i64,
        amount_zec,
        incoming_zats: incoming_zats_i64,
        incoming_zec,
        change_zats: change_zats_i64,
        change_zec,
        outgoing_zats: outgoing_zats_i64,
        outgoing_zec,
        // Fee calculation requires wallet context; we leave it as zero for now.
        fee_zats: 0,
        fee_zec: 0.0,
        timestamp: Utc::now(), // Block timestamp would require an extra RPC; best-effort here.
        block_height: u32::from(height),
        outputs,
        tx_size_bytes,
    })
}

/// Pretty print transaction details
fn print_transaction_details(details: &TransactionDetails) {
    println!("\n╔════════════════════════════════════════════════════════════════╗");
    println!("║         ZCASH TRANSACTION ANALYSIS                            ║");
    println!("╚════════════════════════════════════════════════════════════════╝\n");

    println!("Transaction Information:");
    println!("  ID (TXID):              {}", details.transaction_id);
    println!("  Hash:                   {}", details.transaction_hash);
    println!("  Size:                   {} bytes", details.tx_size_bytes);

    println!("\nAmount (UFVK-related outputs):");
    println!("  Total received:         {} ZEC", details.amount_zec);
    println!("  Total received:         {} zats", details.amount_zats);
    println!("  Incoming (external):    {} ZEC", details.incoming_zec);
    println!("  Incoming (external):    {} zats", details.incoming_zats);
    println!("  Change (internal):      {} ZEC", details.change_zec);
    println!("  Change (internal):      {} zats", details.change_zats);
    println!("  Outgoing (OVK view):    {} ZEC", details.outgoing_zec);
    println!("  Outgoing (OVK view):    {} zats", details.outgoing_zats);

    println!("\nFees (not computed – view-only context):");
    println!("  Fee:                    {} ZEC", details.fee_zec);
    println!("  Fee:                    {} zats", details.fee_zats);

    println!("\nTiming:");
    println!("  Timestamp (local run):  {}", details.timestamp);
    println!("  Block Height (hint):    {}", details.block_height);

    if !details.outputs.is_empty() {
        println!("\nDecrypted Outputs ({}):", details.outputs.len());
        for (idx, output) in details.outputs.iter().enumerate() {
            println!("  Output #{}:", idx + 1);
            println!("    Protocol:           {}", output.protocol);
            println!("    Transfer Type:      {}", output.transfer_type);
            println!("    Direction:          {}", output.direction);
            println!("    Index:              {}", output.index);
            println!("    Amount:             {} zats", output.amount_zats);
            println!(
                "    Amount:             {:.8} ZEC",
                output.amount_zats as f64 / 100_000_000.0
            );
            if !output.memo.is_empty() {
                println!("    Memo:               {}", output.memo);
            }
        }
    } else {
        println!("\nNo outputs in this transaction could be decrypted with the provided UFVK.");
    }

    println!("\n╚════════════════════════════════════════════════════════════════╝\n");
}
