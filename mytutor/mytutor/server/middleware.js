// Shared helpers: authentication guards and input validation.

function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        const u = req.session.user;
        if (!u) return res.status(401).json({ error: 'Please log in first.' });
        if (!roles.includes(u.role)) return res.status(403).json({ error: 'You do not have access to this.' });
        next();
    };
}

// Trim and length-check a string field. Returns the cleaned string or null.
function text(value, min, max) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return v.length >= min && v.length <= max ? v : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Wrap async-safe route handlers so a thrown error becomes a 500 JSON response.
const safe = (fn) => (req, res) => {
    try { fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong on the server.' }); }
};

module.exports = { requireLogin, requireRole, text, EMAIL_RE, safe };
