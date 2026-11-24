// Modules listing with search + filters (data listing page)
const grid = document.getElementById('moduleGrid');
const filterForm = document.getElementById('filterForm');
const countBox = document.getElementById('resultCount');

function moduleCard(m) {
    return el('article', { class: 'card module-card' },
        el('span', { class: 'code' }, m.code),
        el('h3', {}, m.name),
        el('p', {}, m.description || ''),
        el('div', { class: 'meta' },
            el('span', { class: 'pill' }, m.department),
            el('span', { class: 'pill' }, 'Level ' + m.level),
            el('span', { class: 'pill ' + (m.tutor_count ? 'ok' : 'warn') }, m.tutor_count + (m.tutor_count === 1 ? ' tutor' : ' tutors'))),
        el('a', { class: 'btn btn-sm', href: 'module.html?id=' + m.id }, 'View details'));
}

async function search() {
    const params = new URLSearchParams();
    ['q', 'department', 'level'].forEach((k) => { const v = filterForm.elements[k].value.trim(); if (v) params.set(k, v); });
    history.replaceState(null, '', params.toString() ? '?' + params : location.pathname);
    clear(grid).append(el('p', { class: 'loading' }, 'Searching...'));
    try {
        const { modules } = await api('/api/modules?' + params);
        clear(grid);
        countBox.textContent = modules.length + (modules.length === 1 ? ' module found' : ' modules found');
        if (!modules.length) grid.append(emptyMsg('No modules match your search. Try fewer filters.'));
        modules.forEach((m) => grid.append(moduleCard(m)));
    } catch (e) { clear(grid).append(emptyMsg(e.message)); }
}

(async function init() {
    try {
        const { departments } = await api('/api/modules/departments');
        const sel = filterForm.elements.department;
        departments.forEach((d) => sel.append(el('option', { value: d }, d)));
    } catch (e) { /* filters still work without the list */ }

    const p = new URLSearchParams(location.search);
    ['q', 'department', 'level'].forEach((k) => { if (p.get(k)) filterForm.elements[k].value = p.get(k); });
    filterForm.addEventListener('submit', (e) => { e.preventDefault(); search(); });
    filterForm.elements.department.addEventListener('change', search);
    filterForm.elements.level.addEventListener('change', search);
    search();
})();
