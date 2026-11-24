// Contact form
const form = document.getElementById('contactForm');
const statusBox = document.getElementById('formStatus');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    [...form.querySelectorAll('.invalid')].forEach((n) => n.classList.remove('invalid'));
    const checks = [
        [f.name, f.name.value.trim().length < 2, 'Please enter your name.'],
        [f.email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()), 'Please enter a valid email address.'],
        [f.subject, f.subject.value.trim().length < 3, 'Please enter a subject.'],
        [f.message, f.message.value.trim().length < 10, 'Your message must be at least 10 characters.']
    ];
    for (const [input, bad, msg] of checks) if (bad) { input.classList.add('invalid'); input.focus(); return showStatus(statusBox, msg, true); }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const res = await api('/api/contact', { method: 'POST', body: { name: f.name.value, email: f.email.value, subject: f.subject.value, message: f.message.value } });
        showStatus(statusBox, res.message, false);
        form.reset();
    } catch (err) { showStatus(statusBox, err.message, true); }
    finally { button.disabled = false; }
});
