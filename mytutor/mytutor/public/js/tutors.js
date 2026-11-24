// Browse tutors: search by name/qualification, filter by module, sort
const grid = document.getElementById('tutorGrid');
const filterForm = document.getElementById('filterForm');
const countBox = document.getElementById('resultCount');

function tutorCard(t) {
    return el('article', { class: 'card module-card' },
        el('h3', {}, t.name),
        el('div', {}, stars(t.avg_rating), t.review_count ? el('span', { class: 'hint' }, ' (' + t.review_count + ')') : null),
        el('p', {}, t.qualification || ''),
        el('div', { class: 'meta' }, (t.module_codes || '').split(', ').filter(Boolean).map((c) => el('span', { class: 'pill' }, c))),
        el('a', { class: 'btn btn-sm', href: 'tutor.html?id=' + t.id }, 'View profile'));
}

async function search() {
    const params = new URLSearchParams();
    ['q', 'moduleId'].forEach((k) => { const v = filterForm.elements[k].value.trim(); if (v) params.set(k, v); });
    clear(grid).append(el('p', { class: 'loading' }, 'Searching...'));
    try {
        let { tutors } = await api('/api/tutors?' + params);
        // the API returns best-rated first; sorting by name is done here in the browser
        if (filterForm.elements.sort.value === 'name') tutors = tutors.slice().sort((a, b) => a.name.localeCompare(b.name));
        clear(grid);
        countBox.textContent = tutors.length + (tutors.length === 1 ? ' tutor found' : ' tutors found');
        if (!tutors.length) grid.append(emptyMsg('No tutors match your search.'));
        tutors.forEach((t) => grid.append(tutorCard(t)));
    } catch (e) { clear(grid).append(emptyMsg(e.message)); }
}

(async function init() {
    try {
        const { modules } = await api('/api/modules');
        modules.forEach((m) => filterForm.elements.moduleId.append(el('option', { value: m.id }, m.code + ' - ' + m.name)));
    } catch (e) { /* filters still work without the module list */ }
    filterForm.addEventListener('submit', (e) => { e.preventDefault(); search(); });
    ['moduleId', 'sort'].forEach((n) => filterForm.elements[n].addEventListener('change', search));
    search();
})();
