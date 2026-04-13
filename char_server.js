const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

const BASE_DIR = __dirname;
const HTML_FILE = path.join(BASE_DIR, 'DnD_Charakter_Manager.html');
const DATA_FILE = path.join(BASE_DIR, 'DnD_Charakter_Manager_Data.json');

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function readBody(req, limit = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk;
            if (body.length > limit) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });

        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function normalizeCharacterDB(data) {
    if (!data || typeof data !== 'object') {
        return { characters: [], currentPlayer: '' };
    }

    return {
        characters: Array.isArray(data.characters) ? data.characters : [],
        currentPlayer: typeof data.currentPlayer === 'string' ? data.currentPlayer : ''
    };
}

function writeJsonFile(filePath, payload) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function isSafeStaticPath(urlPath) {
    const resolved = path.resolve(BASE_DIR, `.${urlPath}`);
    return resolved.startsWith(BASE_DIR + path.sep) || resolved === BASE_DIR;
}

function extractOutputText(responseJson) {
    if (typeof responseJson?.output_text === 'string' && responseJson.output_text.trim()) {
        return responseJson.output_text.trim();
    }

    const parts = [];
    for (const item of responseJson?.output || []) {
        if (!Array.isArray(item?.content)) continue;
        for (const content of item.content) {
            if (content?.type === 'output_text' && typeof content.text === 'string') {
                parts.push(content.text);
            }
        }
    }

    return parts.join('\n').trim();
}

function getModifier(score) {
    return Math.floor((Number(score) - 10) / 2);
}

function buildCharacterSnapshot(character) {
    const safeCharacter = character && typeof character === 'object' ? character : {};
    const abilities = safeCharacter.abilities && typeof safeCharacter.abilities === 'object'
        ? safeCharacter.abilities
        : {};

    const normalizedAbilities = {
        STR: Number(abilities.STR) || 10,
        DEX: Number(abilities.DEX) || 10,
        CON: Number(abilities.CON) || 10,
        INT: Number(abilities.INT) || 10,
        WIS: Number(abilities.WIS) || 10,
        CHA: Number(abilities.CHA) || 10
    };

    const classHitDice = {
        barbar: 12,
        barde: 8,
        druide: 8,
        krieger: 10,
        monk: 8,
        paladin: 10,
        schurke: 8,
        kleriker: 8,
        zauberer: 6,
        hexmeister: 8,
        waldlaeufer: 10
    };

    const proficiencyBonus = 2;
    const constitutionModifier = getModifier(normalizedAbilities.CON);
    const hitDie = classHitDice[safeCharacter.class] || 8;

    return {
        name: safeCharacter.name || 'Unbenannt',
        playerName: safeCharacter.playerName || '',
        race: safeCharacter.race || null,
        class: safeCharacter.class || null,
        background: safeCharacter.background || null,
        alignment: safeCharacter.alignment || '',
        gender: safeCharacter.gender || '',
        xp: Math.max(0, Number(safeCharacter.xp) || 0),
        abilities: normalizedAbilities,
        abilityModifiers: Object.fromEntries(
            Object.entries(normalizedAbilities).map(([key, value]) => [key, getModifier(value)])
        ),
        skills: Array.isArray(safeCharacter.skills) ? safeCharacter.skills : [],
        backstory: safeCharacter.backstory || '',
        derived: {
            levelEstimate: 1,
            proficiencyBonus,
            hitDie,
            estimatedMaxHP: Math.max(1, hitDie + constitutionModifier),
            initiative: getModifier(normalizedAbilities.DEX),
            spellcastingLikely: ['barde', 'druide', 'paladin', 'kleriker', 'zauberer', 'hexmeister', 'waldlaeufer'].includes(safeCharacter.class)
        }
    };
}

function buildCharacterPrompt(character) {
    const snapshot = buildCharacterSnapshot(character);

    return [
        'Bitte analysiere diesen D&D-5e-Charakter fuer einen Charakter-Manager.',
        'Antworte auf Deutsch, praxisnah und knapp genug zum direkten Lesen in einer Web-App.',
        'Nutze nur Informationen, die aus den Charakterdaten ableitbar sind.',
        'Wenn etwas fehlt, markiere es als offene Annahme statt zu halluzinieren.',
        'Beziehe dich auf typische D&D-5e-Logik fuer Stufe 1.',
        'Bewerte vor allem:',
        '- Synergie zwischen Klasse, Attributen, Fertigkeiten und Hintergrund',
        '- moegliche Build-Schwaechen oder unpassende Schwerpunkte',
        '- naechste konkrete Verbesserungen fuer Spielbarkeit, Rolle und Flair',
        '',
        'Ausgabeformat:',
        'Gesamturteil: 2-4 Saetze.',
        'Staerken: 3 kurze Stichpunkte.',
        'Schwaechen oder Risiken: 3 kurze Stichpunkte.',
        'Optimierungen: 3 bis 5 konkrete Vorschlaege mit Prioritaet.',
        'Spieltipps: 2 kurze Tipps fuer den Tisch.',
        'Verbesserte Kurzgeschichte: optional 1 kurzer Absatz, nur wenn sinnvoll.',
        '',
        'Charakterdaten:',
        JSON.stringify(snapshot, null, 2)
    ].join('\n');
}

