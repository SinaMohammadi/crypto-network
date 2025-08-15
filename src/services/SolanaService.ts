import {
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    Keypair,
    ParsedAccountData
} from '@solana/web3.js';
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';
import { derivePath } from 'ed25519-hd-key';

export class SolanaService extends BaseBlockchainService {
    private connection!: Connection;
    private keypair?: Keypair;

    async initialize(): Promise<void> {
        try {
            this.connection = new Connection(this.config.rpcUrl, 'confirmed');

            const version = await this.connection.getVersion();
            this.logger.info(`Connected to Solana cluster version: ${version['solana-core']}`);

            if (process.env.SOLANA_PRIVATE_KEY) {
                try {
                    const secretKey = JSON.parse(process.env.SOLANA_PRIVATE_KEY);
                    this.keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
                    this.logger.info(`Wallet initialized: ${this.keypair.publicKey.toString()}`);
                } catch (keyError) {
                    this.logger.warn('Failed to initialize wallet from SOLANA_PRIVATE_KEY');
                }
            }

            this.logger.info('Solana service initialized successfully');
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Solana address format');
            }

            const publicKey = new PublicKey(address);
            const balance = await this.connection.getBalance(publicKey);
            const solBalance = balance / LAMPORTS_PER_SOL;

            this.logger.debug(`Balance for ${address}: ${solBalance} SOL`);
            return solBalance;
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.keypair) {
                throw new Error('Wallet not initialized. Please provide SOLANA_PRIVATE_KEY');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const toPublicKey = new PublicKey(request.to);
            const lamports = Math.floor(request.amount * LAMPORTS_PER_SOL);

            if (lamports <= 0) {
                throw new Error('Invalid amount: must be greater than 0');
            }

            let transaction = new Transaction();

            const transferInstruction = SystemProgram.transfer({
                fromPubkey: this.keypair.publicKey,
                toPubkey: toPublicKey,
                lamports: lamports
            });

            transaction.add(transferInstruction);

            if (request.memo) {
                const memoInstruction = {
                    keys: [],
                    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                    data: Buffer.from(request.memo, 'utf8')
                };
                transaction.add(memoInstruction);
            }

            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.keypair],
                {
                    commitment: 'confirmed',
                    maxRetries: 3
                }
            );

            this.logTransaction('sendTransaction', {
                signature,
                to: request.to,
                amount: request.amount,
                lamports,
                memo: request.memo
            });

            return {
                hash: signature,
                status: 'confirmed',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            const status = await this.connection.getSignatureStatus(hash);

            if (!status.value) {
                return {
                    hash,
                    status: 'failed',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            let transactionStatus: 'pending' | 'confirmed' | 'failed' = 'pending';

            if (status.value.err) {
                transactionStatus = 'failed';
            } else if (status.value.confirmationStatus === 'finalized' ||
                status.value.confirmationStatus === 'confirmed') {
                transactionStatus = 'confirmed';
            }

            const transaction = await this.connection.getTransaction(hash, {
                commitment: 'confirmed'
            });

            return {
                hash,
                status: transactionStatus,
                blockNumber: status.value.slot,
                fee: transaction?.meta?.fee ? transaction.meta.fee / LAMPORTS_PER_SOL : undefined,
                timestamp: transaction?.blockTime || Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'getTransactionStatus');
        }
    }

    async getWalletInfo(address: string): Promise<WalletInfo> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Solana address format');
            }

            const publicKey = new PublicKey(address);
            const balance = await this.getBalance(address);

            const signatures = await this.connection.getSignaturesForAddress(
                publicKey,
                { limit: 1 }
            );

            const transactionCount = signatures.length;

            this.logger.debug(`Wallet info for ${address}: ${balance} SOL, recent transactions: ${transactionCount}`);

            return {
                address,
                balance,
                nativeToken: 'SOL',
                transactionCount
            };
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const slot = await this.connection.getSlot('finalized');
            const blockTime = await this.connection.getBlockTime(slot);
            const block = await this.connection.getBlock(slot, {
                maxSupportedTransactionVersion: 0
            });

            return {
                number: slot,
                hash: block?.blockhash || '',
                timestamp: blockTime || Math.floor(Date.now() / 1000),
                transactionCount: block?.transactions?.length || 0,
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
            const publicKey = new PublicKey(address);
            return PublicKey.isOnCurve(publicKey);
        } catch {
            return false;
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const recentBlockhash = await this.connection.getLatestBlockhash();
            let transaction = new Transaction({
                recentBlockhash: recentBlockhash.blockhash,
                feePayer: this.keypair?.publicKey || new PublicKey(request.from || '11111111111111111111111111111111')
            });

            const transferInstruction = SystemProgram.transfer({
                fromPubkey: this.keypair?.publicKey || new PublicKey(request.from || '11111111111111111111111111111111'),
                toPubkey: new PublicKey(request.to),
                lamports: Math.floor(request.amount * LAMPORTS_PER_SOL)
            });

            transaction.add(transferInstruction);

            if (request.memo) {
                const memoInstruction = {
                    keys: [],
                    programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                    data: Buffer.from(request.memo, 'utf8')
                };
                transaction.add(memoInstruction);
            }

            const fee = await this.connection.getFeeForMessage(
                transaction.compileMessage(),
                'confirmed'
            );

            const feeInSol = (fee.value || 5000) / LAMPORTS_PER_SOL;
            this.logger.debug(`Estimated fee: ${feeInSol} SOL`);
            return feeInSol;
        } catch (error) {
            return 0.000005;
        }
    }

    async getRecentBlockhash(): Promise<{
        blockhash: string;
        lastValidBlockHeight: number;
    }> {
        try {
            const response = await this.connection.getLatestBlockhash('confirmed');
            return response;
        } catch (error) {
            this.handleError(error, 'getRecentBlockhash');
        }
    }

    async getTransactionHistory(
        address: string,
        limit: number = 100
    ): Promise<string[]> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid address format');
            }

            const publicKey = new PublicKey(address);
            const signatures = await this.connection.getSignaturesForAddress(
                publicKey,
                { limit }
            );

            return signatures.map(sig => sig.signature);
        } catch (error) {
            this.handleError(error, 'getTransactionHistory');
        }
    }

    async getTokenAccounts(address: string): Promise<Array<{
        mint: string;
        balance: number;
        decimals: number;
    }>> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid address format');
            }

            const publicKey = new PublicKey(address);
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                publicKey,
                { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
            );

            return tokenAccounts.value.map(account => {
                const parsedData = account.account.data as ParsedAccountData;
                const info = parsedData.parsed.info;
                return {
                    mint: info.mint,
                    balance: parseFloat(info.tokenAmount.uiAmountString || '0'),
                    decimals: info.tokenAmount.decimals
                };
            });
        } catch (error) {
            this.handleError(error, 'getTokenAccounts');
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.connection.getVersion();
            return true;
        } catch {
            return false;
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        cluster: string;
        version: string;
        slot: number;
        blockTime: number;
    }> {
        try {
            const [version, slot, blockTime] = await Promise.all([
                this.connection.getVersion(),
                this.connection.getSlot('finalized'),
                this.connection.getBlockTime(await this.connection.getSlot('finalized'))
            ]);

            return {
                name: 'Solana',
                cluster: this.config.rpcUrl.includes('devnet') ? 'devnet' :
                    this.config.rpcUrl.includes('testnet') ? 'testnet' : 'mainnet',
                version: version['solana-core'],
                slot,
                blockTime: blockTime || Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async getMinimumBalanceForRentExemption(dataLength: number = 0): Promise<number> {
        try {
            const lamports = await this.connection.getMinimumBalanceForRentExemption(dataLength);
            return lamports / LAMPORTS_PER_SOL;
        } catch (error) {
            this.handleError(error, 'getMinimumBalanceForRentExemption');
        }
    }

    async airdropSol(address: string, amount: number): Promise<string> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid address format');
            }

            const publicKey = new PublicKey(address);
            const lamports = amount * LAMPORTS_PER_SOL;

            const signature = await this.connection.requestAirdrop(publicKey, lamports);
            await this.connection.confirmTransaction(signature);

            this.logger.info(`Airdropped ${amount} SOL to ${address}`);
            return signature;
        } catch (error) {
            this.handleError(error, 'airdropSol');
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let keypair: Keypair;
            let mnemonic: string | undefined;
            let usedIndex: number | undefined;
            let usedDerivationPath: string | undefined;

            const { generateMnemonic, mnemonicToSeedSync } = await import('bip39');

            if (options?.mnemonic) {
                mnemonic = options.mnemonic;
            } else if (process.env.SOLANA_SEED) {
                mnemonic = process.env.SOLANA_SEED;
            } else {

                mnemonic = generateMnemonic();
            }

            const seed = mnemonicToSeedSync(mnemonic);

            if (options?.index !== undefined) {
                usedIndex = options.index;
                usedDerivationPath = options.derivationPath || `m/44'/501'/${options.index}'/0'`;

                const derivedSeed = derivePath(usedDerivationPath, seed.toString('hex')).key;
                keypair = Keypair.fromSeed(derivedSeed);

                this.logger.info(`Created Solana wallet with derivation path: ${usedDerivationPath}`);
            } else {

                keypair = Keypair.fromSeed(seed.slice(0, 32));
            }

            const address = keypair.publicKey.toString();
            const privateKeyArray = Array.from(keypair.secretKey);

            this.logger.info(`Created new Solana wallet: ${address}`);

            return {
                address,
                privateKey: JSON.stringify(privateKeyArray),
                publicKey: keypair.publicKey.toString(),
                mnemonic,
                keyPair: keypair,
                network: 'solana',
                index: usedIndex,
                derivationPath: usedDerivationPath
            };
        } catch (error) {
            this.handleError(error, 'createWallet');

        }
    }
}
