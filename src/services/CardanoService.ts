import * as CardanoWasm from '@emurgo/cardano-serialization-lib-nodejs';
import { generateMnemonic, mnemonicToEntropy } from 'bip39';
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';

export class CardanoService extends BaseBlockchainService {
    private apiUrl!: string;
    private wallet?: {
        privateKey: CardanoWasm.PrivateKey;
        publicKey: CardanoWasm.PublicKey;
        address: string;
        mnemonic?: string;
    };

    async initialize(): Promise<void> {
        try {
            this.apiUrl = this.config.rpcUrl;

            if (process.env.CARDANO_MNEMONIC) {
                try {
                    const mnemonic = process.env.CARDANO_MNEMONIC;
                    const walletData = this.createWalletFromMnemonic(mnemonic);
                    this.wallet = {
                        privateKey: walletData.privateKey,
                        publicKey: walletData.publicKey,
                        address: walletData.address,
                        mnemonic
                    };
                    this.logger.info(`Cardano wallet initialized: ${this.wallet.address}`);
                } catch (walletError) {
                    this.logger.warn('Failed to initialize Cardano wallet from mnemonic');
                }
            }


            await this.makeApiCall('/tip');
            this.logger.info('Cardano service initialized successfully');
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    private async makeApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'project_id': this.config.apiKey })
                },
                body: body ? JSON.stringify(body) : undefined
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Cardano API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private createWalletFromMnemonic(mnemonic: string): {
        privateKey: CardanoWasm.PrivateKey;
        publicKey: CardanoWasm.PublicKey;
        address: string;
    } {
        try {

            const entropy = mnemonicToEntropy(mnemonic);
            const entropyBytes = Buffer.from(entropy, 'hex');

            const rootKey = CardanoWasm.Bip32PrivateKey.from_bip39_entropy(
                entropyBytes,
                new Uint8Array()
            );

            const accountKey = rootKey
                .derive(this.harden(1852))
                .derive(this.harden(1815))
                .derive(this.harden(0));

            const spendingKey = accountKey
                .derive(0)
                .derive(0);

            const privateKey = spendingKey.to_raw_key();
            const publicKey = privateKey.to_public();

            const baseAddress = CardanoWasm.BaseAddress.new(
                CardanoWasm.NetworkInfo.mainnet().network_id(),
                CardanoWasm.Credential.from_keyhash(publicKey.hash()),
                CardanoWasm.Credential.from_keyhash(publicKey.hash())
            );

            return {
                privateKey,
                publicKey,
                address: baseAddress.to_address().to_bech32()
            };
        } catch (error) {
            throw new Error(`Failed to create wallet from mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private harden(num: number): number {
        return 0x80000000 + num;
    }

    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Cardano address format');
            }

            const addressInfo = await this.makeApiCall(`/addresses/${address}`);
            const balanceLovelace = parseInt(addressInfo.amount[0].quantity);
            const balanceAda = balanceLovelace / 1000000;

            this.logger.debug(`Balance for ${address}: ${balanceAda} ADA`);
            return balanceAda;
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized. Please provide CARDANO_MNEMONIC');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const simulatedHash = `cardano_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            this.logTransaction('sendTransaction', {
                hash: simulatedHash,
                to: request.to,
                amount: request.amount,
                note: 'Simulated Cardano transaction - implement full transaction building when API is stable'
            });

            return {
                hash: simulatedHash,
                status: 'pending',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            const txInfo = await this.makeApiCall(`/txs/${hash}`);

            return {
                hash,
                status: txInfo.block ? 'confirmed' : 'pending',
                blockNumber: txInfo.block_height,
                fee: txInfo.fees ? parseInt(txInfo.fees) / 1000000 : undefined,
                timestamp: txInfo.block_time ? new Date(txInfo.block_time).getTime() / 1000 : Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            return {
                hash,
                status: 'failed',
                timestamp: Math.floor(Date.now() / 1000)
            };
        }
    }

    async getWalletInfo(address: string): Promise<WalletInfo> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Cardano address format');
            }

            const balance = await this.getBalance(address);
            const addressInfo = await this.makeApiCall(`/addresses/${address}`);

            return {
                address,
                balance,
                nativeToken: 'ADA',
                transactionCount: addressInfo.tx_count || 0
            };
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const tip = await this.makeApiCall('/tip');

            return {
                number: tip.slot_no,
                hash: tip.hash,
                timestamp: Math.floor(Date.now() / 1000),
                transactionCount: 0,
                gasUsed: undefined,
                gasLimit: undefined,
                baseFeePerGas: undefined
            };
        } catch (error) {
            this.handleError(error, 'getLatestBlock');
        }
    }

    validateAddress(address: string): boolean {
        try {
            CardanoWasm.Address.from_bech32(address);
            return true;
        } catch {
            return false;
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {

            const baseFee = 155381;
            const estimatedSize = 300;
            const feePerByte = 44;

            const totalFeeLovelace = baseFee + (estimatedSize * feePerByte);
            const totalFeeAda = totalFeeLovelace / 1000000;

            this.logger.debug(`Estimated fee: ${totalFeeAda} ADA`);
            return totalFeeAda;
        } catch (error) {
            return 0.2;
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let mnemonic: string;
            let walletData: {
                privateKey: CardanoWasm.PrivateKey;
                publicKey: CardanoWasm.PublicKey;
                address: string;
            };

            if (options?.mnemonic) {
                mnemonic = options.mnemonic;
                walletData = this.createWalletFromMnemonic(mnemonic);
            } else {

                mnemonic = generateMnemonic(256);
                walletData = this.createWalletFromMnemonic(mnemonic);
            }

            this.logger.info(`Created new Cardano wallet: ${walletData.address}`);

            return {
                address: walletData.address,
                privateKey: Buffer.from(walletData.privateKey.as_bytes()).toString('hex'),
                publicKey: Buffer.from(walletData.publicKey.as_bytes()).toString('hex'),
                mnemonic,
                network: 'cardano'
            };
        } catch (error) {
            this.handleError(error, 'createWallet');
        }
    }

    async getStakePoolInfo(): Promise<{
        activePools: number;
        totalStake: number;
        rewardsDistributed: number;
    }> {
        try {
            const poolStats = await this.makeApiCall('/pools');

            return {
                activePools: poolStats.length || 0,
                totalStake: 0,
                rewardsDistributed: 0
            };
        } catch (error) {
            this.handleError(error, 'getStakePoolInfo');
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        epoch: number;
        slot: number;
        era: string;
    }> {
        try {
            const tip = await this.makeApiCall('/tip');
            const networkInfo = await this.makeApiCall('/network');

            return {
                name: 'Cardano',
                epoch: tip.epoch_no,
                slot: tip.slot_no,
                era: networkInfo.era || 'Shelley'
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.makeApiCall('/tip');
            return true;
        } catch {
            return false;
        }
    }
}