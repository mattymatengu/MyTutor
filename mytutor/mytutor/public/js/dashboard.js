// Dashboard for students and tutors (admins are sent to admin.html)
const pageStatus = document.getElementById('pageStatus');

function toast(msg, isError) { showStatus(pageStatus, msg, isError); window.scrollTo({ top: 0, behavior: 'smooth' }); }

async function act(promise, after) {
    try { const res = await promise; toast(res.message, false); if (after) await after(); }
    catch (e) { toast(e.message, true); }
}

function table(headers, rows) {
    return el('div', { class: 'table-wrap' }, el('table', {},
        el('thead', {}, el('tr', {}, headers.map((h) => el('th', { scope: 'col' }, h)))),
        el('tbody', {}, rows)));
}

function sessionItem(s, canRsvp) {
    const right = canRsvp
        ? (s.i_rsvped
            ? el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: () => act(api('/api/sessions/' + s.id + '/rsvp', { method: 'DELETE' }), loadStudent) }, 'Cancel RSVP')
            : el('button', { class: 'btn btn-sm', type: 'button', onclick: () => act(api('/api/sessions/' + s.id + '/rsvp', { method: 'POST' }), loadStudent) }, 'RSVP'))
        : el('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => confirm('Cancel this session?') && act(api('/api/sessions/' + s.id, { method: 'DELETE' }), loadTutor) }, 'Cancel');
    return el('li', {}, el('div', {}, el('strong', {}, s.title), el('div', { class: 'sub' }, s.code + ' - ' + formatDate(s.starts_at) + ' - ' + s.duration_min + ' min'),
        el('div', { class: 'sub' }, s.venue + (canRsvp ? ' - with ' + s.tutor_name : ''))),
        el('div', {}, el('span', { class: 'pill' }, s.rsvp_count + '/' + s.capacity), ' ', right));
}

