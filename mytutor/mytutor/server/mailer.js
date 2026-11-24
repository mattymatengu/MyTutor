// Sends the password-reset email. Email is OPTIONAL:
//  - if the SMTP_* environment variables are set (and `npm install nodemailer` was run) a real email is sent
//  - otherwise the app runs in "demo mode" and the reset link is shown on screen / printed in the server console
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* not installed -> demo mode */ }

const configured = Boolean(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport = null;
if (configured) {
    transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
}

async function sendResetEmail(to, name, link) {
    await transport.sendMail({
        from: process.env.MAIL_FROM || `MyTutor <${process.env.SMTP_USER}>`,
        to,
        subject: 'Reset your MyTutor password',
        text: `Hi ${name},\n\nUse this link to choose a new password. It works once and expires in 30 minutes:\n\n${link}\n\n` +
              'If you did not ask for this, ignore this email - your password stays the same.\n\nMyTutor'
    });
}

module.exports = { emailEnabled: configured, sendResetEmail };
