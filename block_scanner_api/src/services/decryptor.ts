import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import { TransactionDetails } from '../types';

export class ZcashDecryptor {
    private decryptorPath: string;

    constructor(decryptorPath: string) {
        this.decryptorPath = decryptorPath;
    }

    async decryptTransaction(
        txid: string,
        ufvk: string,
        rawTx: string,
        height: number
    ): Promise<TransactionDetails | null> {
        return new Promise((resolve, reject) => {
            const args = [
                '--txid', txid,
                '--ufvk', ufvk,
                '--raw-tx', rawTx,
                '--height', height.toString(),
                '--format', 'json'
            ];

            logger.debug(`Decrypting transaction ${txid} at height ${height}`);

            const process = spawn(this.decryptorPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    logger.warn(`Decryptor exited with code ${code} for tx ${txid}: ${stderr}`);
                    // Return null for transactions that don't match the UFVK
                    resolve(null);
                    return;
                }

                try {
                    const result = JSON.parse(stdout) as TransactionDetails;

                    // Check if any outputs were found
                    if (!result.outputs || result.outputs.length === 0) {
                        logger.debug(`No outputs found for tx ${txid}`);
                        resolve(null);
                        return;
                    }

                    logger.debug(`Successfully decrypted tx ${txid} with ${result.outputs.length} outputs`);
                    resolve(result);
                } catch (error: any) {
                    logger.error(`Failed to parse decryptor output for tx ${txid}:`, error.message);
                    resolve(null);
                }
            });

            process.on('error', (error) => {
                logger.error(`Failed to spawn decryptor process:`, error.message);
                reject(error);
            });
        });
    }

    async decryptTransactions(
        transactions: { txid: string; hex: string }[],
        ufvk: string,
        height: number
    ): Promise<TransactionDetails[]> {
        const results: TransactionDetails[] = [];

        for (const tx of transactions) {
            try {
                const decrypted = await this.decryptTransaction(tx.txid, ufvk, tx.hex, height);
                if (decrypted) {
                    results.push(decrypted);
                }
            } catch (error: any) {
                logger.error(`Error decrypting transaction ${tx.txid}:`, error.message);
                // Continue with next transaction
            }
        }

        return results;
    }
}

// Singleton instance
let decryptorInstance: ZcashDecryptor | null = null;

export function getDecryptor(): ZcashDecryptor {
    if (!decryptorInstance) {
        const decryptorPath = process.env.DECRYPTOR_PATH;
        if (!decryptorPath) {
            throw new Error('DECRYPTOR_PATH environment variable is not set');
        }
        decryptorInstance = new ZcashDecryptor(decryptorPath);
    }
    return decryptorInstance;
}
