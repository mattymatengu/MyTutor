// Member 5: administration (modules CRUD, tutor approval, users, applications) and the contact form
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireRole, text, EMAIL_RE, safe } = require('../middleware');

const router = express.Router();
const admin = requireRole('admin');

/* ---------- public contact form ---------- */
router.post('/contact', safe((req, res) => {
    const name = text(req.body.name, 2, 80);
    const email = text(req.body.email, 5, 120);
    const subject = text(req.body.subject, 3, 120);
    const message = text(req.body.message, 10, 2000);
    if (!name) return res.status(400).json({ error: 'Please enter your name.' });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!subject) return res.status(400).json({ error: 'Please enter a subject.' });
    if (!message) return res.status(400).json({ error: 'Your message must be at least 10 characters.' });
    db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)').run(name, email, subject, message);
    res.status(201).json({ message: 'Thank you! We will get back to you soon.' });
}));

/* ---------- everything below is admin only ---------- */

router.get('/admin/stats', admin, safe((req, res) => {
    const n = (sql) => db.prepare(sql).get().n;
    res.json({
        students: n(`SELECT COUNT(*) n FROM users WHERE role = 'student'`),
        tutors: n(`SELECT COUNT(*) n FROM users WHERE role = 'tutor' AND status = 'active'`),
        pendingTutors: n(`SELECT COUNT(*) n FROM users WHERE role = 'tutor' AND status = 'pending'`),
        pendingTutorModules: n(`SELECT COUNT(*) n FROM tutor_modules tm JOIN users u ON u.id = tm.tutor_id WHERE tm.status = 'pending' AND u.status = 'active'`),
        modules: n('SELECT COUNT(*) n FROM modules'),
        openApplications: n(`SELECT COUNT(*) n FROM applications WHERE status = 'pending'`),
        materials: n('SELECT COUNT(*) n FROM materials'),
        pendingResets: n(`SELECT COUNT(*) n FROM password_resets WHERE status = 'issued' AND expires_at > strftime('%Y-%m-%d %H:%M:%S', 'now')`),
        unreadMessages: n('SELECT COUNT(*) n FROM contact_messages WHERE resolved = 0'),
        demand: db.prepare(`SELECT m.code, m.name, COUNT(a.id) AS applications FROM modules m LEFT JOIN applications a ON a.module_id = m.id
                            GROUP BY m.id ORDER BY applications DESC, m.code LIMIT 5`).all()
    });
}));

/* modules: create / update / delete */
function readModule(body) {
    const code = text(body.code, 3, 12), name = text(body.name, 3, 100), department = text(body.department, 3, 80);
    const level = parseInt(body.level, 10), description = text(body.description || '', 0, 500);
    if (!code || !/^[A-Za-z0-9]+$/.test(code)) return { error: 'Module code must be letters/numbers only (3-12 characters), e.g. WAD621S.' };
    if (!name) return { error: 'Please enter a module name.' };
    if (!department) return { error: 'Please enter a department.' };
    if (!(level >= 1 && level <= 4)) return { error: 'Level must be between 1 and 4.' };
    if (description === null) return { error: 'Description is too long.' };
    return { code: code.toUpperCase(), name, department, level, description };
}

router.post('/admin/modules', admin, safe((req, res) => {
    const m = readModule(req.body);
    if (m.error) return res.status(400).json({ error: m.error });
    if (db.prepare('SELECT 1 FROM modules WHERE code = ?').get(m.code)) return res.status(409).json({ error: 'A module with that code already exists.' });
    db.prepare('INSERT INTO modules (code, name, department, level, description) VALUES (?, ?, ?, ?, ?)').run(m.code, m.name, m.department, m.level, m.description);
    res.status(201).json({ message: 'Module added.' });
}));

router.put('/admin/modules/:id', admin, safe((req, res) => {
    const m = readModule(req.body);
    if (m.error) return res.status(400).json({ error: m.error });
    const id = parseInt(req.params.id, 10);
    if (db.prepare('SELECT 1 FROM modules WHERE code = ? AND id != ?').get(m.code, id)) return res.status(409).json({ error: 'Another module already uses that code.' });
    const info = db.prepare('UPDATE modules SET code = ?, name = ?, department = ?, level = ?, description = ? WHERE id = ?')
        .run(m.code, m.name, m.department, m.level, m.description, id);
    if (!info.changes) return res.status(404).json({ error: 'Module not found.' });
    res.json({ message: 'Module updated.' });
}));

router.delete('/admin/modules/:id', admin, safe((req, res) => {
    const info = db.prepare('DELETE FROM modules WHERE id = ?').run(parseInt(req.params.id, 10));
    if (!info.changes) return res.status(404).json({ error: 'Module not found.' });
    res.json({ message: 'Module deleted (with its applications, materials and sessions).' });
}));

/* tutors: approve accounts and approve which modules they may teach */
router.get('/admin/tutors', admin, safe((req, res) => {
    const tutors = db.prepare(`SELECT id, name, email, status, qualification, created_at FROM users WHERE role = 'tutor' ORDER BY (status = 'pending') DESC, name`).all();
    const mods = db.prepare(`SELECT tm.tutor_id, tm.module_id, tm.grade, tm.status, m.code FROM tutor_modules tm JOIN modules m ON m.id = tm.module_id`).all();
    res.json({ tutors: tutors.map((t) => ({ ...t, modules: mods.filter((x) => x.tutor_id === t.id) })) });
}));

router.patch('/admin/tutors/:id', admin, safe((req, res) => {
    const status = req.body.status;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Status must be active or suspended.' });
    const info = db.prepare(`UPDATE users SET status = ? WHERE id = ? AND role = 'tutor'`).run(status, parseInt(req.params.id, 10));
    if (!info.changes) return res.status(404).json({ error: 'Tutor not found.' });
    res.json({ message: status === 'active' ? 'Tutor approved.' : 'Tutor suspended.' });
}));

