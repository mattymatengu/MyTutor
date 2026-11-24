// Member 4: learning materials (upload/download) and live-session scheduling + RSVP
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requireLogin, requireRole, text, safe } = require('../middleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.zip', '.png', '.jpg', '.jpeg', '.mp4'];
const upload = multer({
    storage: multer.diskStorage({
        destination: uploadDir,
        // never trust the original filename: random name, whitelisted extension
        filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase())
    }),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(path.extname(file.originalname).toLowerCase()))
});

function tutorTeaches(tutorId, moduleId) {
    return db.prepare(`SELECT 1 FROM tutor_modules WHERE tutor_id = ? AND module_id = ? AND status = 'approved'`).get(tutorId, moduleId);
}

// Can this user see this material?
function canAccess(user, mt) {
    if (user.role === 'admin' || mt.tutor_id === user.id) return true;
    if (user.role !== 'student') return false;
    if (mt.visibility === 'public') return true;
    return !!db.prepare(`SELECT 1 FROM applications WHERE student_id = ? AND tutor_id = ? AND module_id = ? AND status = 'approved'`)
        .get(user.id, mt.tutor_id, mt.module_id);
}

/* ---------- materials ---------- */

router.post('/materials', requireRole('tutor'), (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (15 MB max).' : 'Upload failed.' });
        try {
            const moduleId = parseInt(req.body.moduleId, 10);
            const title = text(req.body.title, 3, 120);
            const description = text(req.body.description || '', 0, 500);
            const kind = ['notes', 'slides', 'past_paper', 'video', 'other'].includes(req.body.kind) ? req.body.kind : 'notes';
            const visibility = req.body.visibility === 'students_only' ? 'students_only' : 'public';
            const link = text(req.body.linkUrl || '', 0, 300);
            const removeFile = () => req.file && fs.unlink(req.file.path, () => {});

            if (!title) { removeFile(); return res.status(400).json({ error: 'Please enter a title (3-120 characters).' }); }
            if (!tutorTeaches(req.session.user.id, moduleId)) { removeFile(); return res.status(403).json({ error: 'You are not approved to teach that module.' }); }
            if (link && !/^https?:\/\//i.test(link)) { removeFile(); return res.status(400).json({ error: 'Links must start with http:// or https://' }); }
            if (!req.file && !link) return res.status(400).json({ error: 'Attach a file (pdf, docx, pptx, zip, ...) or provide a link.' });

            db.prepare(`INSERT INTO materials (module_id, tutor_id, title, description, kind, file_path, link_url, visibility)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(moduleId, req.session.user.id, title, description, kind, req.file ? req.file.filename : null, link || null, visibility);
            res.status(201).json({ message: 'Material uploaded.' });
        } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong on the server.' }); }
    });
});

// Materials the current user is allowed to see (optionally for one module)
router.get('/materials', requireLogin, safe((req, res) => {
    const user = req.session.user;
    const moduleId = parseInt(req.query.moduleId, 10) || null;
    let rows = db.prepare(`
        SELECT mt.*, m.code, m.name AS module_name, u.name AS tutor_name
        FROM materials mt JOIN modules m ON m.id = mt.module_id JOIN users u ON u.id = mt.tutor_id
        WHERE (? IS NULL OR mt.module_id = ?)
        ORDER BY mt.created_at DESC`).all(moduleId, moduleId);
    rows = rows.filter((r) => canAccess(user, r)).map(({ file_path, ...r }) => ({ ...r, has_file: !!file_path }));
    res.json({ materials: rows });
}));

router.get('/materials/:id/download', requireLogin, safe((req, res) => {
    const mt = db.prepare('SELECT * FROM materials WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!mt) return res.status(404).json({ error: 'Material not found.' });
    if (!canAccess(req.session.user, mt)) return res.status(403).json({ error: 'You do not have access to this material.' });
    if (mt.link_url && !mt.file_path) return res.redirect(mt.link_url);
    res.download(path.join(uploadDir, path.basename(mt.file_path)), mt.title.replace(/[^\w.-]+/g, '_') + path.extname(mt.file_path));
}));

router.delete('/materials/:id', requireRole('tutor', 'admin'), safe((req, res) => {
    const mt = db.prepare('SELECT * FROM materials WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!mt) return res.status(404).json({ error: 'Material not found.' });
    if (req.session.user.role === 'tutor' && mt.tutor_id !== req.session.user.id)
        return res.status(403).json({ error: 'You can only delete your own materials.' });
    db.prepare('DELETE FROM materials WHERE id = ?').run(mt.id);
    if (mt.file_path) fs.unlink(path.join(uploadDir, path.basename(mt.file_path)), () => {});
    res.json({ message: 'Material deleted.' });
}));

/* ---------- live sessions ---------- */

router.post('/sessions', requireRole('tutor'), safe((req, res) => {
    const moduleId = parseInt(req.body.moduleId, 10);
    const title = text(req.body.title, 3, 120);
    const startsAt = (req.body.startsAt || '').toString();
    const duration = parseInt(req.body.duration, 10);
    const venue = text(req.body.venue, 2, 200);
    const capacity = parseInt(req.body.capacity, 10) || 20;

    if (!title) return res.status(400).json({ error: 'Please enter a session title.' });
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) || isNaN(Date.parse(startsAt))) return res.status(400).json({ error: 'Please choose a valid date and time.' });
    if (!(duration >= 15 && duration <= 240)) return res.status(400).json({ error: 'Duration must be between 15 and 240 minutes.' });
    if (!venue) return res.status(400).json({ error: 'Please give a venue or meeting link.' });
    if (!(capacity >= 1 && capacity <= 500)) return res.status(400).json({ error: 'Capacity must be between 1 and 500.' });
    if (!tutorTeaches(req.session.user.id, moduleId)) return res.status(403).json({ error: 'You are not approved to teach that module.' });

    db.prepare(`INSERT INTO tutoring_sessions (module_id, tutor_id, title, starts_at, duration_min, venue, capacity)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(moduleId, req.session.user.id, title, startsAt, duration, venue, capacity);
    res.status(201).json({ message: 'Session scheduled.' });
}));

// Upcoming sessions. Students see sessions for modules they are matched in; tutors see their own.
router.get('/sessions', requireLogin, safe((req, res) => {
    const u = req.session.user;
    const base = `
        SELECT s.*, m.code, m.name AS module_name, t.name AS tutor_name,
               (SELECT COUNT(*) FROM session_rsvps r WHERE r.session_id = s.id) AS rsvp_count,
               EXISTS (SELECT 1 FROM session_rsvps r WHERE r.session_id = s.id AND r.student_id = ?) AS i_rsvped
        FROM tutoring_sessions s JOIN modules m ON m.id = s.module_id JOIN users t ON t.id = s.tutor_id
        WHERE s.starts_at >= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime', '-1 day')`;
    let rows;
    if (u.role === 'tutor') rows = db.prepare(base + ' AND s.tutor_id = ? ORDER BY s.starts_at').all(u.id, u.id);
    else if (u.role === 'student')
        rows = db.prepare(base + ` AND s.module_id IN (SELECT module_id FROM applications WHERE student_id = ? AND status = 'approved')
                                   ORDER BY s.starts_at`).all(u.id, u.id);
    else rows = db.prepare(base + ' ORDER BY s.starts_at').all(u.id);
    res.json({ sessions: rows });
}));

router.post('/sessions/:id/rsvp', requireRole('student'), safe((req, res) => {
    const s = db.prepare('SELECT * FROM tutoring_sessions WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    const matched = db.prepare(`SELECT 1 FROM applications WHERE student_id = ? AND module_id = ? AND status = 'approved'`).get(req.session.user.id, s.module_id);
    if (!matched) return res.status(403).json({ error: 'You need an approved application for this module to RSVP.' });
    const count = db.prepare('SELECT COUNT(*) AS n FROM session_rsvps WHERE session_id = ?').get(s.id).n;
    if (count >= s.capacity) return res.status(409).json({ error: 'This session is full.' });
    db.prepare('INSERT OR IGNORE INTO session_rsvps (session_id, student_id) VALUES (?, ?)').run(s.id, req.session.user.id);
    res.json({ message: 'You are registered for this session.' });
}));

router.delete('/sessions/:id/rsvp', requireRole('student'), safe((req, res) => {
    db.prepare('DELETE FROM session_rsvps WHERE session_id = ? AND student_id = ?').run(parseInt(req.params.id, 10), req.session.user.id);
    res.json({ message: 'RSVP cancelled.' });
}));

router.delete('/sessions/:id', requireRole('tutor', 'admin'), safe((req, res) => {
    const s = db.prepare('SELECT * FROM tutoring_sessions WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!s) return res.status(404).json({ error: 'Session not found.' });
    if (req.session.user.role === 'tutor' && s.tutor_id !== req.session.user.id) return res.status(403).json({ error: 'You can only cancel your own sessions.' });
    db.prepare('DELETE FROM tutoring_sessions WHERE id = ?').run(s.id);
    res.json({ message: 'Session cancelled.' });
}));

// Tutor: which modules can I upload to / schedule for?
router.get('/my-modules', requireRole('tutor'), safe((req, res) => {
    res.json({ modules: db.prepare(`SELECT m.id, m.code, m.name, tm.status, tm.grade FROM tutor_modules tm JOIN modules m ON m.id = tm.module_id
                                    WHERE tm.tutor_id = ? ORDER BY m.code`).all(req.session.user.id) });
}));

module.exports = router;
