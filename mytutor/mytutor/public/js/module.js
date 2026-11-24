// Module details page
const id = new URLSearchParams(location.search).get('id');

(async function () {
    const head = document.getElementById('moduleHead');
    if (!/^\d+$/.test(id || '')) { clear(head).append(el('h1', {}, 'Module not found'), el('p', {}, el('a', { href: 'modules.html' }, 'Back to modules'))); return; }

    let data;
    try { data = await api('/api/modules/' + id); }
    catch (e) { clear(head).append(el('h1', {}, 'Module not found'), el('p', {}, e.message), el('a', { href: 'modules.html' }, 'Back to modules')); return; }

    const { module: m, tutors, sessions, materials } = data;
    document.title = m.code + ' | MyTutor';
    clear(head).append(
        el('p', { class: 'eyebrow' }, m.department + ' - Level ' + m.level),
        el('h1', {}, m.code + ' - ' + m.name),
        el('p', {}, m.description || ''));

    document.getElementById('applyLink').href = 'apply.html?module=' + m.id;

    const tutorList = clear(document.getElementById('tutorList'));
    if (!tutors.length) tutorList.append(emptyMsg('No approved tutors yet. Check back soon.'));
    else {
        const ul = el('ul', { class: 'item-list' });
        tutors.forEach((t) => ul.append(el('li', {},
            el('div', {}, el('a', { href: 'tutor.html?id=' + t.id }, el('strong', {}, t.name)), el('div', { class: 'sub' }, t.qualification || ''), t.bio ? el('div', { class: 'sub' }, t.bio) : null,
                el('div', {}, stars(t.avg_rating), t.review_count ? el('span', { class: 'hint' }, ' (' + t.review_count + ')') : null)),
            el('div', {}, t.grade ? el('span', { class: 'pill' }, 'Grade ' + t.grade) : null, ' ',
                el('a', { class: 'btn btn-sm', href: 'apply.html?module=' + m.id + '&tutor=' + t.id }, 'Choose')))));
        tutorList.append(ul);
    }

    const sessionList = clear(document.getElementById('sessionList'));
    if (!sessions.length) sessionList.append(emptyMsg('No upcoming sessions scheduled.'));
    else {
        const ul = el('ul', { class: 'item-list' });
        sessions.forEach((s) => ul.append(el('li', {}, el('div', {}, el('strong', {}, s.title),
            el('div', { class: 'sub' }, formatDate(s.starts_at) + ' - ' + s.duration_min + ' min - ' + s.venue + ' - with ' + s.tutor_name)),
            el('span', { class: 'pill' }, s.rsvp_count + '/' + s.capacity + ' going'))));
        sessionList.append(ul);
    }

    const matList = clear(document.getElementById('materialList'));
    if (!materials.length) matList.append(emptyMsg('No public materials yet.'));
    else {
        const user = await loadUser();
        const ul = el('ul', { class: 'item-list' });
        materials.forEach((mt) => ul.append(el('li', {}, el('div', {}, el('strong', {}, mt.title), el('div', { class: 'sub' }, mt.kind.replace('_', ' ') + ' - ' + mt.tutor_name)),
            user ? el('a', { class: 'btn btn-sm btn-outline', href: '/api/materials/' + mt.id + '/download' }, 'Download') : el('a', { class: 'btn btn-sm btn-outline', href: 'login.html?next=' + encodeURIComponent('module.html?id=' + m.id) }, 'Log in'))));
        matList.append(ul);
    }
})();
