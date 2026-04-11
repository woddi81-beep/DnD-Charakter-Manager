const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HTML_FILE = path.join(__dirname, 'DnD_Charakter_Manager.html');
const DATA_FILE = path.join(__dirname, 'DnD_Charakter_Manager_Data.json');
const PENDING_FILE = path.join(__dirname, 'pending_character.json');

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API: POST /api/character - Save character for Erwin
    if (req.method === 'POST' && req.url === '/api/character') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const character = JSON.parse(body);
                fs.writeFileSync(PENDING_FILE, JSON.stringify(character, null, 2));
                console.log('Character received:', character.name || 'Unknown');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Character received!' }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // API: GET /api/character - Get pending character
    if (req.method === 'GET' && req.url === '/api/character') {
        if (fs.existsSync(PENDING_FILE)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(PENDING_FILE));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(null));
        }
        return;
    }
    
    // API: GET /api/status - Check status
    if (req.method === 'GET' && req.url === '/api/status') {
        const hasPending = fs.existsSync(PENDING_FILE);
        let pendingName = null;
        if (hasPending) {
            try {
                const pending = JSON.parse(fs.readFileSync(PENDING_FILE));
                pendingName = pending.name;
            } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'running', 
            hasPendingCharacter: hasPending,
            pendingCharacterName: pendingName
        }));
        return;
    }
    
    // Handle PUT for saving character DB
    if (req.method === 'PUT' && req.url === '/DnD_Charakter_Manager_Data.json') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                fs.writeFileSync(DATA_FILE, body);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }
    
    // Handle GET for data file
    if (req.method === 'GET' && req.url === '/DnD_Charakter_Manager_Data.json') {
        if (fs.existsSync(DATA_FILE)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(fs.readFileSync(DATA_FILE));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ characters: [], currentPlayer: '' }));
        }
        return;
    }
    
    // Serve HTML file
    if (req.url === '/' || req.url === '/DnD_Charakter_Manager.html' || req.url === '/DnD_Charakter_Ersteller.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(HTML_FILE));
        return;
    }
    
    // Serve static files
    const staticFile = path.join(__dirname, req.url);
    if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
        const ext = path.extname(staticFile);
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg'
        };
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(fs.readFileSync(staticFile));
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`D&D Charakter Manager läuft auf http://0.0.0.0:${PORT}/DnD_Charakter_Manager.html`);
    console.log('Endpoints:');
    console.log('  POST /api/character - Character an Erwin senden');
    console.log('  GET  /api/character - Pending Character abrufen');
    console.log('  GET  /api/status    - Status prüfen');
});
