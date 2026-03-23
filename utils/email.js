const nodemailer = require('nodemailer');

// ─── Transporter ──────────────────────────────────────────────────────────────
// The transporter is your mail "connection".
// For TESTING we use Mailtrap — emails never reach real inboxes,
// you see them in the Mailtrap dashboard instead.
//
// For PRODUCTION (real school deployment) you swap this out for:
//   - Gmail:     host: 'smtp.gmail.com', port: 465, secure: true
//   - Outlook:   host: 'smtp.office365.com', port: 587
//   - SendGrid:  host: 'smtp.sendgrid.net', port: 587
//   - Mailgun:   host: 'smtp.mailgun.org', port: 587
//
// The sendPasswordResetEmail function below NEVER changes —
// only the transporter config changes between environments.

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER, // ← was MAILTRAP_HOST (bug fix)
    pass: process.env.MAILTRAP_PASS,
  },
});

// ─── sendPasswordResetEmail ───────────────────────────────────────────────────
// Sends a 6-digit password reset code to the user's email.
// Called by authService.forgotPassword() after the code is generated.
//
// @param {string} email  - recipient email address
// @param {string} code   - the 6-digit reset code (plain, before hashing)

async function sendPasswordResetEmail(email, code) {
  await transporter.sendMail({
    from: '"EduAir" <no-reply@eduair.com>',
    to: email,
    subject: 'Your EduAir Password Reset Code', // ← was "subjects" (bug fix)
    text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
  });
}

module.exports = { sendPasswordResetEmail };
