import { Client, Wallet, xrpToDrops, dropsToXrp, isValidAddress } from 'xrpl';
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';
import { derivePath } from 'ed25519-hd-key';

export class RippleService extends BaseBlockchainService {
    private client!: Client;
    private wallet?: Wallet;

    async initialize(): Promise<void> {
        try {
            this.client = new Client(this.config.rpcUrl);
            await this.client.connect();

            if (process.env.RIPPLE_SEED) {
                this.wallet = Wallet.fromSeed(process.env.RIPPLE_SEED);
                this.logger.info(`Wallet initialized: ${this.wallet.address}`);
            }

            this.logger.info('Ripple service initialized successfully');
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid XRP address format');
            }

            const response = await this.client.request({
                command: 'account_info',
                account: address,
                ledger_index: 'validated'
            });

            const balance = parseFloat(dropsToXrp(response.result.account_data.Balance));
            this.logger.debug(`Balance for ${address}: ${balance} XRP`);
            return balance;
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized. Please provide RIPPLE_SEED');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            if (request.from && !this.validateAddress(request.from)) {
                throw new Error('Invalid sender address');
            }

            const payment: any = {
                TransactionType: 'Payment',
                Account: this.wallet.address,
                Amount: xrpToDrops(request.amount.toString()),
                Destination: request.to,
            };

            if (request.memo && !isNaN(parseInt(request.memo))) {
                payment.DestinationTag = parseInt(request.memo);
            }

            if (request.memo && isNaN(parseInt(request.memo))) {
                payment.Memos = [{
                    Memo: {
                        MemoData: Buffer.from(request.memo, 'utf8').toString('hex').toUpperCase()
                    }
                }];
            }

            const prepared = await this.client.autofill(payment);
            const signed = this.wallet.sign(prepared);
            const result = await this.client.submitAndWait(signed.tx_blob);

            this.logTransaction('sendTransaction', {
                hash: result.result.hash,
                to: request.to,
                amount: request.amount,
                fee: result.result.Fee ? parseFloat(dropsToXrp(result.result.Fee)) : undefined
            });