function materialItem(mt, canDelete) {
    return el('li', {}, el('div', {}, el('strong', {}, mt.title), el('div', { class: 'sub' }, mt.code + ' - ' + mt.kind.replace('_', ' ') + ' - ' + (mt.visibility === 'public' ? 'public' : 'my students only') + (canDelete ? '' : ' - ' + mt.tutor_name))),
        el('div', { class: 'btn-row' },
            el('a', { class: 'btn btn-sm btn-outline', href: '/api/materials/' + mt.id + '/download' }, mt.has_file ? 'Download' : 'Open link'),
            canDelete ? el('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => confirm('Delete this material?') && act(api('/api/materials/' + mt.id, { method: 'DELETE' }), loadTutor) }, 'Delete') : null));
}

/* ---------------- student ---------------- */
async function loadStudent() {
    const [apps, sessions, mats] = await Promise.all([api('/api/applications/mine'), api('/api/sessions'), api('/api/materials')]);

    const appBox = clear(document.getElementById('myApplications'));
    if (!apps.applications.length) appBox.append(emptyMsg('You have not applied for any module yet.'));
    else appBox.append(table(['Module', 'Tutor', 'Status', 'Applied', 'Actions'], apps.applications.map((a) => {
        const actions = el('div', { class: 'btn-row' });
        if (a.status === 'pending') actions.append(el('button', { class: 'btn btn-sm btn-outline', type: 'button', onclick: () => act(api('/api/applications/' + a.id, { method: 'DELETE' }), loadStudent) }, 'Withdraw'));
        if (a.status === 'approved' && a.tutor_id) actions.append(reviewForm(a.tutor_id));
        return el('tr', {}, el('td', {}, el('a', { href: 'module.html?id=' + a.module_id }, a.code), ' ', a.module_name), el('td', {}, a.tutor_name || 'Any tutor'),
            el('td', {}, statusPill(a.status)), el('td', {}, formatDate(a.created_at)), el('td', {}, actions));
    })));

    const sBox = clear(document.getElementById('studentSessions'));
    if (!sessions.sessions.length) sBox.append(emptyMsg('Sessions for your approved modules will appear here.'));
    else sBox.append(el('ul', { class: 'item-list' }, sessions.sessions.map((s) => sessionItem(s, true))));

    const mBox = clear(document.getElementById('studentMaterials'));
    if (!mats.materials.length) mBox.append(emptyMsg('No materials available yet.'));
    else mBox.append(el('ul', { class: 'item-list' }, mats.materials.slice(0, 15).map((m) => materialItem(m, false))));
}

function reviewForm(tutorId) {
    const rating = el('select', { 'aria-label': 'Rating' }, [5, 4, 3, 2, 1].map((n) => el('option', { value: n }, n + ' ★')));
    const comment = el('input', { type: 'text', maxlength: 500, placeholder: 'Short review (optional)', 'aria-label': 'Review comment' });
    const form = el('form', { class: 'review-form', novalidate: true }, rating, comment, el('button', { class: 'btn btn-sm', type: 'submit' }, 'Rate tutor'));
    form.addEventListener('submit', (e) => { e.preventDefault(); act(api('/api/modules/tutors/' + tutorId + '/review', { method: 'POST', body: { rating: Number(rating.value), comment: comment.value } })); });
    return form;
}

/* ---------------- tutor ---------------- */
async function loadTutor() {
    const [inc, sessions, mods, mats] = await Promise.all([api('/api/applications/incoming'), api('/api/sessions'), api('/api/my-modules'), api('/api/materials')]);

    const box = clear(document.getElementById('incoming'));
    if (!inc.applications.length) box.append(emptyMsg('No applications yet. Students will appear here when they apply for your modules.'));
    else box.append(table(['Student', 'Module', 'Request', 'Status', 'Actions'], inc.applications.map((a) =>
        el('tr', {}, el('td', {}, a.student_name, el('div', { class: 'sub hint' }, a.student_email)), el('td', {}, a.code),
            el('td', {}, el('div', {}, a.message), el('div', { class: 'hint' }, 'Level: ' + a.current_level + ' - Available: ' + a.availability)),
            el('td', {}, statusPill(a.status)),
            el('td', {}, a.status === 'pending' ? el('div', { class: 'btn-row' },
                el('button', { class: 'btn btn-sm btn-ok', type: 'button', onclick: () => act(api('/api/applications/' + a.id, { method: 'PATCH', body: { status: 'approved' } }), loadTutor) }, 'Accept'),
                el('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => act(api('/api/applications/' + a.id, { method: 'PATCH', body: { status: 'declined' } }), loadTutor) }, 'Decline')) : '')))));

    const sBox = clear(document.getElementById('tutorSessions'));
    if (!sessions.sessions.length) sBox.append(emptyMsg('No upcoming sessions. Schedule one with the form.'));
    else sBox.append(el('ul', { class: 'item-list' }, sessions.sessions.map((s) => sessionItem(s, false))));

    const approved = mods.modules.filter((m) => m.status === 'approved');
    ['mModule', 'sModule'].forEach((id) => {
        const sel = clear(document.getElementById(id));
        if (!approved.length) sel.append(el('option', { value: '' }, 'No approved modules yet'));
        approved.forEach((m) => sel.append(el('option', { value: m.id }, m.code + ' - ' + m.name)));
    });

    const mBox = clear(document.getElementById('tutorModules'));
    mBox.append(el('h3', {}, 'Modules I teach'), mods.modules.length
        ? el('ul', { class: 'item-list' }, mods.modules.map((m) => el('li', {}, el('span', {}, m.code + ' - ' + m.name), statusPill(m.status))))
        : emptyMsg('You have not listed any modules.'));

    const matBox = clear(document.getElementById('tutorMaterials'));
    const mine = mats.materials.filter((m) => m.tutor_id === currentUser.id);
    matBox.append(el('h3', {}, 'My materials'), mine.length ? el('ul', { class: 'item-list' }, mine.map((m) => materialItem(m, true))) : emptyMsg('Nothing uploaded yet.'));
}

function hookTutorForms() {
    // my public profile (bio)
    document.getElementById('viewProfile').href = 'tutor.html?id=' + currentUser.id;
    api('/api/tutors/' + currentUser.id).then((d) => { document.getElementById('bio').value = d.tutor.bio || ''; }).catch(() => {});
    document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const box = document.getElementById('profileStatus');
        try {
            const res = await api('/api/tutors/me/profile', { method: 'PATCH', body: { bio: e.target.elements.bio.value } });
            showStatus(box, res.message, false);
        } catch (err) { showStatus(box, err.message, true); }
    });

    document.getElementById('materialForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target, box = document.getElementById('materialStatus');
        if (!form.elements.moduleId.value) return showStatus(box, 'You need an approved module first.', true);
        if (form.elements.title.value.trim().length < 3) return showStatus(box, 'Please enter a title (3+ characters).', true);
        if (!form.elements.file.files.length && !form.elements.linkUrl.value.trim()) return showStatus(box, 'Attach a file or enter a link.', true);
        const file = form.elements.file.files[0];
        if (file && file.size > 15 * 1024 * 1024) return showStatus(box, 'File is too large (15 MB max).', true);
        try {
            const res = await api('/api/materials', { method: 'POST', body: new FormData(form) });
            showStatus(box, res.message, false); form.reset(); loadTutor();
        } catch (err) { showStatus(box, err.message, true); }
    });

    document.getElementById('sessionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target.elements, box = document.getElementById('sessionStatus');
        if (!f.moduleId.value) return showStatus(box, 'You need an approved module first.', true);
        if (f.title.value.trim().length < 3) return showStatus(box, 'Please enter a title.', true);
        if (!f.startsAt.value) return showStatus(box, 'Please choose a date and time.', true);
        if (new Date(f.startsAt.value) < new Date()) return showStatus(box, 'The session must be in the future.', true);
        if (f.venue.value.trim().length < 2) return showStatus(box, 'Please give a venue or meeting link.', true);
        try {
            const res = await api('/api/sessions', { method: 'POST', body: { moduleId: Number(f.moduleId.value), title: f.title.value, startsAt: f.startsAt.value,
                duration: Number(f.duration.value), venue: f.venue.value, capacity: Number(f.capacity.value) } });
            showStatus(box, res.message, false); e.target.reset(); f.duration.value = 60; f.capacity.value = 20; loadTutor();
        } catch (err) { showStatus(box, err.message, true); }
    });
}

(async function init() {
    const user = await requireUserOrRedirect();
    if (!user) return;
    if (user.role === 'admin') { location.href = 'admin.html'; return; }

    document.getElementById('welcome').textContent = 'Welcome, ' + user.name.split(' ')[0];
    document.getElementById('roleLabel').textContent = user.role === 'tutor' ? 'Tutor dashboard' : 'Student dashboard';
    const actions = document.getElementById('dashActions');
    try {
        if (user.role === 'student') {
            actions.append(el('a', { class: 'btn', href: 'apply.html' }, 'Apply for tutoring'), el('a', { class: 'btn btn-outline', href: 'modules.html' }, 'Browse modules'));
            document.getElementById('studentView').hidden = false;
            await loadStudent();
        } else {
            document.getElementById('tutorView').hidden = false;
            hookTutorForms();
            await loadTutor();
        }
    } catch (e) { toast(e.message, true); }
})();
