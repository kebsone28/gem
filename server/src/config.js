/**
 * config.js — Environment configuration
 */
module.exports = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'electrification',
        user: process.env.DB_USER || 'proquelec',
        password: process.env.DB_PASSWORD || 'proquelec_secure_2024'
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'dev_secret_change_me',
        expiresIn: '24h'
    }
};
