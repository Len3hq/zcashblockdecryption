use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Complete transaction details after decryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionDetails {
    /// Full transaction ID (TXID)
    pub transaction_id: String,

    /// Shortened transaction hash
    pub transaction_hash: String,

    /// Total amount received in zatoshis (Incoming + WalletInternal)
    /// (1 ZEC = 100,000,000 zats)
    pub amount_zats: i64,

    /// Total amount received in ZEC (Incoming + WalletInternal)
    pub amount_zec: f64,

    /// Total strictly incoming amount (external receives only), in zatoshis
    pub incoming_zats: i64,

    /// Total strictly incoming amount, in ZEC
    pub incoming_zec: f64,

    /// Total internal change (WalletInternal), in zatoshis
    pub change_zats: i64,

    /// Total internal change (WalletInternal), in ZEC
    pub change_zec: f64,

    /// Total value of outputs that were decrypted via OVK (Outgoing), in zatoshis
    pub outgoing_zats: i64,

    /// Total value of outputs that were decrypted via OVK (Outgoing), in ZEC
    pub outgoing_zec: f64,

    /// Transaction fee in zatoshis (if known; 0 in view-only mode)
    pub fee_zats: i64,

    /// Transaction fee in ZEC (if known; 0 in view-only mode)
    pub fee_zec: f64,

    /// Timestamp when transaction was processed by this tool
    pub timestamp: DateTime<Utc>,

    /// Block height where transaction was confirmed (best-effort hint)
    pub block_height: u32,

    /// All decrypted outputs in this transaction
    pub outputs: Vec<OutputInfo>,

    /// Estimated transaction size in bytes
    pub tx_size_bytes: usize,
}

/// Information about a single decrypted output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputInfo {
    /// Protocol: "Sapling" or "Orchard"
    pub protocol: String,

    /// Amount in zatoshis
    pub amount_zats: i64,

    /// Index of output within the bundle
    pub index: usize,

    /// Raw transfer type: Incoming, WalletInternal, or Outgoing
    pub transfer_type: String,

    /// High-level direction label: "received", "change", or "sent"
    pub direction: String,

    /// Memo text attached to output (if any)
    pub memo: String,
}
