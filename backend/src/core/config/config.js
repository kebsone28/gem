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
console.log('🔍 Loaded REDIS_URL from env:', process.env.REDIS_URL ? 'PRESENT' : 'MISSING (Defaults to localhost)');
console.log('🔍 JWT Secrets from env:', process.env.JWT_SECRET ? 'PRESENT' : 'MISSING', '| Refresh:', process.env.REFRESH_TOKEN_SECRET ? 'PRESENT' : 'MISSING');
// eslint-disable-next-line no-console
console.log('🔍 Current Working Directory:', process.cwd());

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'secret');
const refreshSecret = process.env.REFRESH_TOKEN_SECRET || (isProduction ? '' : 'refresh_secret');

if (isProduction && (!jwtSecret || !refreshSecret)) {
    throw new Error('JWT_SECRET and REFRESH_TOKEN_SECRET must be defined in production');
}

const localCorsOrigins = [
    'http://localhost:8889',
    'http://127.0.0.1:8889',
    'http://0.0.0.0:8889',
    'http://localhost:8890',
    'http://127.0.0.1:8890',
    'http://localhost:8891'
];

const productionCorsOrigins = [
    'https://ged-os.proquelec.sn',
    'https://www.ged-os.proquelec.sn',
    'https://ged.proquelec.sn',
    'https://www.ged.proquelec.sn'
];

const isLoopbackOrigin = (origin) => {
    if (!origin) return true;

    try {
        const { hostname } = new URL(origin);
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
    } catch {
        return false;
    }
};

export const config = {
    env: process.env.NODE_ENV || 'development',
    port: parsePort(process.env.PORT, 5005),
    dbUrl: process.env.DATABASE_URL,
    jwt: {
        secret: jwtSecret,
        accessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        refreshSecret: refreshSecret,
        refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d'
    },
    cors: {
        origin: (origin, callback) => {
            const isDev = process.env.NODE_ENV !== 'production';
            
            // Origins strictly loaded from env in prod, with secure default fallback
            const rawCorsOrigins = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '';
            const configuredOrigins = rawCorsOrigins
                ? rawCorsOrigins.split(',').map(o => o.trim()).filter(Boolean)
                : [];
            let allowedOrigins = [...new Set([...productionCorsOrigins, ...configuredOrigins])];
                
            if (isDev) {
                allowedOrigins.push(...localCorsOrigins);
            }
            
            if (isDev || isLoopbackOrigin(origin) || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                callback(null, true);
            } else {
                callback(new Error('CORS blocked by PROQUELEC Policy for ' + origin));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Requested-With',
          'Accept',
          'Origin',
          'x-project-id',
          'x-organization-id',
          'x-impersonate-user-id'
        ]
    },
    sentry: {
        dsn: process.env.SENTRY_DSN
    },
    redis: {
        enabled: process.env.REDIS_ENABLED
            ? process.env.REDIS_ENABLED === 'true'
            : !!process.env.REDIS_URL ||
              process.env.NODE_ENV === 'production' ||
              !!(
                  process.env.REDIS_HOST &&
                  process.env.REDIS_HOST !== 'localhost' &&
                  process.env.REDIS_HOST !== '127.0.0.1'
              ),
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
        provider: process.env.AI_PROVIDER || 'OLLAMA',
        anthropicKey: process.env.ANTHROPIC_API_KEY || '',
        anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        anthropicTimeoutMs: parseInt(process.env.ANTHROPIC_TIMEOUT_MS || '12000', 10),
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
        ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
        pollinationsModel: process.env.POLLINATIONS_MODEL || 'openai',
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
