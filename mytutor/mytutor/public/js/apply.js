// Application form (students only)
const form = document.getElementById('applyForm');
const statusBox = document.getElementById('formStatus');
const params = new URLSearchParams(location.search);

async function loadTutors(moduleId) {
    const sel = form.elements.tutorId;
    clear(sel).append(el('option', { value: '' }, 'Any approved tutor'));
    if (!moduleId) return;
    try {
        const { tutors } = await api('/api/modules/' + moduleId);
        tutors.forEach((t) => sel.append(el('option', { value: t.id }, t.name + (t.avg_rating ? ' (' + t.avg_rating.toFixed(1) + '★)' : ''))));
        if (params.get('tutor')) sel.value = params.get('tutor');
    } catch (e) { /* leave the default option */ }
}

(async function init() {
    const user = await requireUserOrRedirect();
    if (!user) return;
    if (user.role !== 'student') { showStatus(statusBox, 'Only students can apply for tutoring.', true); form.querySelector('button').disabled = true; }

    const { modules } = await api('/api/modules');
    modules.forEach((m) => form.elements.moduleId.append(el('option', { value: m.id }, m.code + ' - ' + m.name)));
    if (params.get('module')) { form.elements.moduleId.value = params.get('module'); loadTutors(params.get('module')); }
    form.elements.moduleId.addEventListener('change', (e) => loadTutors(e.target.value));

    const msg = form.elements.message;
    msg.addEventListener('input', () => { document.getElementById('msgCount').textContent = msg.value.length; });
})();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    [...form.querySelectorAll('.invalid')].forEach((n) => n.classList.remove('invalid'));
    const checks = [
        [f.moduleId, !f.moduleId.value, 'Please choose a module.'],
        [f.currentLevel, !f.currentLevel.value, 'Please choose your current level.'],
        [f.availability, f.availability.value.trim().length < 3, 'Please tell us when you are available.'],
        [f.message, f.message.value.trim().length < 10, 'Please describe what you need (at least 10 characters).']
    ];
    for (const [input, bad, msg] of checks) if (bad) { input.classList.add('invalid'); input.focus(); return showStatus(statusBox, msg, true); }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const res = await api('/api/applications', { method: 'POST', body: {
            moduleId: Number(f.moduleId.value), tutorId: f.tutorId.value ? Number(f.tutorId.value) : null,
            currentLevel: f.currentLevel.value, availability: f.availability.value, message: f.message.value } });
        showStatus(statusBox, res.message, false);
        setTimeout(() => { location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
        showStatus(statusBox, err.message, true);
        button.disabled = false;
    }
});
