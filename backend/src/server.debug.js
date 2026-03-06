import http from 'http';

/**
 * Minimal server to test Railway connectivity and port binding.
 */
async function bootstrap() {
    const port = process.env.PORT || 8080;
    console.log(`🚀 DEBUG SERVER BOOTING ON PORT ${port}`);

    const server = http.createServer((req, res) => {
        console.log(`📥 Request: ${req.method} ${req.url}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'CORE_UP',
            url: req.url,
            env: {
                PORT: process.env.PORT,
                NODE_ENV: process.env.NODE_ENV,
                HAS_DB: !!process.env.DATABASE_URL
            }
        }));
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`✅ Server listening on 0.0.0.0:${port}`);
    });
}

bootstrap().catch(err => {
    console.error('🔥 BOOT FATAL ERROR:', err);
    process.exit(1);
});
