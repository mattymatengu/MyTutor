// Member 2: module catalogue (list + search/filter + details) and tutor reviews
const express = require('express');
const db = require('../db');
const { requireRole, text, safe } = require('../middleware');

const router = express.Router();

// GET /api/modules?q=web&department=Computer%20Science&level=2
router.get('/', safe((req, res) => {
    const q = (req.query.q || '').toString().trim().slice(0, 60);
    const department = (req.query.department || '').toString().trim();
    const level = parseInt(req.query.level, 10);

    let sql = `SELECT m.*,
                 (SELECT COUNT(*) FROM tutor_modules tm WHERE tm.module_id = m.id AND tm.status = 'approved') AS tutor_count
               FROM modules m WHERE 1 = 1`;
    const params = [];
    if (q) { sql += ' AND (m.code LIKE ? OR m.name LIKE ? OR m.description LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (department) { sql += ' AND m.department = ?'; params.push(department); }
    if (level >= 1 && level <= 4) { sql += ' AND m.level = ?'; params.push(level); }
    sql += ' ORDER BY m.code';

    res.json({ modules: db.prepare(sql).all(...params) });
}));

router.get('/departments', safe((req, res) => {
    res.json({ departments: db.prepare('SELECT DISTINCT department FROM modules ORDER BY department').all().map((r) => r.department) });
}));

// Details page: module + approved tutors (with rating) + upcoming sessions + public materials
router.get('/:id', safe((req, res) => {
    const id = parseInt(req.params.id, 10);
    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!module) return res.status(404).json({ error: 'Module not found.' });

    const tutors = db.prepare(`
        SELECT u.id, u.name, u.qualification, u.bio, tm.grade,
               ROUND((SELECT AVG(rating) FROM reviews r WHERE r.tutor_id = u.id), 1) AS avg_rating,
               (SELECT COUNT(*) FROM reviews r WHERE r.tutor_id = u.id) AS review_count
        FROM tutor_modules tm JOIN users u ON u.id = tm.tutor_id
        WHERE tm.module_id = ? AND tm.status = 'approved' AND u.status = 'active'
        ORDER BY avg_rating DESC, u.name`).all(id);

    const sessions = db.prepare(`
        SELECT s.id, s.title, s.starts_at, s.duration_min, s.venue, s.capacity, u.name AS tutor_name,
               (SELECT COUNT(*) FROM session_rsvps r WHERE r.session_id = s.id) AS rsvp_count
        FROM tutoring_sessions s JOIN users u ON u.id = s.tutor_id
        WHERE s.module_id = ? AND s.starts_at >= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime')
        ORDER BY s.starts_at LIMIT 10`).all(id);

    const materials = db.prepare(`
        SELECT mt.id, mt.title, mt.kind, mt.created_at, u.name AS tutor_name
        FROM materials mt JOIN users u ON u.id = mt.tutor_id
        WHERE mt.module_id = ? AND mt.visibility = 'public' ORDER BY mt.created_at DESC`).all(id);

    res.json({ module, tutors, sessions, materials });
}));

// Student rates a tutor they have been matched with (one review per tutor, can be updated)
router.post('/tutors/:tutorId/review', requireRole('student'), safe((req, res) => {
    const tutorId = parseInt(req.params.tutorId, 10);
    const rating = parseInt(req.body.rating, 10);
    const comment = text(req.body.comment || '', 0, 500);
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    if (comment === null) return res.status(400).json({ error: 'Comment is too long (500 characters max).' });

    const matched = db.prepare(`SELECT 1 FROM applications WHERE student_id = ? AND tutor_id = ? AND status = 'approved'`)
        .get(req.session.user.id, tutorId);
    if (!matched) return res.status(403).json({ error: 'You can only review a tutor you have been matched with.' });

    db.prepare(`INSERT INTO reviews (tutor_id, student_id, rating, comment) VALUES (?, ?, ?, ?)
                ON CONFLICT (tutor_id, student_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment`)
        .run(tutorId, req.session.user.id, rating, comment);
    res.json({ message: 'Thank you for your review.' });
}));

module.exports = router;
