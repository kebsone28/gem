const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const logLevelFromEnv = process.env.LOG_LEVEL || 'info';
const currentLogLevel = LOG_LEVELS[logLevelFromEnv.toUpperCase()] || LOG_LEVELS.INFO;

class Logger {
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };

    const output = `[${timestamp}] [${level}] ${message}`;
    
    switch (level) {
      case 'ERROR':
        if (currentLogLevel >= LOG_LEVELS.ERROR) console.error(output, data);
        break;
      case 'WARN':
        if (currentLogLevel >= LOG_LEVELS.WARN) console.warn(output, data);
        break;
      case 'INFO':
        if (currentLogLevel >= LOG_LEVELS.INFO) console.log(output, data);
        break;
      case 'DEBUG':
        if (currentLogLevel >= LOG_LEVELS.DEBUG) console.log(output, data);
        break;
    }

    return logEntry;
  }

  error(message, data = {}) {
    return this.log('ERROR', `❌ ${message}`, data);
  }

  warn(message, data = {}) {
    return this.log('WARN', `⚠️  ${message}`, data);
  }

  info(message, data = {}) {
    return this.log('INFO', `ℹ️  ${message}`, data);
  }

  debug(message, data = {}) {
    return this.log('DEBUG', `🐛 ${message}`, data);
  }

  success(message, data = {}) {
    return this.log('INFO', `✅ ${message}`, data);
  }
}

export default new Logger();
