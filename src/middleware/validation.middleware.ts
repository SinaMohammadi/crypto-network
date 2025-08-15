import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { NetworkType } from '../types/blockchain.types';

export const validateNetwork = (req: Request, res: Response, next: NextFunction) => {
    const { network } = req.params;

    if (!Object.values(NetworkType).includes(network as NetworkType)) {
        return res.status(400).json({
            error: 'Invalid network type',
            supportedNetworks: Object.values(NetworkType)
        });
    }

    next();
};

export const validateTransactionRequest = (req: Request, res: Response, next: NextFunction) => {
    const schema = Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
        amount: Joi.number().positive().required(),
        memo: Joi.string().optional(),
        gasLimit: Joi.number().positive().optional(),
        gasPrice: Joi.number().positive().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map(d => d.message)
        });
    }

    next();
};

export const validateAddress = (req: Request, res: Response, next: NextFunction) => {
    const { address } = req.params;

    if (!address || typeof address !== 'string') {
        return res.status(400).json({
            error: 'Invalid address parameter'
        });
    }

    next();
};
