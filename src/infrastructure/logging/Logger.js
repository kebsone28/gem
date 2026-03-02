import { LogLevel } from '../../shared/constants/enums.js';

/**
 * Logger principal
 */
export class Logger {
    constructor(name = 'App', level = LogLevel.INFO) {
        this.name = name;
        this.level = level;
        this.transports = [];
    }

    /**
     * Ajoute un transport
     */
    addTransport(transport) {
        this.transports.push(transport);
        return this;
    }

    /**
     * Retire un transport
     */
    removeTransport(transport) {
        const index = this.transports.indexOf(transport);
        if (index > -1) {
            this.transports.splice(index, 1);
        }
        return this;
    }

    /**
     * Log un message
     */
    log(level, message, context = {}) {
        if (level < this.level) return;

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: this.getLevelName(level),
            logger: this.name,
            message,
            context,
            userId: this.getCurrentUserId(),
            sessionId: this.getSessionId()
        };

        for (const transport of this.transports) {
            try {
                transport.write(logEntry);
            } catch (error) {
                console.error('Error in log transport:', error);
            }
        }
    }

    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message, context) {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message, context) {
        this.log(LogLevel.WARN, message, context);
    }

    error(message, error, context = {}) {
        this.log(LogLevel.ERROR, message, {
            ...context,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : null
        });
    }

    fatal(message, error, context = {}) {
        this.log(LogLevel.FATAL, message, {
            ...context,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : null
        });
    }

    getLevelName(level) {
        const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
        return names[level] || 'UNKNOWN';
    }

    getCurrentUserId() {
        return window.currentUser?.id || 'anonymous';
    }

    getSessionId() {
        if (!window.sessionId) {
            window.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        return window.sessionId;
    }
}

/**
 * Transport Console
 */
export class ConsoleTransport {
    constructor(options = {}) {
        this.colorize = options.colorize !== false;
    }

    write(logEntry) {
        const { level, message, context } = logEntry;
        const prefix = `[${logEntry.timestamp}] [${level}] [${logEntry.logger}]`;

        if (this.colorize) {
            const colors = {
                DEBUG: '\x1b[36m',   // Cyan
                INFO: '\x1b[32m',    // Green
                WARN: '\x1b[33m',    // Yellow
                ERROR: '\x1b[31m',   // Red
                FATAL: '\x1b[35m'    // Magenta
            };
            const reset = '\x1b[0m';
            const color = colors[level] || '';
            console.log(`${color}${prefix}${reset} ${message}`, context);
        } else {
            console.log(`${prefix} ${message}`, context);
        }
    }
}

/**
 * Transport IndexedDB
 */
export class IndexedDBTransport {
    constructor(database) {
        this.db = database;
    }

    async write(logEntry) {
        // defensive: database or store may not be ready yet
        if (!this.db || !this.db.audit_log || typeof this.db.audit_log.add !== 'function') {
            console.warn('[IndexedDBTransport] database not ready, skipping log');
            return;
        }
        try {
            await this.db.audit_log.add({
                timestamp: logEntry.timestamp,
                level: logEntry.level,
                logger: logEntry.logger,
                message: logEntry.message,
                context: JSON.stringify(logEntry.context),
                userId: logEntry.userId,
                sessionId: logEntry.sessionId
            });
        } catch (error) {
            console.error('Failed to write log to IndexedDB:', error);
        }
    }
}

/**
 * Transport Remote (API)
 */
export class RemoteTransport {
    constructor(endpoint, options = {}) {
        this.endpoint = endpoint;
        this.buffer = [];
        this.bufferSize = options.bufferSize || 10;
        this.flushInterval = options.flushInterval || 5000;
        this.startFlushing();
    }

    write(logEntry) {
        this.buffer.push(logEntry);

        if (this.buffer.length >= this.bufferSize) {
            this.flush();
        }
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const logs = [...this.buffer];
        this.buffer = [];

        try {
            await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ logs })
            });
        } catch (error) {
            // Remettre dans le buffer en cas d'échec
            this.buffer.unshift(...logs);
            console.error('Failed to send logs to remote:', error);
        }
    }

    startFlushing() {
        this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }

    stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flush(); // Flush final
        }
    }
}

/**
 * Transport File (pour Electron)
 */
export class FileTransport {
    constructor(filepath) {
        this.filepath = filepath;
        this.buffer = [];
    }

    write(logEntry) {
        this.buffer.push(logEntry);

        // Dans Electron, utiliser fs
        if (typeof require !== 'undefined') {
            try {
                const fs = require('fs');
                const line = JSON.stringify(logEntry) + '\n';
                fs.appendFileSync(this.filepath, line);
            } catch (error) {
                console.error('Failed to write log to file:', error);
            }
        }
    }
}

// Créer un logger global
export const logger = new Logger('App', LogLevel.INFO);
logger.addTransport(new ConsoleTransport());

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.LogLevel = LogLevel;
    window.ConsoleTransport = ConsoleTransport;
    window.IndexedDBTransport = IndexedDBTransport;
    window.RemoteTransport = RemoteTransport;
    window.FileTransport = FileTransport;
    window.logger = logger;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Logger,
        LogLevel,
        ConsoleTransport,
        IndexedDBTransport,
        RemoteTransport,
        FileTransport,
        logger
    };
}
