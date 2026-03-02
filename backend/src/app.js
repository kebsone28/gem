import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './core/config/config.js';

const app = express();

// 1. Security Middlewares
app.use(helmet());
app.use(cors({
    origin: config.cors.origin,
    credentials: true
}));

// 2. Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// 3. Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// 4. Logging
if (config.env === 'development') {
    app.use(morgan('dev'));
}

// 5. Routes
import authRoutes from './api/routes/auth.routes.js';
import syncRoutes from './api/routes/sync.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/sync', syncRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        time: new Date(),
        version: '1.0.0-PRO'
    });
});

// 6. Global Error Handler (Coming soon)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: config.env === 'development' ? err.message : undefined
    });
});

export default app;
