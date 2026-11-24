// Member 1: registration, login, logout, current user
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { text, EMAIL_RE, safe } = require('../middleware');

const mailer = require('../mailer');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { error: 'Too many attempts. Try again in 15 minutes.' } });

const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: 'Too many requests. Try again in 15 minutes.' } });

function publicUser(u) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status };
}

router.post('/register', loginLimiter, safe((req, res) => {
    const name = text(req.body.name, 2, 80);
    const email = text(req.body.email, 5, 120);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = req.body.role === 'tutor' ? 'tutor' : 'student'; // admin can never be self-registered

    if (!name) return res.status(400).json({ error: 'Please enter your full name (2-80 characters).' });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and a number.' });

    const studentNo = text(req.body.studentNo || '', 0, 20);
    const qualification = role === 'tutor' ? text(req.body.qualification || '', 3, 200) : null;
    if (role === 'tutor' && !qualification)
        return res.status(400).json({ error: 'Tutors must describe their qualification (e.g. degree and year).' });

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()))
        return res.status(409).json({ error: 'An account with that email already exists.' });

    const status = role === 'tutor' ? 'pending' : 'active';
    const info = db.prepare(`INSERT INTO users (name, email, password_hash, role, status, student_no, qualification)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(name, email.toLowerCase(), bcrypt.hashSync(password, 10), role, status, studentNo, qualification);

    // tutors list the modules they want to teach; the admin approves each one
    if (role === 'tutor' && Array.isArray(req.body.modules)) {
        const add = db.prepare('INSERT OR IGNORE INTO tutor_modules (tutor_id, module_id) SELECT ?, id FROM modules WHERE id = ?');
        req.body.modules.slice(0, 20).forEach((m) => add.run(info.lastInsertRowid, Number(m)));
    }

    res.status(201).json({
        message: role === 'tutor'
            ? 'Application received. An administrator must approve your tutor account before you can log in.'
            : 'Account created. You can now log in.'
    });
}));

router.post('/login', loginLimiter, safe((req, res) => {
    const email = text(req.body.email, 3, 120);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    // same message for unknown email and wrong password so accounts cannot be enumerated
    if (!user || !bcrypt.compareSync(password, user.password_hash))
        return res.status(401).json({ error: 'Incorrect email or password.' });
    if (user.status === 'pending')
        return res.status(403).json({ error: 'Your tutor account is still waiting for admin approval.' });
    if (user.status === 'suspended')
        return res.status(403).json({ error: 'This account has been suspended. Please contact support.' });

    req.session.regenerate((err) => {
        if (err) return res.status(500).json({ error: 'Could not start a session.' });
        req.session.user = publicUser(user);
        res.json({ user: req.session.user });
    });
}));

// Forgot password step 1: only registered, active, non-admin accounts get a link. The reply to the browser is the
// same wording for everyone, so the form does not announce which emails are registered.
// The link is emailed when SMTP is configured; otherwise (demo mode) it is shown on screen and printed in the console.
const GENERIC = 'If that email is registered, a reset link has been sent. It works once and expires in 30 minutes.';
router.post('/forgot', forgotLimiter, async (req, res) => {
    try {
        const email = text(req.body.email, 3, 120);
        const user = email && db.prepare(`SELECT id, name, email FROM users WHERE email = ? AND role != 'admin' AND status = 'active'`).get(email.toLowerCase());
        if (!user) return res.json({ message: GENERIC });

        // at most one new link per minute per account (stops people flooding an inbox)
        if (db.prepare(`SELECT 1 FROM password_resets WHERE user_id = ? AND created_at > datetime('now', '-1 minute')`).get(user.id))
            return res.json({ message: GENERIC });

        // cancel older unused links, then create a fresh one (only the hash is stored)
        db.prepare(`DELETE FROM password_resets WHERE user_id = ? AND status != 'done'`).run(user.id);
        const token = crypto.randomBytes(24).toString('hex');
        db.prepare(`INSERT INTO password_resets (user_id, status, token_hash, expires_at)
                    VALUES (?, 'issued', ?, strftime('%Y-%m-%d %H:%M:%S', 'now', '+30 minutes'))`)
            .run(user.id, crypto.createHash('sha256').update(token).digest('hex'));
        const link = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`) + '/reset.html?token=' + token;

        if (mailer.emailEnabled) {
            try { await mailer.sendResetEmail(user.email, user.name, link); }
            catch (e) { console.error('Reset email failed:', e.message); }
            return res.json({ message: GENERIC });
        }
        console.log(`[demo mode] password reset link for ${user.email}: ${link}`);
        res.json({ message: GENERIC, demoLink: link });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Something went wrong on the server.' });
    }
});

// Forgot password step 2: the student opens the emailed link and chooses a new password
router.post('/reset', loginLimiter, safe((req, res) => {
    const token = typeof req.body.token === 'string' ? req.body.token : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
        return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and a number.' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const row = db.prepare(`SELECT * FROM password_resets WHERE token_hash = ? AND status = 'issued'
                            AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')`).get(hash);
    if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), row.user_id);
    db.prepare(`UPDATE password_resets SET status = 'done', token_hash = NULL WHERE id = ?`).run(row.id);
    res.json({ message: 'Password changed. You can now log in.' });
}));

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('mytutor.sid');
        res.json({ message: 'Logged out.' });
    });
});

router.get('/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

module.exports = router;
