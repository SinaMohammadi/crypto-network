import { Router } from 'express';
import { BlockchainController } from '../controllers/blockchain.controller';
import {
    validateNetwork,
    validateTransactionRequest,
    validateAddress
} from '../middleware/validation.middleware';
import { rateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();
const controller = new BlockchainController();

router.get('/:network/wallet/create',
    validateNetwork,
    rateLimiter,
    controller.createWallet.bind(controller)
);

router.get('/networks', controller.getSupportedNetworks.bind(controller));



router.get('/:network/balance/:address',
    validateNetwork,
    validateAddress,
    rateLimiter,
    controller.getBalance.bind(controller)
);

router.get('/balance/:address',
    validateAddress,
    rateLimiter,
    controller.getMultiNetworkBalance.bind(controller)
);


router.post('/:network/transaction',
    validateNetwork,
    validateTransactionRequest,
    rateLimiter,
    controller.sendTransaction.bind(controller)
);

router.get('/:network/transaction/:hash',
    validateNetwork,
    rateLimiter,
    controller.getTransactionStatus.bind(controller)
);

router.post('/:network/estimate-gas',
    validateNetwork,
    validateTransactionRequest,
    rateLimiter,
    controller.estimateGas.bind(controller)
);

router.get('/:network/wallet/:address',
    validateNetwork,
    validateAddress,
    rateLimiter,
    controller.getWalletInfo.bind(controller)
);

router.get('/:network/block/latest',
    validateNetwork,
    rateLimiter,
    controller.getLatestBlock.bind(controller)
);

export default router;