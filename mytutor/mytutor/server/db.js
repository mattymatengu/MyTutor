const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.13+ (no native build needed)
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, '..', 'database');
const db = new DatabaseSync(process.env.DB_FILE || path.join(dbDir, 'mytutor.db'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

// 1. create tables, 2. insert sample modules
db.exec(fs.readFileSync(path.join(dbDir, 'schema.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(dbDir, 'seed.sql'), 'utf8'));

// 3. demo accounts (only when the users table is empty)
function seedUsers() {
    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    if (count > 0) return;

    const hash = (p) => bcrypt.hashSync(p, 10);
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const insert = db.prepare(`INSERT INTO users (name, email, password_hash, role, status, student_no, qualification, bio)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    insert.run('Site Admin', 'admin@mytutor.local', hash(adminPass), 'admin', 'active', null, null, null);
    const t1 = insert.run('Amina Ndlovu', 'amina@mytutor.local', hash('Tutor@12345'), 'tutor', 'active', null,
        'BSc Computer Science (Honours), NUST', 'Final-year tutor who loves helping first-years get comfortable with code.').lastInsertRowid;
    const t2 = insert.run('Joel Moyo', 'joel@mytutor.local', hash('Tutor@12345'), 'tutor', 'active', null,
        'BSc Mathematics, NUST', 'Patient maths and statistics tutor with 3 years of experience.').lastInsertRowid;
    insert.run('Demo Student', 'student@mytutor.local', hash('Student@12345'), 'student', 'active', '221000000', null, null);

    const mod = db.prepare('SELECT id FROM modules WHERE code = ?');
    const link = db.prepare(`INSERT OR IGNORE INTO tutor_modules (tutor_id, module_id, grade, status) VALUES (?, ?, ?, 'approved')`);
    [['PRG521S', t1, '85%'], ['WAD621S', t1, '82%'], ['DBS521S', t1, '78%'],
     ['MAT511S', t2, '88%'], ['STA511S', t2, '84%']].forEach(([code, t, g]) => link.run(t, mod.get(code).id, g));
}
seedUsers();

module.exports = db;
