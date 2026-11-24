const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

require('./server/db'); // creates tables + sample data on first run

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
const isProd = process.env.NODE_ENV === 'production';
app.use(helmet({
    // inline styles are not used; scripts only from our own origin
    contentSecurityPolicy: { directives: {
        defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'"], scriptSrc: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"],
        // The server only speaks plain HTTP when run locally. Telling browsers to upgrade to HTTPS
        // breaks the site on a phone using http://<pc-ip>:3000, so this is only switched on in production.
        'upgrade-insecure-requests': isProd ? [] : null
    } },
    strictTransportSecurity: isProd
}));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

app.use(session({
    name: 'mytutor.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'), // set SESSION_SECRET so sessions survive restarts
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/modules', require('./server/routes/modules'));
app.use('/api/tutors', require('./server/routes/tutors'));
app.use('/api/applications', require('./server/routes/applications'));
app.use('/api', require('./server/routes/materials'));
app.use('/api', require('./server/routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use(express.static(path.join(__dirname, 'public')));

// JSON body parse errors etc.
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => console.log(`My Tutor running at http://localhost:${PORT}`));
