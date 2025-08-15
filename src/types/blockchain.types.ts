export interface CreateWalletOptions {
    mnemonic?: string;
    password?: string;
    derivationPath?: string;
    keySize?: number;
    index?: number
}

export interface WalletCreationResponse {
    address: string;
    privateKey?: string;
    publicKey?: string;
    mnemonic?: string;
    seed?: string;
    keyPair?: any;
    derivationPath?: string;
    network: string;
    index?: number
}

export interface NetworkConfig {
    name: string;
    rpcUrl: string;
    chainId?: number;
    apiKey?: string;
    testnet?: boolean;
    enable: boolean
}

export interface TransactionRequest {
    from: string;
    to: string;
    amount: number;
    memo?: string;
    gasLimit?: number;
    gasPrice?: number;
}

export interface TransactionResponse {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
    gasUsed?: number;
    fee?: number;
    timestamp?: number;
}

export interface WalletInfo {
    address: string;
    balance: number;
    nativeToken: string;
    transactionCount?: number;
    energy?: number// in trc20
    frozenAmount?: number// in trc20
    bandwidth?: number// in trc20
}

export interface BlockInfo {
    number: number;
    hash: string;
    timestamp: number;
    transactionCount: number;
    gasUsed?: number;
    gasLimit?: number;
    baseFeePerGas?: number;
    parentHash?: string // in trc20
    witnessAddress?: string// in trc20
}

export interface FeeData {
    gasPrice: number;
    maxFeePerGas: number;
    maxPriorityFeePerGas: number;
}

export interface NetworkInfo {
    name: string;
    chainId: number;
    blockNumber: number;
    gasPrice: number;
}

export enum NetworkType {
    ARBITRUM = 'arbitrum',
    TON = 'ton',
    SOLANA = 'solana',
    RIPPLE = 'ripple',
    POLYGON = 'polygon',
    AVALANCHE = 'avalanche',
    CARDANO = 'cardano',
    TRC20 = 'trc20',
    // TRC20_TESTNET = 'trc20_testnet',
    // // BEP20 = 'bep20',
    // BEP20_TESTNET = 'bep20_testnet',
    // BNB_CHAIN = 'bnb_chain',
    // BNB_CHAIN_TESTNET = 'bnb_chain_testnet',
    // BITCOIN = 'bitcoin',
    // BITCOIN_TESTNET = 'bitcoin_testnet',
    // ETHEREUM = 'ethereum',
    // ETHEREUM_SEPOLIA = 'ethereum_sepolia'
}
export interface ExtendedWalletInfo extends WalletInfo {
    transactionCount: number;
}

export interface ExtendedBlockInfo extends BlockInfo {
    gasUsed: number;
    gasLimit: number;
    baseFeePerGas?: number;
}