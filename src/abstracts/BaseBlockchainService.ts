import {
    NetworkConfig,
    TransactionRequest,
    TransactionResponse,
    WalletInfo,
    BlockInfo,
    NetworkType,
    CreateWalletOptions,
    WalletCreationResponse
} from '../types/blockchain.types';
import { Logger } from '../utils/logger';

export abstract class BaseBlockchainService {
    protected config: NetworkConfig;
    protected logger: Logger;
    protected networkType: NetworkType;

    constructor(config: NetworkConfig, networkType: NetworkType) {
        this.config = config;
        this.networkType = networkType;
        this.logger = new Logger(`${networkType.toUpperCase()}Service`);
    }

    abstract initialize(): Promise<void>;
    abstract getBalance(address: string): Promise<number>;
    abstract sendTransaction(request: TransactionRequest): Promise<TransactionResponse>;
    abstract getTransactionStatus(hash: string): Promise<TransactionResponse>;
    abstract getWalletInfo(address: string): Promise<WalletInfo>;
    abstract getLatestBlock(): Promise<BlockInfo>;
    abstract validateAddress(address: string): boolean;
    abstract estimateGas(request: TransactionRequest): Promise<number>;
    abstract createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse>;
    public getNetworkType(): NetworkType {
        return this.networkType;
    }

    public getNetworkConfig(): NetworkConfig {
        return { ...this.config };
    }

    protected logTransaction(action: string, data: any): void {
        this.logger.info(`${action}:`, {
            network: this.networkType,
            data: JSON.stringify(data, null, 2)
        });
    }

    protected handleError(error: any, context: string): never {
        this.logger.error(`Error in ${context}:`, error);
        throw new Error(`${this.networkType} ${context} failed: ${error.message}`);
    }
}
