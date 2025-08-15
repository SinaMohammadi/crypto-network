const { TronWeb } = require('tronweb');
import { BaseBlockchainService } from '../abstracts/BaseBlockchainService';
import { TransactionRequest, TransactionResponse, WalletInfo, BlockInfo, CreateWalletOptions, WalletCreationResponse } from '../types/blockchain.types';

export class TRC20Service extends BaseBlockchainService {
    private tronWeb!: any
    private wallet?: any;
    private readonly TRX_TO_SUN = 1000000; // 1 TRX = 1,000,000 SUN

    async initialize(): Promise<void> {
        try {
            const fullNode = this.config.rpcUrl || 'https://api.trongrid.io';

            this.tronWeb = new TronWeb({
                fullHost: fullNode,
                // headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY || '' },
                privateKey: undefined
            });

            const nodeInfo = await this.tronWeb.trx.getNodeInfo();
            this.logger.info(`Connected to Tron network: ${nodeInfo.configNodeInfo.codeVersion}`);


            await this.initializeWallet();

            this.logger.info('TRC20 service initialized successfully');
        } catch (error: any) {
            console.log(error)
            this.handleError({ message: error.message }, 'initialization');
        }
    }

    private async initializeWallet(): Promise<void> {
        try {
            const seed = process.env.TRC20_SEED || process.env.SEED_PHRASE;
            const privateKey = process.env.TRON_PRIVATE_KEY || process.env.PRIVATE_KEY;
            const walletIndex = parseInt(process.env.TRON_WALLET_INDEX || process.env.WALLET_INDEX || '0');
            const derivationPath = process.env.TRON_DERIVATION_PATH || `m/44'/195'/${walletIndex}'/0/0`;

            if (seed) {
                const bip39 = require('bip39');
                const bip32 = require('bip32');

                if (!bip39.validateMnemonic(seed)) {
                    throw new Error('Invalid seed phrase provided');
                }

                this.logger.info('Initializing Tron wallet from seed phrase...');

                const seedBuffer = bip39.mnemonicToSeedSync(seed);
                const root = bip32.fromSeed(seedBuffer);
                const child = root.derivePath(derivationPath);

                const walletPrivateKey = child.privateKey.toString('hex');


                this.tronWeb.setPrivateKey(walletPrivateKey);


                this.wallet = this.tronWeb.address.fromPrivateKey(walletPrivateKey);

                this.logger.info(`Tron wallet initialized from seed: ${this.wallet}`);
                this.logger.info(`Derivation path used: ${derivationPath}`);

            } else if (privateKey) {

                this.logger.info('Initializing Tron wallet from private key...');

                this.tronWeb.setPrivateKey(privateKey);
                this.wallet = this.tronWeb.address.fromPrivateKey(privateKey);

                this.logger.info(`Tron wallet initialized from private key: ${this.wallet}`);
            } else {
                this.logger.warn('No seed phrase or private key provided. Wallet functions will be limited.');
            }
        } catch (error) {
            this.handleError(error, 'initializeWallet');
        }
    }
    async getBalance(address: string): Promise<number> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Tron address format');
            }

            const balance = await this.tronWeb.trx.getBalance(address);
            const balanceTrx = this.tronWeb.fromSun(balance);

            this.logger.debug(`Balance for ${address}: ${balanceTrx} TRX`);
            return parseFloat(balanceTrx);
        } catch (error) {
            this.handleError(error, 'getBalance');
        }
    }

    async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<number> {
        try {
            if (!this.validateAddress(tokenAddress) || !this.validateAddress(walletAddress)) {
                throw new Error('Invalid address format');
            }

            const contract = await this.tronWeb.contract().at(tokenAddress);
            const balance = await contract.balanceOf(walletAddress).call();
            const decimals = await contract.decimals().call();

            const tokenBalance = parseFloat(balance) / Math.pow(10, decimals);
            this.logger.debug(`Token balance for ${walletAddress}: ${tokenBalance}`);
            return tokenBalance;
        } catch (error) {
            this.handleError(error, 'getTokenBalance');
        }
    }

    async sendTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized. Please provide TRON_PRIVATE_KEY or PRIVATE_KEY');
            }

            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }

            const amountSun = this.tronWeb.toSun(request.amount);

            const transaction = await this.tronWeb.transactionBuilder.sendTrx(
                request.to,
                + amountSun,
                this.wallet
            );

            if (request.memo) {
                transaction.raw_data.data = this.tronWeb.toHex(request.memo);
            }

            const signedTransaction = await this.tronWeb.trx.sign(transaction);
            const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

            this.logTransaction('sendTransaction', {
                hash: result.txid,
                to: request.to,
                amount: request.amount,
                from: this.wallet,
                memo: request.memo
            });

            return {
                hash: result.txid,
                status: result.result ? 'pending' : 'failed',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTransaction');
        }
    }

    async sendTokenTransaction(tokenAddress: string, request: TransactionRequest): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            if (!this.validateAddress(tokenAddress) || !this.validateAddress(request.to)) {
                throw new Error('Invalid address format');
            }

            const contract = await this.tronWeb.contract().at(tokenAddress);
            const decimals = await contract.decimals().call();
            const amount = parseFloat(request.amount.toString()) * Math.pow(10, decimals);

            const transaction = await contract.transfer(request.to, amount).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: false
            });

            this.logTransaction('sendTokenTransaction', {
                hash: transaction,
                tokenAddress,
                to: request.to,
                amount: request.amount,
                from: this.wallet
            });

            return {
                hash: transaction,
                status: 'pending',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'sendTokenTransaction');
        }
    }

    async getTransactionStatus(hash: string): Promise<TransactionResponse> {
        try {
            const transaction = await this.tronWeb.trx.getTransaction(hash);

            if (!transaction || !transaction.txID) {
                return {
                    hash,
                    status: 'failed',
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }

            const transactionInfo = await this.tronWeb.trx.getTransactionInfo(hash);

            let status: 'pending' | 'confirmed' | 'failed' = 'pending';
            if (transactionInfo.id) {
                status = transactionInfo.result === 'SUCCESS' ? 'confirmed' : 'failed';
            }

            return {
                hash,
                status,
                blockNumber: transactionInfo.blockNumber,
                fee: transactionInfo.fee ? +this.tronWeb.fromSun(transactionInfo.fee) : undefined,
                gasUsed: transactionInfo.receipt?.energy_usage,
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'getTransactionStatus');
        }
    }

    async getWalletInfo(address: string): Promise<WalletInfo> {
        try {
            if (!this.validateAddress(address)) {
                throw new Error('Invalid Tron address format');
            }

            const [balance, account] = await Promise.all([
                this.getBalance(address),
                this.tronWeb.trx.getAccount(address)
            ]);

            return {
                address,
                balance,
                nativeToken: 'TRX',
                transactionCount: account.create_time ? 1 : 0,
                bandwidth: account.bandwidth || 0,
                energy: account.energy || 0,
                frozenAmount: account.frozen ? +this.tronWeb.fromSun(account.frozen[0]?.frozen_balance || 0) : 0
            };
        } catch (error) {
            this.handleError(error, 'getWalletInfo');
        }
    }

    async getLatestBlock(): Promise<BlockInfo> {
        try {
            const block = await this.tronWeb.trx.getCurrentBlock();

            return {
                number: block.block_header.raw_data.number,
                hash: block.blockID,
                timestamp: block.block_header.raw_data.timestamp,
                transactionCount: block.transactions ? block.transactions.length : 0,
                parentHash: block.block_header.raw_data.parentHash,
                witnessAddress: block.block_header.raw_data.witness_address
            };
        } catch (error) {
            this.handleError(error, 'getLatestBlock');
        }
    }

    validateAddress(address: string): boolean {
        try {
            return this.tronWeb.isAddress(address);
        } catch {
            return false;
        }
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(request.to)) {
                throw new Error('Invalid recipient address');
            }


            const amountSun = this.tronWeb.toSun(request.amount);

            const transaction = await this.tronWeb.transactionBuilder.sendTrx(
                request.to,
                +amountSun,
                request.from || this.wallet
            );


            const estimatedEnergy = 345;

            this.logger.debug(`Estimated energy for TRX transaction: ${estimatedEnergy}`);
            return estimatedEnergy;
        } catch (error) {
            this.handleError(error, 'estimateGas');
        }
    }

    async estimateTokenGas(tokenAddress: string, request: TransactionRequest): Promise<number> {
        try {
            if (!this.validateAddress(tokenAddress) || !this.validateAddress(request.to)) {
                throw new Error('Invalid address format');
            }

            const contract = await this.tronWeb.contract().at(tokenAddress);
            const decimals = await contract.decimals().call();
            const amount = parseFloat(request.amount.toString()) * Math.pow(10, decimals);

            const estimatedEnergy = 14000;

            this.logger.debug(`Estimated energy for token transaction: ${estimatedEnergy}`);
            return estimatedEnergy;
        } catch (error) {
            this.handleError(error, 'estimateTokenGas');
        }
    }

    async createWallet(options?: CreateWalletOptions): Promise<WalletCreationResponse> {
        try {
            let account: any;
            let mnemonic: string | undefined;
            let derivationPath: string | undefined;

            if (options?.mnemonic) {

                const bip39 = require('bip39');
                const bip32 = require('bip32');

                if (!bip39.validateMnemonic(options.mnemonic)) {
                    throw new Error('Invalid mnemonic phrase');
                }

                const seed = bip39.mnemonicToSeedSync(options.mnemonic);
                const root = bip32.fromSeed(seed);

                derivationPath = options.derivationPath || `m/44'/195'/${options.index || 0}'/0/0`;
                const child = root.derivePath(derivationPath);

                const privateKey = child.privateKey.toString('hex');
                account = this.tronWeb.address.fromPrivateKey(privateKey);
                mnemonic = options.mnemonic;
            } else {
                account = await this.tronWeb.createAccount();
                if (options?.index !== undefined) {
                    const bip39 = require('bip39');
                    mnemonic = bip39.generateMnemonic();
                    derivationPath = options.derivationPath || `m/44'/195'/${options.index}'/0/0`;
                }
            }

            this.logger.info(`Created new Tron wallet: ${account.address.base58}`);

            return {
                address: account.address.base58,
                privateKey: account.privateKey,
                publicKey: account.publicKey,
                mnemonic,
                network: 'tron',
                index: options?.index,
                derivationPath
            };
        } catch (error) {
            this.handleError(error, 'createWallet');
            throw error;
        }
    }

    async getCurrentGasPrice(): Promise<number> {
        try {
            const chainParameters = await this.tronWeb.trx.getChainParameters();
            const energyFee = chainParameters.find((p: any) => p.key === 'getEnergyFee')?.value || 420;

            this.logger.debug(`Current energy fee: ${energyFee} SUN per energy unit`);
            return energyFee;
        } catch (error) {
            this.handleError(error, 'getCurrentGasPrice');
        }
    }

    async getNetworkInfo(): Promise<{
        name: string;
        nodeInfo: any;
        chainParameters: any[];
        energyPrice: number;
    }> {
        try {
            const [nodeInfo, chainParameters] = await Promise.all([
                this.tronWeb.trx.getNodeInfo(),
                this.tronWeb.trx.getChainParameters()
            ]);

            const energyPrice = chainParameters.find((p: any) => p.key === 'getEnergyFee')?.value || 420;

            return {
                name: 'Tron',
                nodeInfo,
                chainParameters,
                energyPrice
            };
        } catch (error) {
            this.handleError(error, 'getNetworkInfo');
        }
    }

    async freezeBalance(amount: number, resource: 'BANDWIDTH' | 'ENERGY' = 'ENERGY', duration: number = 3): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const amountSun = this.tronWeb.toSun(amount);
            const transaction = await this.tronWeb.transactionBuilder.freezeBalance(
                +amountSun,
                duration,
                resource,
                this.wallet
            );

            const signedTransaction = await this.tronWeb.trx.sign(transaction);
            const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

            return {
                hash: result.txid,
                status: result.result ? 'pending' : 'failed',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'freezeBalance');
        }
    }

    async unfreezeBalance(resource: 'BANDWIDTH' | 'ENERGY' = 'ENERGY'): Promise<TransactionResponse> {
        try {
            if (!this.wallet) {
                throw new Error('Wallet not initialized');
            }

            const transaction = await this.tronWeb.transactionBuilder.unfreezeBalance(
                resource,
                this.wallet
            );

            const signedTransaction = await this.tronWeb.trx.sign(transaction);
            const result = await this.tronWeb.trx.sendRawTransaction(signedTransaction);

            return {
                hash: result.txid,
                status: result.result ? 'pending' : 'failed',
                timestamp: Math.floor(Date.now() / 1000)
            };
        } catch (error) {
            this.handleError(error, 'unfreezeBalance');
        }
    }

    async getAccountResources(address: string): Promise<any> {
        try {
            const resources = await this.tronWeb.trx.getAccountResources(address);
            return resources;
        } catch (error) {
            this.handleError(error, 'getAccountResources');
        }
    }

    async getTokenInfo(tokenAddress: string): Promise<any> {
        try {
            const contract = await this.tronWeb.contract().at(tokenAddress);

            const [name, symbol, decimals, totalSupply] = await Promise.all([
                contract.name().call(),
                contract.symbol().call(),
                contract.decimals().call(),
                contract.totalSupply().call()
            ]);

            return {
                address: tokenAddress,
                name,
                symbol,
                decimals: parseInt(decimals),
                totalSupply: totalSupply.toString()
            };
        } catch (error) {
            this.handleError(error, 'getTokenInfo');
        }
    }

    async getTransactionHistory(address: string, limit: number = 50): Promise<any[]> {
        try {
            const transactions = await this.tronWeb.trx.getTransactionsFromAddress(address, limit);
            return transactions;
        } catch (error) {
            this.handleError(error, 'getTransactionHistory');
        }
    }

    convertHexToTronAddress(hexAddress: string): string {
        return this.tronWeb.address.fromHex(hexAddress);
    }

    convertTronToHexAddress(tronAddress: string): string {
        return this.tronWeb.address.toHex(tronAddress);
    }

    sunToTrx(sun: number): number {
        return parseFloat(this.tronWeb.fromSun(sun));
    }

    trxToSun(trx: number): number {
        return parseInt(this.tronWeb.toSun(trx));
    }
}