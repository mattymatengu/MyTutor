// Reset password: the token comes from the link emailed to the student
const form = document.getElementById('resetForm');
const statusBox = document.getElementById('formStatus');
const token = new URLSearchParams(location.search).get('token') || '';

if (!/^[0-9a-f]{48}$/.test(token)) {
    showStatus(statusBox, 'This reset link is not valid. Please request a new one.', true);
    form.querySelector('button').disabled = true;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = form.elements.password.value;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return showStatus(statusBox, 'Password needs 8+ characters with a letter and a number.', true);
    if (pw !== form.elements.confirm.value) return showStatus(statusBox, 'Passwords do not match.', true);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const res = await api('/api/auth/reset', { method: 'POST', body: { token, password: pw } });
        showStatus(statusBox, res.message, false);
        setTimeout(() => { location.href = 'login.html'; }, 1500);
    } catch (err) { showStatus(statusBox, err.message, true); button.disabled = false; }
});
