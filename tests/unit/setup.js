// Polyfill window to avoid "ReferenceError: window is not defined" in domain entities when testing in Node.js
if (typeof window === 'undefined') {
    globalThis.window = globalThis;
}
