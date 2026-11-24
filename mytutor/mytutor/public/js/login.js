// Login page
const form = document.getElementById('loginForm');
const statusBox = document.getElementById('formStatus');

// Only allow redirects to our own pages (no open redirect)
function safeNext() {
    const next = new URLSearchParams(location.search).get('next') || '';
    return /^[a-z0-9_-]+\.html(\?[\w=&%.-]*)?$/i.test(next) ? next : null;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) return showStatus(statusBox, 'Please enter your email and password.', true);

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const { user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        location.href = safeNext() || (user.role === 'admin' ? 'admin.html' : 'dashboard.html');
    } catch (err) {
        showStatus(statusBox, err.message, true);
        button.disabled = false;
    }
});
