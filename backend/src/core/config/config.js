import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

console.log('🔍 Loaded DB_URL from env:', process.env.DATABASE_URL);
console.log('🔍 Current Working Directory:', process.cwd());

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5005', 10),
    dbUrl: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET || 'secret',
        accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
        refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    },
    cors: {
        origin: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
                .map(o => o.trim())
                .map(o => (o !== '*' && !o.startsWith('http')) ? `https://${o}` : o)
            : '*'
    },
    sentry: {
        dsn: process.env.SENTRY_DSN
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || null,
        tls: process.env.REDIS_TLS === 'true'
    },
    storage: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        bucketName: process.env.S3_BUCKET || 'proquelec-assets'
    }
};
