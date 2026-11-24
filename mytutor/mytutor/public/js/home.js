// Home page: live numbers and a few modules
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

(async function () {
    const grid = document.getElementById('popularModules');
    try {
        const { modules } = await api('/api/modules');
        document.getElementById('statModules').textContent = modules.length;
        document.getElementById('statTutors').textContent = modules.reduce((sum, m) => sum + m.tutor_count, 0);
        const top = modules.filter((m) => m.tutor_count > 0).slice(0, 3);
        clear(grid);
        if (!top.length) grid.append(emptyMsg('No modules have tutors yet.'));
        top.forEach((m) => grid.append(moduleCard(m)));
    } catch (e) {
        clear(grid).append(emptyMsg(e.message));
    }
})();
