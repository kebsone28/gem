import dotenv from 'dotenv';

dotenv.config();

const parsePort = (val, fallback) => {
    const port = parseInt(val, 10);
    return isNaN(port) || port <= 0 || port > 65535 ? fallback : port;
};

if (process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.log('🔍 Loaded DB_URL from env: PRESENT');
} else {
    // eslint-disable-next-line no-console
    console.log('🔍 Loaded DB_URL from env: MISSING');
}
// eslint-disable-next-line no-console
console.log('🔍 Loaded REDIS_URL from env:', process.env.REDIS_URL ? 'PRESENT' : 'MISSING (Defaults to localhost)');
// eslint-disable-next-line no-console
console.log('🔍 Current Working Directory:', process.cwd());

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parsePort(process.env.PORT, 5005),
    dbUrl: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET || 'secret',
        accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
        refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    },
    cors: {
        origin: (origin, callback) => {
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5175',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:5173',
                'http://gem.proquelec.sn',
                'https://gem.proquelec.sn',
                'http://www.gem.proquelec.sn',
                'https://www.gem.proquelec.sn'
            ];
            // En développement, on est plus tolérant sur les erreurs CORS pour éviter les 500
            const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
            
            if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || isDev) {
                callback(null, true);
            } else {
                console.warn(`🔒 CORS Blocked attempt from origin: ${origin}`);
                callback(new Error('CORS non autorisé par la politique PROQUELEC'));
            }
        },
        credentials: true
    },
    sentry: {
        dsn: process.env.SENTRY_DSN
    },
    redis: {
        url: process.env.REDIS_URL, // Utilisé en priorité par IORedis sur Railway
        host: process.env.REDIS_HOST || 'localhost',
        port: parsePort(process.env.REDIS_PORT, 6379),
        password: process.env.REDIS_PASSWORD || null,
        tls: process.env.REDIS_TLS === 'true'
    },
    ai: {
        openaiKey: process.env.OPENAI_API_KEY || '',
        openaiBaseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '700', 10),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'https://proquelec.wanekoohost.com',
        ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
        cacheTtlSeconds: parseInt(process.env.AI_CACHE_TTL_SECONDS || '300', 10)
    },
    storage: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        bucketName: process.env.S3_BUCKET || 'proquelec-assets'
    }
};
