// utils/keepAlive.js
// HTTP server nhẹ dùng module http có sẵn của Node.js (không cần Express).
// Mục đích: Render yêu cầu dịch vụ phải lắng nghe cổng HTTP để không bị sleep.
// Endpoint /health được cron-job.org ping định kỳ để giữ bot luôn online.

const http = require('http');

function keepAlive() {
    const server = http.createServer((req, res) => {
        // Endpoint sức khoẻ — cron job sẽ ping URL này
        if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status:    'online',
                bot:       'CasinoPro',
                timestamp: new Date().toISOString(),
                uptime:    `${Math.floor(process.uptime())}s`,
            }));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
        }
    });

    // Render tự inject PORT qua env — không được hardcode
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🌐 [KeepAlive] HTTP server đang lắng nghe tại cổng ${PORT}`);
    });

    server.on('error', (err) => {
        console.error('[KeepAlive] Lỗi HTTP server:', err.message);
    });

    return server;
}

module.exports = keepAlive;
