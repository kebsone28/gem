/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
// simple abstraction over console to disable logs in production
const isProd = import.meta.env?.PROD;

function log(...args: unknown[]) {
  if (!isProd) console.log(...args);
}
function warn(...args: unknown[]) {
  if (!isProd) console.warn(...args);
}
function error(...args: unknown[]) {
  if (!isProd) console.error(...args);
}

function debug(...args: unknown[]) {
  if (!isProd) console.debug(...args);
}

function info(...args: unknown[]) {
  if (!isProd) console.info(...args);
}

export default {
  log,
  warn,
  error,
  debug,
  info,
};
