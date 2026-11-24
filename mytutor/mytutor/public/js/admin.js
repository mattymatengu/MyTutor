// Admin panel: tabs + CRUD tables. Every call is also checked on the server (admin role).
const pageStatus = document.getElementById('pageStatus');
let editingModule = null;

function toast(msg, isError) { showStatus(pageStatus, msg, isError); }
async function act(promise, after) {
    try { const res = await promise; toast(res.message, false); if (after) await after(); }
    catch (e) { toast(e.message, true); }
}

function table(headers, rows, emptyText) {
    if (!rows.length) return emptyMsg(emptyText);
    return el('table', {},
        el('thead', {}, el('tr', {}, headers.map((h) => el('th', { scope: 'col' }, h)))),
        el('tbody', {}, rows));
}
const btn = (label, cls, fn) => el('button', { class: 'btn btn-sm ' + cls, type: 'button', onclick: fn }, label);
const put = (id, node) => clear(document.getElementById(id)).append(node);

/* ---------- overview ---------- */
async function loadOverview() {
    const s = await api('/api/admin/stats');
    const items = [['Students', s.students], ['Active tutors', s.tutors], ['Tutors awaiting approval', s.pendingTutors + s.pendingTutorModules],
        ['Modules', s.modules], ['Open applications', s.openApplications], ['Materials', s.materials], ['Unresolved messages', s.unreadMessages]];
    const grid = clear(document.getElementById('statGrid'));
    items.forEach(([label, n]) => grid.append(el('div', { class: 'stat' }, el('strong', {}, n), el('span', {}, label))));

    const max = Math.max(1, ...s.demand.map((d) => d.applications));
    const bucket = (n) => 'bar-w-' + Math.round((n / max) * 10) * 10;
    put('demandList', el('ul', { class: 'item-list' }, s.demand.map((d) => el('li', {}, el('span', {}, d.code + ' - ' + d.name), el('div', {},
        el('strong', {}, d.applications + ' applications'), el('div', { class: 'bar' }, el('span', { class: bucket(d.applications) })))))));

    const bt = document.getElementById('badgeTutors'); bt.textContent = s.pendingTutors + s.pendingTutorModules; bt.hidden = !(s.pendingTutors + s.pendingTutorModules);
    const br = document.getElementById('badgeResets'); br.textContent = s.pendingResets; br.hidden = !s.pendingResets;
    const bm = document.getElementById('badgeMessages'); bm.textContent = s.unreadMessages; bm.hidden = !s.unreadMessages;
}

/* ---------- modules ---------- */
async function loadModules() {
    const { modules } = await api('/api/modules');
    put('moduleTable', table(['Code', 'Name', 'Department', 'Level', 'Tutors', 'Actions'], modules.map((m) => el('tr', {},
        el('td', {}, m.code), el('td', {}, m.name), el('td', {}, m.department), el('td', {}, m.level), el('td', {}, m.tutor_count),
        el('td', {}, el('div', { class: 'btn-row' },
            btn('Edit', 'btn-outline', () => startEdit(m)),
            btn('Delete', 'btn-danger', () => confirm('Delete ' + m.code + '? Its applications, materials and sessions are deleted too.') && act(api('/api/admin/modules/' + m.id, { method: 'DELETE' }), refreshAll)))))), 'No modules.'));
}

function startEdit(m) {
    editingModule = m.id;
    const f = document.getElementById('moduleForm').elements;
    f.code.value = m.code; f.name.value = m.name; f.department.value = m.department; f.level.value = m.level; f.description.value = m.description || '';
    document.getElementById('moduleFormTitle').textContent = 'Edit ' + m.code;
    document.getElementById('moduleSubmit').textContent = 'Save changes';
    document.getElementById('moduleCancel').hidden = false;
    f.code.focus();
}
function resetModuleForm() {
    editingModule = null;
    document.getElementById('moduleForm').reset();
    document.getElementById('moduleFormTitle').textContent = 'Add a module';
    document.getElementById('moduleSubmit').textContent = 'Add module';
    document.getElementById('moduleCancel').hidden = true;
}

