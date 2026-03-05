import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/config.js';

/**
 * Service de Gestion des Queues - PROQUELEC Phase 2
 * Centralise les connexions Redis pour BullMQ.
 */

export const redisConnection = new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    tls: config.redis.tls ? {} : undefined,
    maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
    console.error('[REDIS ERROR] Erreur de connexion Redis :', err);
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
