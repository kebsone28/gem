 
// simple abstraction over console with quiet-by-default dev mode
const isProd = import.meta.env?.PROD;

function isVerboseDevEnabled() {
  if (isProd || typeof window === 'undefined') return false;

  try {
    return (
      localStorage.getItem('gem:verbose-logs') === '1' ||
      localStorage.getItem('debug') === '1' ||
      (window as Window & { __GEM_VERBOSE_LOGS__?: boolean }).__GEM_VERBOSE_LOGS__ === true
    );
  } catch {
    return false;
  }
}

function log(...args: unknown[]) {
  if (!isProd && isVerboseDevEnabled()) console.log(...args);
}
function warn(...args: unknown[]) {
  if (!isProd) console.warn(...args);
}
function error(...args: unknown[]) {
  if (!isProd) console.error(...args);
}

function debug(...args: unknown[]) {
  if (!isProd && isVerboseDevEnabled()) console.debug(...args);
}

function info(...args: unknown[]) {
  if (!isProd && isVerboseDevEnabled()) console.info(...args);
}

export default {
  log,
  warn,
  error,
  debug,
  info,
};