/* ---------- tutors ---------- */
async function loadTutors() {
    const { tutors } = await api('/api/admin/tutors');
    put('tutorTable', table(['Tutor', 'Qualification', 'Account', 'Requested modules', 'Actions'], tutors.map((t) => el('tr', {},
        el('td', {}, t.name, el('div', { class: 'hint' }, t.email)), el('td', {}, t.qualification || ''), el('td', {}, statusPill(t.status)),
        el('td', {}, t.modules.length ? el('ul', { class: 'plain' }, t.modules.map((m) => el('li', {}, m.code + ' ', statusPill(m.status), ' ',
            m.status !== 'approved' ? btn('Approve', 'btn-ok', () => act(api('/api/admin/tutors/' + t.id + '/modules/' + m.module_id, { method: 'PATCH', body: { status: 'approved' } }), refreshAll)) : null, ' ',
            m.status !== 'rejected' ? btn('Reject', 'btn-danger', () => act(api('/api/admin/tutors/' + t.id + '/modules/' + m.module_id, { method: 'PATCH', body: { status: 'rejected' } }), refreshAll)) : null))) : 'None'),
        el('td', {}, t.status === 'active' ? btn('Suspend', 'btn-danger', () => act(api('/api/admin/tutors/' + t.id, { method: 'PATCH', body: { status: 'suspended' } }), refreshAll))
            : btn(t.status === 'pending' ? 'Approve tutor' : 'Reactivate', 'btn-ok', () => act(api('/api/admin/tutors/' + t.id, { method: 'PATCH', body: { status: 'active' } }), refreshAll))))), 'No tutors yet.'));
}

/* ---------- applications ---------- */
async function loadApplications() {
    const { applications } = await api('/api/admin/applications');
    const { tutors } = await api('/api/admin/tutors');
    put('applicationTable', table(['Student', 'Module', 'Request', 'Tutor', 'Status', 'Actions'], applications.map((a) => {
        const eligible = tutors.filter((t) => t.status === 'active' && t.modules.some((m) => m.module_id === a.module_id && m.status === 'approved'));
        const sel = el('select', { 'aria-label': 'Assign tutor' }, el('option', { value: '' }, 'Any tutor'), eligible.map((t) => el('option', { value: t.id, selected: t.id === a.tutor_id }, t.name)));
        return el('tr', {}, el('td', {}, a.student_name), el('td', {}, a.code), el('td', {}, a.message, el('div', { class: 'hint' }, a.current_level + ' - ' + a.availability)),
            el('td', {}, sel), el('td', {}, statusPill(a.status)),
            el('td', {}, el('div', { class: 'btn-row' },
                btn('Approve', 'btn-ok', () => act(api('/api/admin/applications/' + a.id, { method: 'PATCH', body: { status: 'approved', tutorId: sel.value ? Number(sel.value) : null } }), refreshAll)),
                btn('Decline', 'btn-danger', () => act(api('/api/admin/applications/' + a.id, { method: 'PATCH', body: { status: 'declined', tutorId: sel.value ? Number(sel.value) : null } }), refreshAll)))));
    }), 'No applications yet.'));
}

/* ---------- users ---------- */
async function loadUsers() {
    const { users } = await api('/api/admin/users');
    put('userTable', table(['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'], users.map((u) => el('tr', {},
        el('td', {}, u.name), el('td', {}, u.email), el('td', {}, u.role), el('td', {}, statusPill(u.status)), el('td', {}, formatDate(u.created_at)),
        el('td', {}, u.role === 'admin' ? '' : el('div', { class: 'btn-row' },
            u.status === 'suspended' ? btn('Reactivate', 'btn-ok', () => act(api('/api/admin/users/' + u.id, { method: 'PATCH', body: { status: 'active' } }), refreshAll))
                : btn('Suspend', 'btn-outline', () => act(api('/api/admin/users/' + u.id, { method: 'PATCH', body: { status: 'suspended' } }), refreshAll)),
            btn('Delete', 'btn-danger', () => confirm('Permanently delete ' + u.name + '?') && act(api('/api/admin/users/' + u.id, { method: 'DELETE' }), refreshAll)))))), 'No users.'));
}

/* ---------- materials ---------- */
async function loadMaterials() {
    const { materials } = await api('/api/materials');
    put('materialTable', table(['Title', 'Module', 'Tutor', 'Type', 'Visibility', 'Added', 'Actions'], materials.map((m) => el('tr', {},
        el('td', {}, m.title), el('td', {}, m.code), el('td', {}, m.tutor_name), el('td', {}, m.kind.replace('_', ' ')), el('td', {}, m.visibility.replace('_', ' ')), el('td', {}, formatDate(m.created_at)),
        el('td', {}, el('div', { class: 'btn-row' }, el('a', { class: 'btn btn-sm btn-outline', href: '/api/materials/' + m.id + '/download' }, 'View'),
            btn('Remove', 'btn-danger', () => confirm('Remove this material?') && act(api('/api/materials/' + m.id, { method: 'DELETE' }), refreshAll)))))), 'No materials uploaded.'));
}

/* ---------- sessions (upcoming, all tutors) ---------- */
async function loadSessions() {
    const { sessions } = await api('/api/sessions');
    put('sessionTable', table(['Session', 'Module', 'Tutor', 'When', 'Venue', 'Going', 'Actions'], sessions.map((s) => el('tr', {},
        el('td', {}, s.title), el('td', {}, s.code), el('td', {}, s.tutor_name), el('td', {}, formatDate(s.starts_at)), el('td', {}, s.venue),
        el('td', {}, s.rsvp_count + '/' + s.capacity),
        el('td', {}, btn('Cancel', 'btn-danger', () => confirm('Cancel this session?') && act(api('/api/sessions/' + s.id, { method: 'DELETE' }), refreshAll))))), 'No upcoming sessions.'));
}

