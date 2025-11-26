// TypeScript interfaces for the API

export interface ScanRequest {
    blockHeights: number[];
    ufvk: string;
}

export interface ScanResponse {
    success: boolean;
    blocksScanned: number;
    transactionsFound: number;
    transactions: TransactionDetails[];
    error?: string;
}

export interface TransactionDetails {
    transaction_id: string;
    transaction_hash: string;
    amount_zats: number;
    amount_zec: number;
    incoming_zats: number;
    incoming_zec: number;
    change_zats: number;
    change_zec: number;
    outgoing_zats: number;
    outgoing_zec: number;
    fee_zats: number;
    fee_zec: number;
    timestamp: string;
    block_height: number;
    outputs: OutputInfo[];
    tx_size_bytes: number;
}

export interface OutputInfo {
    protocol: string;
    amount_zats: number;
    index: number;
    transfer_type: string;
    direction: string;
    memo: string;
}

// GetBlock.io API types
export interface JsonRpcRequest {
    jsonrpc: string;
    method: string;
    params: any[];
    id: string;
}

export interface JsonRpcResponse<T> {
    result: T;
    error: any;
    id: string;
}

export interface BlockData {
    hash: string;
    height: number;
    tx: string[];
    time: number;
    confirmations: number;
    size: number;
    [key: string]: any;
}

export interface RawTransaction {
    hex: string;
    txid: string;
    size: number;
    version: number;
    locktime: number;
    vin: any[];
    vout: any[];
    blockhash?: string;
    height?: number;
    confirmations?: number;
    time?: number;
    blocktime?: number;
    [key: string]: any;
}
