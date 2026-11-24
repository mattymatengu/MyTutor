// Shared helpers used by every page: API calls, DOM builder, navigation state.
// Never insert server data with innerHTML - use el()/textContent so it cannot run as HTML (XSS).

async function api(url, options = {}) {
    const opts = { credentials: 'same-origin', ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
        opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
        opts.body = JSON.stringify(opts.body);
    }
    let res;
    try { res = await fetch(url, opts); }
    catch (e) { throw new Error('Cannot reach the server. Is it running?'); }
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON response (e.g. file download) */ }
    if (!res.ok) {
        const err = new Error(data.error || 'Request failed.');
        err.status = res.status;
        throw err;
    }
    return data;
}

// el('div', {class: 'card'}, 'text', childElement) -> HTMLElement
function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === false || v === null || v === undefined) continue;
        if (k === 'class') node.className = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

function showStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message || '';
    node.className = 'status ' + (isError ? 'error' : 'ok');
}

function formatDate(s) {
    if (!s) return '';
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
    return isNaN(d) ? s : d.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: s.includes('T') && !s.endsWith('Z') ? 'short' : undefined });
}

function stars(avg) {
    if (!avg) return el('span', { class: 'hint' }, 'No reviews yet');
    const full = Math.round(avg);
    return el('span', { class: 'stars', title: avg + ' out of 5' }, '★'.repeat(full) + '☆'.repeat(5 - full), ' ', el('span', { class: 'hint' }, avg.toFixed(1)));
}

function statusPill(status) {
    const cls = { approved: 'ok', active: 'ok', declined: 'bad', rejected: 'bad', suspended: 'bad', pending: 'warn' }[status] || '';
    return el('span', { class: 'pill ' + cls }, status);
}

function emptyMsg(text) { return el('p', { class: 'empty' }, text); }

// Current user (cached for the page)
let currentUser = null;
async function loadUser() {
    try { currentUser = (await api('/api/auth/me')).user; } catch (e) { currentUser = null; }
    return currentUser;
}

// Require login (and optionally a role) or redirect to the login page.
async function requireUserOrRedirect(...roles) {
    const user = await loadUser();
    if (!user) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return null; }
    if (roles.length && !roles.includes(user.role)) { location.href = 'dashboard.html'; return null; }
    return user;
}

async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    location.href = 'index.html';
}

// Navigation: highlight current page, mobile toggle, show Login/Register or Dashboard/Logout.
async function initNav() {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a[href]').forEach((a) => {
        if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
    });

    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');
    if (toggle && links) {
        toggle.addEventListener('click', () => {
            const open = links.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });
    }

    const slot = document.getElementById('authLinks');
    if (!slot) return;
    const user = await loadUser();
    clear(slot);
    if (user) {
        if (user.role === 'admin') slot.append(el('a', { href: 'admin.html' }, 'Admin'));
        else slot.append(el('a', { href: 'dashboard.html' }, 'My Dashboard'));
        slot.append(el('button', { class: 'link-btn', type: 'button', onclick: logout }, 'Logout (' + user.name.split(' ')[0] + ')'));
    } else {
        slot.append(el('a', { href: 'login.html' }, 'Login'));
        slot.append(el('a', { href: 'register.html', class: 'nav-cta' }, 'Register'));
    }
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', initNav);
