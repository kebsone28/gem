import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/config.js';

/**
 * Service de Gestion des Queues - PROQUELEC Phase 2
 * Centralise les connexions Redis pour BullMQ.
 */

const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
        const delay = Math.min(times * 100, 15000); // Max 15s avoid flood
        return delay;
    }
};

export const redisConnection = config.redis.url
    ? new IORedis(config.redis.url, {
        ...redisOptions,
        tls: config.redis.tls ? {} : undefined
    })
    : new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        ...redisOptions,
        tls: config.redis.tls ? {} : undefined
    });

let lastErrorTime = 0;
redisConnection.on('error', (err) => {
    const now = Date.now();
    // Log only once per 10 seconds to avoid flooding
    if (now - lastErrorTime > 10000) {
        console.error('[REDIS ERROR] Erreur de connexion Redis (Throttled) :', err.message);
        lastErrorTime = now;
    }
});

redisConnection.on('connect', () => {
    console.log(`[REDIS] Connecté à Redis: ${config.redis.host}:${config.redis.port}`);
});

/**
 * Crée une nouvelle file d'attente (Queue)
 */
export const createQueue = (name) => {
    return new Queue(name, { connection: redisConnection });
};

/**
 * Crée un nouveau Worker
 */
export const createWorker = (name, processor, options = {}) => {
    return new Worker(name, processor, {
        connection: redisConnection,
        ...options
    });
};

export default {
    redisConnection,
    createQueue,
    createWorker
};
