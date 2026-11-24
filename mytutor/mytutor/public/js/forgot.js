// Forgot password: ask for a reset (the link is created automatically and emailed)
const form = document.getElementById('forgotForm');
const statusBox = document.getElementById('formStatus');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showStatus(statusBox, 'Please enter a valid email address.', true);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const res = await api('/api/auth/forgot', { method: 'POST', body: { email } });
        showStatus(statusBox, res.message, false);
        if (res.demoLink) {
            statusBox.append(document.createElement('br'), 'Demo mode (no email server configured), use this link: ',
                Object.assign(document.createElement('a'), { href: res.demoLink, textContent: 'Reset my password' }));
        }
        form.reset();
    } catch (err) { showStatus(statusBox, err.message, true); }
    finally { button.disabled = false; }
});