router.patch('/admin/tutors/:id/modules/:moduleId', admin, safe((req, res) => {
    const status = req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected.' });
    const info = db.prepare('UPDATE tutor_modules SET status = ? WHERE tutor_id = ? AND module_id = ?')
        .run(status, parseInt(req.params.id, 10), parseInt(req.params.moduleId, 10));
    if (!info.changes) return res.status(404).json({ error: 'Not found.' });
    res.json({ message: 'Updated.' });
}));

/* users */
router.get('/admin/users', admin, safe((req, res) => {
    res.json({ users: db.prepare(`SELECT id, name, email, role, status, student_no, created_at FROM users ORDER BY role, name`).all() });
}));

router.patch('/admin/users/:id', admin, safe((req, res) => {
    const id = parseInt(req.params.id, 10);
    const status = req.body.status;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Status must be active or suspended.' });
    if (id === req.session.user.id) return res.status(400).json({ error: 'You cannot suspend your own account.' });
    const info = db.prepare(`UPDATE users SET status = ? WHERE id = ? AND role != 'admin'`).run(status, id);
    if (!info.changes) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated.' });
}));

router.delete('/admin/users/:id', admin, safe((req, res) => {
    const id = parseInt(req.params.id, 10);
    if (id === req.session.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
    const info = db.prepare(`DELETE FROM users WHERE id = ? AND role != 'admin'`).run(id);
    if (!info.changes) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User deleted.' });
}));

/* applications: admin can see all and assign / override */
router.get('/admin/applications', admin, safe((req, res) => {
    res.json({ applications: db.prepare(`
        SELECT a.id, a.status, a.current_level, a.availability, a.message, a.created_at, a.tutor_id, a.module_id,
               m.code, s.name AS student_name, t.name AS tutor_name
        FROM applications a JOIN modules m ON m.id = a.module_id JOIN users s ON s.id = a.student_id LEFT JOIN users t ON t.id = a.tutor_id
        ORDER BY (a.status = 'pending') DESC, a.created_at DESC`).all() });
}));

router.patch('/admin/applications/:id', admin, safe((req, res) => {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(parseInt(req.params.id, 10));
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    const status = req.body.status || app.status;
    if (!['pending', 'approved', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    let tutorId = app.tutor_id;
    if (req.body.tutorId !== undefined) {
        tutorId = req.body.tutorId ? parseInt(req.body.tutorId, 10) : null;
        if (tutorId && !db.prepare(`SELECT 1 FROM tutor_modules WHERE tutor_id = ? AND module_id = ? AND status = 'approved'`).get(tutorId, app.module_id))
            return res.status(400).json({ error: 'That tutor is not approved for this module.' });
    }
    if (status === 'approved' && !tutorId) return res.status(400).json({ error: 'Choose a tutor before approving.' });
    db.prepare('UPDATE applications SET status = ?, tutor_id = ? WHERE id = ?').run(status, tutorId, app.id);
    res.json({ message: 'Application updated.' });
}));

/* materials moderation uses DELETE /api/materials/:id (allowed for admin) */

/* reviews: moderate abusive or fake reviews */
router.get('/admin/reviews', admin, safe((req, res) => {
    res.json({ reviews: db.prepare(`SELECT r.id, r.rating, r.comment, r.created_at, s.name AS student_name, t.name AS tutor_name
                                    FROM reviews r JOIN users s ON s.id = r.student_id JOIN users t ON t.id = r.tutor_id
                                    ORDER BY r.created_at DESC`).all() });
}));

router.delete('/admin/reviews/:id', admin, safe((req, res) => {
    const info = db.prepare('DELETE FROM reviews WHERE id = ?').run(parseInt(req.params.id, 10));
    if (!info.changes) return res.status(404).json({ error: 'Review not found.' });
    res.json({ message: 'Review deleted.' });
}));

/* password reset requests: the admin checks who is asking, then issues a one-hour link */
// Audit log only: links are created automatically by /api/auth/forgot. The admin can see requests and revoke a link.
router.get('/admin/resets', admin, safe((req, res) => {
    res.json({ resets: db.prepare(`SELECT p.id, p.status, p.created_at, p.expires_at, u.name, u.email, u.role,
                                          (p.status = 'issued' AND p.expires_at <= strftime('%Y-%m-%d %H:%M:%S', 'now')) AS expired
                                   FROM password_resets p JOIN users u ON u.id = p.user_id
                                   ORDER BY p.created_at DESC LIMIT 50`).all() });
}));

router.delete('/admin/resets/:id', admin, safe((req, res) => {
    db.prepare('DELETE FROM password_resets WHERE id = ?').run(parseInt(req.params.id, 10));
    res.json({ message: 'Reset entry removed (any unused link no longer works).' });
}));

/* contact messages */
router.get('/admin/messages', admin, safe((req, res) => {
    res.json({ messages: db.prepare('SELECT * FROM contact_messages ORDER BY resolved, created_at DESC').all() });
}));

router.patch('/admin/messages/:id', admin, safe((req, res) => {
    db.prepare('UPDATE contact_messages SET resolved = ? WHERE id = ?').run(req.body.resolved ? 1 : 0, parseInt(req.params.id, 10));
    res.json({ message: 'Updated.' });
}));

router.delete('/admin/messages/:id', admin, safe((req, res) => {
    db.prepare('DELETE FROM contact_messages WHERE id = ?').run(parseInt(req.params.id, 10));
    res.json({ message: 'Message deleted.' });
}));

module.exports = router;
