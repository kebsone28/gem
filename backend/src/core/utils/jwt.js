import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { 
            id: user.id || user._id, 
            email: user.email,
            organizationId: user.organizationId, 
            role: user.role || user.roleLegacy || 'user',
            permissions: user.permissions || []
        },
        config.jwt.secret,
        { expiresIn: config.jwt.accessExpiry }
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