function callOpenAI(character) {
    if (!OPENAI_API_KEY) {
        return Promise.reject(new Error('OPENAI_API_KEY fehlt auf dem Server.'));
    }

    const payload = JSON.stringify({
        model: OPENAI_MODEL,
        input: [
            {
                role: 'system',
                content: [
                    {
                        type: 'input_text',
                        text: 'Du bist ein erfahrener D&D-5e-Spielleiter, Build-Berater und Redakteur fuer Charakterboegen. Du gibst konkrete, regelnahe, ehrliche und nuetzliche Verbesserungsvorschlaege. Du vermeidest Fuelltext, Wiederholungen und unklare Allgemeinplaetze.'
                    }
                ]
            },
            {
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: buildCharacterPrompt(character)
                    }
                ]
            }
        ]
    });

    return new Promise((resolve, reject) => {
        const request = https.request(
            {
                hostname: 'api.openai.com',
                path: '/v1/responses',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            },
            response => {
                let responseBody = '';

                response.on('data', chunk => {
                    responseBody += chunk;
                });

                response.on('end', () => {
                    let parsed;
                    try {
                        parsed = JSON.parse(responseBody);
                    } catch (error) {
                        reject(new Error('OpenAI-Antwort konnte nicht gelesen werden.'));
                        return;
                    }

                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        const message = parsed?.error?.message || `OpenAI-Fehler (${response.statusCode})`;
                        reject(new Error(message));
                        return;
                    }

                    const analysis = extractOutputText(parsed);
                    if (!analysis) {
                        reject(new Error('OpenAI hat keine Textantwort geliefert.'));
                        return;
                    }

                    resolve({
                        model: parsed.model || OPENAI_MODEL,
                        analysis
                    });
                });
            }
        );

        request.on('error', reject);
        request.write(payload);
        request.end();
    });
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const pathname = url.pathname;

    if (req.method === 'POST' && pathname === '/api/character') {
        try {
            const body = await readBody(req);
            const character = JSON.parse(body);
            const result = await callOpenAI(character);
            sendJson(res, 200, { success: true, ...result });
        } catch (error) {
            sendJson(res, 500, { error: error.message });
        }
        return;
    }

    if (req.method === 'GET' && pathname === '/api/status') {
        sendJson(res, 200, {
            status: 'running',
            openaiConfigured: Boolean(OPENAI_API_KEY),
            model: OPENAI_MODEL
        });
        return;
    }

    if (req.method === 'PUT' && pathname === '/DnD_Charakter_Manager_Data.json') {
        try {
            const body = await readBody(req);
            const parsed = JSON.parse(body);
            writeJsonFile(DATA_FILE, normalizeCharacterDB(parsed));
            sendJson(res, 200, { success: true });
        } catch (error) {
            sendJson(res, 400, { error: error.message });
        }
        return;
    }

    if (req.method === 'GET' && pathname === '/DnD_Charakter_Manager_Data.json') {
        if (fs.existsSync(DATA_FILE)) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(fs.readFileSync(DATA_FILE));
        } else {
            sendJson(res, 200, { characters: [], currentPlayer: '' });
        }
        return;
    }

    if (pathname === '/' || pathname === '/DnD_Charakter_Manager.html' || pathname === '/DnD_Charakter_Ersteller.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(HTML_FILE));
        return;
    }

    if (isSafeStaticPath(pathname)) {
        const staticFile = path.resolve(BASE_DIR, `.${pathname}`);
        if (fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) {
            const ext = path.extname(staticFile);
            const contentTypes = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.svg': 'image/svg+xml'
            };

            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
            res.end(fs.readFileSync(staticFile));
            return;
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
});

server.listen(PORT, HOST, () => {
    console.log(`D&D Charakter Manager läuft auf http://${HOST}:${PORT}/DnD_Charakter_Manager.html`);
    console.log('Endpoints:');
    console.log('  POST /api/character - Charakter an OpenAI senden');
    console.log('  GET  /api/status    - Server- und OpenAI-Status prüfen');
});
