const crypto = require('crypto');

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 40;

function getAttemptStore() {
    if (!globalThis.__easterAttemptStore) {
        globalThis.__easterAttemptStore = new Map();
    }
    return globalThis.__easterAttemptStore;
}

function pruneStore(store, now) {
    for (const [ip, info] of store.entries()) {
        if (now - info.windowStart > WINDOW_MS) {
            store.delete(ip);
        }
    }
}

function getClientInput(req) {
    if (!req || !req.body) return '';

    if (typeof req.body === 'string') {
        try {
            const parsed = JSON.parse(req.body);
            return parsed && typeof parsed.input === 'string' ? parsed.input : '';
        } catch {
            return '';
        }
    }

    if (typeof req.body === 'object' && typeof req.body.input === 'string') {
        return req.body.input;
    }

    return '';
}

function stableHash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(a, b) {
    const aHash = Buffer.from(stableHash(a), 'utf8');
    const bHash = Buffer.from(stableHash(b), 'utf8');
    return crypto.timingSafeEqual(aHash, bHash);
}

module.exports = function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false });
        return;
    }

    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
    const now = Date.now();
    const attempts = getAttemptStore();

    pruneStore(attempts, now);

    const state = attempts.get(ip) || { count: 0, windowStart: now };
    if (now - state.windowStart > WINDOW_MS) {
        state.count = 0;
        state.windowStart = now;
    }

    state.count += 1;
    attempts.set(ip, state);

    if (state.count > MAX_ATTEMPTS) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(429).json({ ok: false, unlock: false, retryAfterMs: WINDOW_MS });
        return;
    }

    const rawInput = getClientInput(req).toLowerCase();
    const normalizedInput = rawInput.replace(/[^a-z0-9]/g, '').slice(-128);

    const secretKey = (process.env.EASTER_EGG_KEY || 'jogi').toLowerCase().replace(/[^a-z0-9]/g, '');
    const secretMessage = (process.env.EASTER_EGG_MESSAGE || 'signal acquired').slice(0, 80);

    const inputTail = secretKey ? normalizedInput.slice(-secretKey.length) : '';
    const unlock = secretKey.length > 0 && inputTail.length === secretKey.length && safeEqual(inputTail, secretKey);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        ok: true,
        unlock,
        matrixMessage: unlock ? secretMessage : null
    });
};
