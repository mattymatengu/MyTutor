// Register page: client-side validation + submit
const form = document.getElementById('registerForm');
const statusBox = document.getElementById('formStatus');
const tutorFields = document.getElementById('tutorFields');

function selectedRole() { return form.elements.role.value; }

form.querySelectorAll('input[name="role"]').forEach((r) =>
    r.addEventListener('change', () => { tutorFields.hidden = selectedRole() !== 'tutor'; }));

(async function loadModules() {
    const box = document.getElementById('moduleChoices');
    try {
        const { modules } = await api('/api/modules');
        clear(box);
        modules.forEach((m) => box.append(el('label', {}, el('input', { type: 'checkbox', name: 'modules', value: m.id }), m.code + ' - ' + m.name)));
    } catch (e) { clear(box).append(emptyMsg(e.message)); }
})();

function validate() {
    const problems = [];
    const f = form.elements;
    [...form.querySelectorAll('.invalid')].forEach((n) => n.classList.remove('invalid'));
    const fail = (input, msg) => { input.classList.add('invalid'); problems.push(msg); };

    if (f.name.value.trim().length < 2) fail(f.name, 'Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) fail(f.email, 'Enter a valid email address.');
    const pw = f.password.value;
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) fail(f.password, 'Password needs 8+ characters with a letter and a number.');
    if (pw !== f.confirm.value) fail(f.confirm, 'Passwords do not match.');
    if (selectedRole() === 'tutor' && f.qualification.value.trim().length < 3) fail(f.qualification, 'Tutors must enter a qualification.');
    return problems;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problems = validate();
    if (problems.length) return showStatus(statusBox, problems[0], true);

    const f = form.elements;
    const body = {
        role: selectedRole(), name: f.name.value, email: f.email.value, password: f.password.value, studentNo: f.studentNo.value,
        qualification: f.qualification.value,
        modules: [...form.querySelectorAll('input[name="modules"]:checked')].map((c) => Number(c.value))
    };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
        const res = await api('/api/auth/register', { method: 'POST', body });
        showStatus(statusBox, res.message, false);
        form.reset();
        tutorFields.hidden = true;
        if (body.role === 'student') setTimeout(() => { location.href = 'login.html'; }, 1500);
    } catch (err) {
        showStatus(statusBox, err.message, true);
    } finally { button.disabled = false; }
});
