// simple abstraction over console to disable logs in production
const isProd = import.meta.env?.PROD;

function log(...args: any[]) {
    if (!isProd) console.log(...args);
}
function warn(...args: any[]) {
    if (!isProd) console.warn(...args);
}
function error(...args: any[]) {
    if (!isProd) console.error(...args);
}

function debug(...args: any[]) {
    if (!isProd) console.debug(...args);
}

export default {
    log,
    warn,
    error,
    debug,
};
