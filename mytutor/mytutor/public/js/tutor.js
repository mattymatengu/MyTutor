// Tutor profile page: tutor.html?id=2
const id = new URLSearchParams(location.search).get('id');

(async function () {
    const head = document.getElementById('profileHead');
    const notFound = (msg) => clear(head).append(el('h1', {}, 'Tutor not found'), el('p', {}, msg || ''), el('a', { href: 'tutors.html' }, 'Back to all tutors'));
    if (!/^\d+$/.test(id || '')) return notFound();

    let data;
    try { data = await api('/api/tutors/' + id); } catch (e) { return notFound(e.message); }
    const { tutor, modules, reviews, rating, sessions, materials } = data;
    document.title = tutor.name + ' | MyTutor';

    clear(head).append(
        el('p', { class: 'eyebrow' }, 'Tutor profile'),
        el('h1', {}, tutor.name),
        el('p', {}, tutor.qualification || ''),
        el('p', {}, stars(rating.avg), rating.n ? el('span', { class: 'hint' }, ' ' + rating.n + (rating.n === 1 ? ' review' : ' reviews')) : null));

    put('profileAbout', tutor.bio ? el('p', {}, tutor.bio) : emptyMsg('This tutor has not written a bio yet.'),
        el('p', { class: 'hint mt' }, 'On MyTutor since ' + formatDate(tutor.created_at)));

    put('reviewList', reviews.length
        ? el('ul', { class: 'item-list' }, reviews.map((r) => el('li', {}, el('div', {},
            el('span', { class: 'stars' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)),
            r.comment ? el('div', {}, r.comment) : null,
            el('div', { class: 'sub' }, r.student + ' - ' + formatDate(r.created_at))))))
        : emptyMsg('No reviews yet.'));

    put('moduleList', el('ul', { class: 'item-list' }, modules.map((m) => el('li', {},
        el('div', {}, el('a', { href: 'module.html?id=' + m.id }, el('strong', {}, m.code)), el('div', { class: 'sub' }, m.name)),
        el('div', {}, m.grade ? el('span', { class: 'pill' }, 'Grade ' + m.grade) : null, ' ',
            el('a', { class: 'btn btn-sm', href: 'apply.html?module=' + m.id + '&tutor=' + tutor.id }, 'Apply'))))));

    put('sessionList', sessions.length
        ? el('ul', { class: 'item-list' }, sessions.map((s) => el('li', {}, el('div', {}, el('strong', {}, s.title),
            el('div', { class: 'sub' }, s.code + ' - ' + formatDate(s.starts_at) + ' - ' + s.venue)))))
        : emptyMsg('No upcoming sessions.'));

    const user = await loadUser();
    put('materialList', materials.length
        ? el('ul', { class: 'item-list' }, materials.map((mt) => el('li', {}, el('div', {}, el('strong', {}, mt.title), el('div', { class: 'sub' }, mt.code + ' - ' + mt.kind.replace('_', ' '))),
            el('a', { class: 'btn btn-sm btn-outline', href: user ? '/api/materials/' + mt.id + '/download' : 'login.html?next=' + encodeURIComponent('tutor.html?id=' + tutor.id) }, user ? 'Download' : 'Log in'))))
        : emptyMsg('No public materials yet.'));
})();

// replace the contents of an element with new nodes
function put(elementId, ...nodes) { clear(document.getElementById(elementId)).append(...nodes); }
