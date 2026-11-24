# MyTutor - NUST peer tutoring platform (WAD621S Assignment 4)

Dynamic web app: students find approved tutors for modules, apply for tutoring, download materials and RSVP to live sessions.
Stack: HTML, CSS (no Bootstrap), vanilla JavaScript, Node.js 22.13+ (use the LTS) + Express, SQLite via the built-in node:sqlite module (relational).

## Run it
```
npm install
npm start          # http://localhost:3000
```
The database (`database/mytutor.db`) is created from `database/schema.sql` + `seed.sql` on first start.

Demo logins (change before any real use; set `ADMIN_PASSWORD` env var before first start to choose the admin password):
| Role | Email | Password |
|---|---|---|
| Admin | admin@mytutor.local | Admin@12345 |
| Tutor | amina@mytutor.local | Tutor@12345 |
| Student | student@mytutor.local | Student@12345 |

## Requirements map
| Requirement | Where |
|---|---|
| Home / About / Contact | public/index.html, about.html, contact.html |
| Registration / Login | register.html, login.html, server/routes/auth.js |
| User dashboard | dashboard.html (student + tutor views) |
| Data listing + search/filter | modules.html (search, department, level), tutors.html (search by name, filter by module) |
| Details page | module.html?id=, tutor.html?id= (public tutor profile with reviews) |
| Data-entry forms | apply.html, dashboard (upload material, schedule session), contact, register |
| Admin section | admin.html: add/edit/delete modules, approve tutors, match applications, users, materials, messages |
| Relational DB | database/schema.sql (9 tables, foreign keys, CHECK constraints) |
| Security | bcrypt hashes, parameterised SQL, sessions (httpOnly, sameSite), role checks on every route, rate-limited login, helmet + CSP, upload whitelist/size limit/random names, output escaped via textContent |

## Who writes what (everyone codes)
| Member | Backend | Front-end |
|---|---|---|
| 1 | server/routes/auth.js, server/db.js | register.html/js, login.html/js |
| 2 | server/routes/modules.js | index, modules, module pages + js |
| 3 | server/routes/applications.js | apply.html/js, student part of dashboard.js |
| 4 | server/routes/materials.js | tutor part of dashboard.js |
| 5 | server/routes/admin.js | admin.html/js, contact, about, css/style.css polish |

## Still to do by the team (not generated)
Wireframes, ERD (draw from schema.sql), project report with screenshots, team member list text file, demo rehearsal.

## Password reset emails (optional)
Forgot-password creates a single-use link (valid 30 minutes) automatically, for registered users only.
- **Demo mode (default):** no email server needed. The link is shown on the forgot page and printed in the server console.
- **Real email:** run `npm install` (installs nodemailer) and set these before `npm start`
  (Gmail: turn on 2-step verification, then create an App Password):
  `SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@gmail.com SMTP_PASS=<app password> APP_URL=http://localhost:3000`
  On Windows PowerShell use `$env:SMTP_HOST="smtp.gmail.com"` etc. When email is on, the link is never shown on screen.
