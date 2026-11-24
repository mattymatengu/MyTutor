// Tutor browsing, public tutor profile, and a tutor editing their own bio
const express = require('express');
const db = require('../db');
const { requireRole, text, safe } = require('../middleware');

const router = express.Router();

// GET /api/tutors?q=ann&moduleId=3  -> active tutors, best rated first
router.get('/', safe((req, res) => {
    const q = (req.query.q || '').toString().trim().slice(0, 60);
    const moduleId = parseInt(req.query.moduleId, 10) || 0;

    let sql = `
        SELECT u.id, u.name, u.qualification, u.bio,
               ROUND(AVG(r.rating), 1) AS avg_rating, COUNT(r.id) AS review_count,
               (SELECT group_concat(m.code, ', ') FROM tutor_modules tm JOIN modules m ON m.id = tm.module_id
                WHERE tm.tutor_id = u.id AND tm.status = 'approved') AS module_codes
        FROM users u LEFT JOIN reviews r ON r.tutor_id = u.id
        WHERE u.role = 'tutor' AND u.status = 'active'`;
    const params = [];
    if (q) { sql += ' AND (u.name LIKE ? OR u.bio LIKE ? OR u.qualification LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (moduleId) { sql += ` AND EXISTS (SELECT 1 FROM tutor_modules tm WHERE tm.tutor_id = u.id AND tm.module_id = ? AND tm.status = 'approved')`; params.push(moduleId); }
    sql += ' GROUP BY u.id ORDER BY avg_rating DESC, review_count DESC, u.name';

    res.json({ tutors: db.prepare(sql).all(...params) });
}));

// Public profile (no email address is exposed)
router.get('/:id', safe((req, res) => {
    const id = parseInt(req.params.id, 10);
    const tutor = db.prepare(`SELECT id, name, qualification, bio, created_at FROM users WHERE id = ? AND role = 'tutor' AND status = 'active'`).get(id);
    if (!tutor) return res.status(404).json({ error: 'Tutor not found.' });

    const modules = db.prepare(`SELECT m.id, m.code, m.name, tm.grade FROM tutor_modules tm JOIN modules m ON m.id = tm.module_id
                                WHERE tm.tutor_id = ? AND tm.status = 'approved' ORDER BY m.code`).all(id);

    // students are shown by first name only
    const reviews = db.prepare(`SELECT r.rating, r.comment, r.created_at, substr(s.name, 1, instr(s.name || ' ', ' ') - 1) AS student
                                FROM reviews r JOIN users s ON s.id = r.student_id WHERE r.tutor_id = ? ORDER BY r.created_at DESC`).all(id);
    const rating = db.prepare('SELECT ROUND(AVG(rating), 1) AS avg, COUNT(*) AS n FROM reviews WHERE tutor_id = ?').get(id);

    const sessions = db.prepare(`SELECT s.id, s.title, s.starts_at, s.duration_min, s.venue, m.code
                                 FROM tutoring_sessions s JOIN modules m ON m.id = s.module_id
                                 WHERE s.tutor_id = ? AND s.starts_at >= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime')
                                 ORDER BY s.starts_at LIMIT 5`).all(id);

    const materials = db.prepare(`SELECT mt.id, mt.title, mt.kind, m.code FROM materials mt JOIN modules m ON m.id = mt.module_id
                                  WHERE mt.tutor_id = ? AND mt.visibility = 'public' ORDER BY mt.created_at DESC`).all(id);

    res.json({ tutor, modules, reviews, rating, sessions, materials });
}));

// A tutor edits their own bio
router.patch('/me/profile', requireRole('tutor'), safe((req, res) => {
    const bio = text(req.body.bio || '', 0, 500);
    if (bio === null) return res.status(400).json({ error: 'Bio must be 500 characters or fewer.' });
    db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.session.user.id);
    res.json({ message: 'Profile updated.' });
}));

module.exports = router;