/* ---------- reviews (moderation) ---------- */
async function loadReviews() {
    const { reviews } = await api('/api/admin/reviews');
    put('reviewTable', table(['Tutor', 'Student', 'Rating', 'Comment', 'Date', 'Actions'], reviews.map((r) => el('tr', {},
        el('td', {}, r.tutor_name), el('td', {}, r.student_name), el('td', {}, el('span', { class: 'stars' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating))),
        el('td', {}, r.comment || ''), el('td', {}, formatDate(r.created_at)),
        el('td', {}, btn('Delete', 'btn-danger', () => confirm('Delete this review?') && act(api('/api/admin/reviews/' + r.id, { method: 'DELETE' }), refreshAll))))), 'No reviews yet.'));
}

/* ---------- password resets ---------- */
async function loadResets() {
    const { resets } = await api('/api/admin/resets');
    const state = (r) => r.status === 'done' ? el('span', { class: 'pill ok' }, 'password changed')
        : r.expired ? el('span', { class: 'pill' }, 'link expired') : el('span', { class: 'pill warn' }, 'link sent, not used yet');
    put('resetTable', table(['Person', 'Role', 'Requested', 'Status', 'Actions'], resets.map((r) => el('tr', {},
        el('td', {}, r.name, el('div', { class: 'hint' }, r.email)), el('td', {}, r.role), el('td', {}, formatDate(r.created_at)),
        el('td', {}, state(r)),
        el('td', {}, el('div', { class: 'btn-row' },
            btn(r.status === 'issued' && !r.expired ? 'Revoke link' : 'Remove', 'btn-outline', () => act(api('/api/admin/resets/' + r.id, { method: 'DELETE' }), refreshAll)))))), 'No password reset requests.'));
}

/* ---------- messages ---------- */
async function loadMessages() {
    const { messages } = await api('/api/admin/messages');
    put('messageTable', table(['From', 'Subject', 'Message', 'Received', 'Actions'], messages.map((m) => el('tr', {},
        el('td', {}, m.name, el('div', { class: 'hint' }, m.email)), el('td', {}, m.subject, ' ', m.resolved ? el('span', { class: 'pill ok' }, 'resolved') : el('span', { class: 'pill warn' }, 'new')),
        el('td', {}, m.message), el('td', {}, formatDate(m.created_at)),
        el('td', {}, el('div', { class: 'btn-row' },
            btn(m.resolved ? 'Reopen' : 'Resolve', 'btn-outline', () => act(api('/api/admin/messages/' + m.id, { method: 'PATCH', body: { resolved: !m.resolved } }), refreshAll)),
            btn('Delete', 'btn-danger', () => confirm('Delete this message?') && act(api('/api/admin/messages/' + m.id, { method: 'DELETE' }), refreshAll)))))), 'No messages.'));
}

async function refreshAll() {
    await Promise.all([loadOverview(), loadModules(), loadTutors(), loadApplications(), loadUsers(), loadMaterials(), loadSessions(), loadReviews(), loadResets(), loadMessages()]);
}

/* ---------- tabs ---------- */
function initTabs() {
    const tabs = [...document.querySelectorAll('#adminTabs [role="tab"]')];
    tabs.forEach((tab) => tab.addEventListener('click', () => {
        tabs.forEach((t) => {
            const on = t === tab;
            t.setAttribute('aria-selected', String(on));
            document.getElementById('tab-' + t.dataset.tab).hidden = !on;
        });
    }));
}

document.getElementById('moduleCancel').addEventListener('click', resetModuleForm);
document.getElementById('moduleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements, box = document.getElementById('moduleStatus');
    if (!/^[A-Za-z0-9]{3,12}$/.test(f.code.value.trim())) return showStatus(box, 'Code must be 3-12 letters/numbers, e.g. WAD621S.', true);
    if (f.name.value.trim().length < 3) return showStatus(box, 'Please enter a module name.', true);
    if (f.department.value.trim().length < 3) return showStatus(box, 'Please enter a department.', true);
    const body = { code: f.code.value, name: f.name.value, department: f.department.value, level: Number(f.level.value), description: f.description.value };
    try {
        const res = editingModule
            ? await api('/api/admin/modules/' + editingModule, { method: 'PUT', body })
            : await api('/api/admin/modules', { method: 'POST', body });
        showStatus(box, res.message, false);
        resetModuleForm();
        await refreshAll();
    } catch (err) { showStatus(box, err.message, true); }
});

(async function init() {
    const user = await requireUserOrRedirect('admin');
    if (!user) return;
    initTabs();
    try { await refreshAll(); } catch (e) { toast(e.message, true); }
})();