            return {
                hash: result.result.hash,
                status: result.result.validated ? 'confirmed' : 'pending',
                fee: result.result.Fee ? parseFloat(dropsToXrp(result.result.Fee)) : undefined,
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            const response = await this.client.request({
                command: 'tx',
                transaction: hash
            });

            const status = response.result.validated ? 'confirmed' : 'pending';
            const fee = response.result.Fee ? parseFloat(dropsToXrp(response.result.Fee)) : undefined;

            return {
                hash,
                status,
                blockNumber: response.result.ledger_index,
                fee,
                timestamp: response.result.date ? response.result.date + 946684800 : Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'getTransactionStatus');
        }
    }

    async getWalletInfo(address: string): Promise<WalletInfo> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid XRP address format');
            }

            const balance = await this.getBalance(address);

            const accountInfo = await this.client.request({
                command: 'account_info',
                account: address,
                ledger_index: 'validated'
            });

            const transactionCount = accountInfo.result.account_data.Sequence || 0;

            this.logger.debug(`Wallet info for ${address}: ${balance} XRP, ${transactionCount} transactions`);

            return {
                address,
                balance,
                nativeToken: 'XRP',
                transactionCount
            };
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const response = await this.client.request({
                command: 'ledger',
                ledger_index: 'validated',
                transactions: true
            });

            const ledger = response.result.ledger;

            return {
                number: +ledger.ledger_index,
                hash: ledger.ledger_hash,
                timestamp: ledger.close_time + 946684800,
                transactionCount: Array.isArray(ledger.transactions) ? ledger.transactions.length : 0,
                baseFeePerGas: undefined
            };
        } catch (error) {
            this.handleError(error, 'getLatestBlock');
        }
    }

    validateAddress(address: string): boolean {
        try {
            return isValidAddress(address);
        } catch {
            return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const serverInfo = await this.client.request({
                command: 'server_info'
            });

            const baseFeeDrops = (serverInfo.result.info as any).validated_ledger?.base_fee || 10;
            const baseFee = parseFloat(dropsToXrp(baseFeeDrops.toString()));
            this.logger.debug(`Estimated fee: ${baseFee} XRP`);
            return baseFee;
        } catch (error) {
            return 0.00001;
        }
    }

    async getServerInfo(): Promise<{
        ledgerVersion: number;
        baseFee: number;
        reserveBase: number;
        reserveInc: number;
    }> {
        try {
            const response = await this.client.request({
                command: 'server_info'
            });

            const info = (response.result.info as any);
            const validatedLedger = info.validated_ledger;

            return {
                ledgerVersion: validatedLedger?.seq || 0,
                baseFee: validatedLedger?.base_fee ? parseFloat(dropsToXrp(validatedLedger.base_fee.toString())) : 0.00001,
                reserveBase: validatedLedger?.reserve_base ? parseFloat(dropsToXrp(validatedLedger.reserve_base.toString())) : 10,
                reserveInc: validatedLedger?.reserve_inc ? parseFloat(dropsToXrp(validatedLedger.reserve_inc.toString())) : 2
            };
        } catch (error) {
            this.handleError(error, 'getServerInfo');
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

            const response = await this.client.request({
                command: 'account_tx',
                account: address,
                limit,
                ledger_index_min: -1,
                ledger_index_max: -1
            });

            return response.result.transactions.map((tx: any) => tx.tx.hash);
        } catch (error) {
            this.handleError(error, 'getTransactionHistory');
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            return this.client.isConnected();
        } catch {
            return false;
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        ledgerVersion: number;
        baseFee: number;
        reserves: { base: number; increment: number };
    }> {
        try {
            const serverInfo = await this.getServerInfo();

            return {
                name: 'XRPL',
                ledgerVersion: serverInfo.ledgerVersion,
                baseFee: serverInfo.baseFee,
                reserves: {
                    base: serverInfo.reserveBase,
                    increment: serverInfo.reserveInc
                }
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async getAccountReserve(address: string): Promise<{
        requiredReserve: number;
        availableBalance: number;
        ownerCount: number;
    }> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid XRP address format');
            }

            const [accountInfo, serverInfo] = await Promise.all([
                this.client.request({
                    command: 'account_info',
                    account: address,
                    ledger_index: 'validated'
                }),
                this.getServerInfo()
            ]);

            const ownerCount = accountInfo.result.account_data.OwnerCount || 0;
            const balance = parseFloat(dropsToXrp(accountInfo.result.account_data.Balance));
            const requiredReserve = serverInfo.reserveBase + (ownerCount * serverInfo.reserveInc);
            const availableBalance = Math.max(0, balance - requiredReserve);

            return {
                requiredReserve,
                availableBalance,
                ownerCount
            };
        } catch (error) {
            this.handleError(error, 'getAccountReserve');
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.client.isConnected()) {
                await this.client.disconnect();
                this.logger.info('Ripple client disconnected');
            }
        } catch (error) {
            this.logger.error('Error disconnecting Ripple client:', error);
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let wallet: Wallet;
            let mnemonic: string | undefined;
            let usedIndex: number | undefined;
            let usedDerivationPath: string | undefined;

            const { generateMnemonic, mnemonicToSeedSync } = await import('bip39');

            if (options?.mnemonic) {
                mnemonic = options.mnemonic;

                if (options?.index !== undefined) {
                    usedIndex = options.index;

                    usedDerivationPath = options.derivationPath || `m/44'/144'/${options.index}'/0/0`;

                    const seed = mnemonicToSeedSync(mnemonic);

                    const derivedSeed = derivePath(usedDerivationPath, seed.toString('hex')).key;

                    wallet = Wallet.fromSeed(Buffer.from(derivedSeed).toString('hex'));

                    this.logger.info(`Created Ripple wallet with derivation path: ${usedDerivationPath}`);
                } else {
                    wallet = Wallet.fromSeed(mnemonic);
                }
            } else {

                if (options?.index !== undefined) {
                    mnemonic = generateMnemonic();
                    usedIndex = options.index;
                    usedDerivationPath = options.derivationPath || `m/44'/144'/${options.index}'/0/0`;

                    const seed = mnemonicToSeedSync(mnemonic);
                    const derivedSeed = derivePath(usedDerivationPath, seed.toString('hex')).key;
                    wallet = Wallet.fromSeed(Buffer.from(derivedSeed).toString('hex'));

                    this.logger.info(`Created new Ripple wallet with derivation path: ${usedDerivationPath}`);
                } else {
                    const generated = Wallet.generate();
                    wallet = generated;
                }
            }

            this.logger.info(`Created new Ripple wallet: ${wallet.address}`);

            return {
                address: wallet.address,
                seed: wallet.seed,
                publicKey: wallet.publicKey,
                privateKey: wallet.privateKey,
                mnemonic,
                network: 'ripple',
                index: usedIndex,
                derivationPath: usedDerivationPath
            };
        } catch (error) {
            this.handleError(error, 'createWallet');
        }
    }
}
