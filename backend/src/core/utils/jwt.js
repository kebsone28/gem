import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export const generateTokens = (user, impersonator = null) => {
    const payload = { 
        id: user.id || user._id, 
        email: user.email,
        organizationId: user.organizationId, 
        role: user.role || user.roleLegacy || 'user',
        permissions: user.permissions || []
    };

    let expiry = config.jwt.accessExpiry; // Standard (ex: 2h, 4h or 1d)

    if (impersonator) {
        payload.impersonatorId = impersonator.id;
        payload.originalRole = impersonator.role;
        payload.isSimulation = true;
        // Expiration courte pour l'impersonation (Sécurité Enterprise)
        expiry = '30m'; 
    }

    const accessToken = jwt.sign(
        payload,
        config.jwt.secret,
        { expiresIn: expiry }
    );

    const refreshToken = jwt.sign(
        { id: user.id || user._id },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiry }
    );

    return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, config.jwt.secret);
};

export const verifyRefreshToken = (token) => {
    return jwt.verify(token, config.jwt.refreshSecret);
};
