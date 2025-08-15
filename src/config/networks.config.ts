import { NetworkConfig, NetworkType } from '../types/blockchain.types';


export const NETWORK_CONFIGS: Record<NetworkType, NetworkConfig> = {
    [NetworkType.ARBITRUM]: {
        name: 'Arbitrum One',
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        chainId: 42161,
        testnet: false,
        enable: false
    },
    [NetworkType.TON]: {
        name: 'TON Mainnet',
        rpcUrl: process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.TON_API_KEY,
        testnet: false,
        enable: false
    },
    [NetworkType.SOLANA]: {
        name: 'Solana Mainnet',
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
        testnet: false,
        enable: false
    },
    [NetworkType.RIPPLE]: {
        name: 'XRPL Mainnet',
        rpcUrl: process.env.RIPPLE_RPC_URL || 'wss://xrplcluster.com',
        testnet: false,
        enable: false
    },
    [NetworkType.POLYGON]: {
        name: 'Polygon Mainnet',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        chainId: 137,
        testnet: false,
        enable: false
    },
    [NetworkType.AVALANCHE]: {
        name: 'Avalanche C-Chain',
        rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        chainId: 43114,
        testnet: false,
        enable: false
    },
    [NetworkType.CARDANO]: {
        name: 'Cardano Mainnet',
        rpcUrl: process.env.CARDANO_RPC_URL || 'https://cardano-mainnet.blockfrost.io/api/v0',
        apiKey: process.env.CARDANO_API_KEY,
        testnet: false,
        enable: false
    },
    [NetworkType.TRC20]: {
        name: 'Tron Mainnet',
        rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
        apiKey: process.env.TRON_API_KEY,
        testnet: false,
        enable: true
    },
    // [NetworkType.TRC20_TESTNET]: {
    //     name: 'Tron Testnet (Shasta)',
    //     rpcUrl: process.env.TRON_TESTNET_RPC_URL || 'https://api.shasta.trongrid.io',
    //     apiKey: process.env.TRON_TESTNET_API_KEY,
    //     testnet: true
    // },
    // [NetworkType.BEP20]: {
    //     name: 'BSC Mainnet',
    //     rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    //     chainId: 56,
    //     testnet: false
    // },
    // [NetworkType.BEP20_TESTNET]: {
    //     name: 'BSC Testnet',
    //     rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    //     chainId: 97,
    //     testnet: true
    // },
    // [NetworkType.BNB_CHAIN]: {
    //     name: 'Binance Chain',
    //     rpcUrl: process.env.BNB_RPC_URL || 'https://dex.binance.org',
    //     apiKey: process.env.BNB_API_KEY,
    //     testnet: false
    // },
    // [NetworkType.BNB_CHAIN_TESTNET]: {
    //     name: 'Binance Chain Testnet',
    //     rpcUrl: process.env.BNB_TESTNET_RPC_URL || 'https://testnet-dex.binance.org',
    //     apiKey: process.env.BNB_TESTNET_API_KEY,
    //     testnet: true
    // },
    // [NetworkType.BITCOIN]: {
    //     name: 'Bitcoin Mainnet',
    //     rpcUrl: process.env.BTC_RPC_URL || 'https://blockstream.info/api',
    //     testnet: false
    // },
    // [NetworkType.BITCOIN_TESTNET]: {
    //     name: 'Bitcoin Testnet',
    //     rpcUrl: process.env.BTC_TESTNET_RPC_URL || 'https://blockstream.info/testnet/api',
    //     testnet: true
    // },
    // [NetworkType.ETHEREUM]: {
    //     name: 'Ethereum Mainnet',
    //     rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    //     chainId: 1,
    //     testnet: false
    // },
    // [NetworkType.ETHEREUM_SEPOLIA]: {
    //     name: 'Ethereum Sepolia',
    //     rpcUrl: process.env.ETH_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
    //     chainId: 11155111,
    //     testnet: true
    // }
};
export const ALTERNATIVE_RPCS = {
    [NetworkType.TRC20]: [
        'https://api.trongrid.io',
        'https://api.tronstack.io',
        'https://tron.blockpi.network/v1/rpc/public'
    ],
    // [NetworkType.TRC20_TESTNET]: [
    //     'https://api.shasta.trongrid.io',
    //     'https://api.nileex.io'
    // ],
    // [NetworkType.BEP20]: [
    //     'https://bsc-dataseed1.binance.org',
    //     'https://bsc-dataseed2.binance.org',
    //     'https://bsc-dataseed3.binance.org',
    //     'https://bsc-dataseed4.binance.org'
    // ],
    // [NetworkType.BEP20_TESTNET]: [
    //     'https://data-seed-prebsc-1-s1.binance.org:8545',
    //     'https://data-seed-prebsc-2-s1.binance.org:8545'
    // ],
    // [NetworkType.BITCOIN]: [
    //     'https://blockstream.info/api',
    //     'https://mempool.space/api'
    // ],
    // [NetworkType.BITCOIN_TESTNET]: [
    //     'https://blockstream.info/testnet/api',
    //     'https://mempool.space/testnet/api'
    // ]
};
