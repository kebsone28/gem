import https from 'https';

const options = {
    hostname: 'gem-production-a101.up.railway.app',
    port: 443,
    path: '/api/auth/login',
    method: 'OPTIONS',
    headers: {
        'Origin': 'https://proquelec.up.railway.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
    }
};

const req = https.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log('HEADERS:', JSON.stringify(res.headers, null, 2));

    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
