// Member 3: tutoring applications (student requests -> tutor accepts/declines)
const express = require('express');
const db = require('../db');
const { requireRole, text, safe } = require('../middleware');

const router = express.Router();

// Student submits an application (the data-entry form)
router.post('/', requireRole('student'), safe((req, res) => {
    const moduleId = parseInt(req.body.moduleId, 10);
    const tutorId = req.body.tutorId ? parseInt(req.body.tutorId, 10) : null;
    const currentLevel = text(req.body.currentLevel, 2, 40);
    const availability = text(req.body.availability, 3, 200);
    const message = text(req.body.message, 10, 1000);

    if (!db.prepare('SELECT 1 FROM modules WHERE id = ?').get(moduleId)) return res.status(400).json({ error: 'Please choose a valid module.' });
    if (!currentLevel) return res.status(400).json({ error: 'Please describe your current level.' });
    if (!availability) return res.status(400).json({ error: 'Please tell us when you are available.' });
    if (!message) return res.status(400).json({ error: 'Please explain what you need help with (at least 10 characters).' });

    if (tutorId) {
        const ok = db.prepare(`SELECT 1 FROM tutor_modules tm JOIN users u ON u.id = tm.tutor_id
                               WHERE tm.tutor_id = ? AND tm.module_id = ? AND tm.status = 'approved' AND u.status = 'active'`).get(tutorId, moduleId);
        if (!ok) return res.status(400).json({ error: 'That tutor does not teach this module.' });
    }

    const dup = db.prepare(`SELECT 1 FROM applications WHERE student_id = ? AND module_id = ? AND status IN ('pending', 'approved')`)
        .get(req.session.user.id, moduleId);
    if (dup) return res.status(409).json({ error: 'You already have an open application for this module.' });

    db.prepare(`INSERT INTO applications (student_id, module_id, tutor_id, current_level, availability, message)
                VALUES (?, ?, ?, ?, ?, ?)`).run(req.session.user.id, moduleId, tutorId, currentLevel, availability, message);
    res.status(201).json({ message: 'Application submitted. You will see its status on your dashboard.' });
}));

// Student: my applications
router.get('/mine', requireRole('student'), safe((req, res) => {
    const rows = db.prepare(`
        SELECT a.*, m.code, m.name AS module_name, u.name AS tutor_name
        FROM applications a JOIN modules m ON m.id = a.module_id LEFT JOIN users u ON u.id = a.tutor_id
        WHERE a.student_id = ? ORDER BY a.created_at DESC`).all(req.session.user.id);
    res.json({ applications: rows });
}));

// Student: withdraw a pending application
router.delete('/:id', requireRole('student'), safe((req, res) => {
    const info = db.prepare(`DELETE FROM applications WHERE id = ? AND student_id = ? AND status = 'pending'`)
        .run(parseInt(req.params.id, 10), req.session.user.id);
    if (!info.changes) return res.status(404).json({ error: 'Application not found or already processed.' });
    res.json({ message: 'Application withdrawn.' });
}));

// Tutor: applications for my modules (assigned to me, or open to any tutor of the module)
router.get('/incoming', requireRole('tutor'), safe((req, res) => {
    const rows = db.prepare(`
        SELECT a.*, m.code, m.name AS module_name, s.name AS student_name, s.email AS student_email
        FROM applications a
        JOIN modules m ON m.id = a.module_id
        JOIN users s ON s.id = a.student_id
        WHERE (a.tutor_id = ? OR (a.tutor_id IS NULL AND a.status = 'pending'
               AND a.module_id IN (SELECT module_id FROM tutor_modules WHERE tutor_id = ? AND status = 'approved')))
        ORDER BY (a.status = 'pending') DESC, a.created_at DESC`).all(req.session.user.id, req.session.user.id);
    res.json({ applications: rows });
}));

// Tutor: accept or decline
router.patch('/:id', requireRole('tutor'), safe((req, res) => {
    const status = req.body.status;
    if (!['approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Status must be approved or declined.' });
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!app) return res.status(404).json({ error: 'Application not found.' });

    const teaches = db.prepare(`SELECT 1 FROM tutor_modules WHERE tutor_id = ? AND module_id = ? AND status = 'approved'`)
        .get(req.session.user.id, app.module_id);
    if (!teaches || (app.tutor_id && app.tutor_id !== req.session.user.id))
        return res.status(403).json({ error: 'This application is not assigned to you.' });
    if (app.status !== 'pending') return res.status(409).json({ error: 'This application has already been processed.' });

    db.prepare('UPDATE applications SET status = ?, tutor_id = ? WHERE id = ?').run(status, req.session.user.id, app.id);
    res.json({ message: status === 'approved' ? 'Student accepted.' : 'Application declined.' });
}));

module.exports = router;
