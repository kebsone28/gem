import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

console.log('🔍 Loaded DB_URL from env:', process.env.DATABASE_URL);
console.log('🔍 Current Working Directory:', process.cwd());

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 5000,
    dbUrl: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET || 'secret',
        accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
        refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    },
    cors: {
        // In production, restrict to the explicit CORS_ORIGIN env var.
        // In development, allow any localhost/127.0.0.1 port dynamically.
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
            : 'dev_dynamic'
    },
    sentry: {
        dsn: process.env.SENTRY_DSN
    }
};
