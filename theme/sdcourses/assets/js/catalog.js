// "Catalog" home page and the "My learning" page.
// Progress is what lessons.js and the quiz already keep in the reader's browser:
//   cc-quiz:<lesson slug>    {best, total, at}  (a finished quiz)
//   cc-watched:<lesson slug> time               (a video watched to the end)
// Which lesson belongs to which course comes from the Content API (the key the
// site already publishes for search), cached for the visit.

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const quizOf = (slug) => { try { return JSON.parse(read('cc-quiz:' + slug) || 'null'); } catch { return null; } };
const doneAt = (slug) => { const q = quizOf(slug); return q ? q.at : Number(read('cc-watched:' + slug)) || 0; };
const NOT_LESSONS = new Set(['hash-book', 'hash-blog', 'hash-cover']);
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

/** {courses: {tagSlug: {name, url, lessons: [{slug, title, url}]}}}, oldest lesson first. */
async function loadIndex() {
    try { const c = sessionStorage.getItem('cc-index'); if (c) return JSON.parse(c); } catch { /* no cache */ }
    const keyEl = document.querySelector('[data-key][data-api]');
    if (!keyEl) return null;
    const api = keyEl.getAttribute('data-api').replace(/\/$/, '') + '/posts/?key=' + keyEl.getAttribute('data-key') +
        '&limit=100&order=published_at%20asc&fields=slug,title,url&include=tags&page=';
    const posts = [];
    for (let page = 1; page <= 10; page++) {
        const res = await fetch(api + page);
        if (!res.ok) return null;
        const data = await res.json();
        posts.push(...(data.posts || []));
        if (!data.meta || !data.meta.pagination || !data.meta.pagination.next) break;
    }
    const courses = {};
    posts.forEach((p) => {
        const tags = (p.tags || []).map((t) => t.slug);
        if (tags.includes('hash-book') && p.tags[0]) courses[tags[0]] = {name: p.tags[0].name, url: p.tags[0].url, lessons: []};
    });
    posts.forEach((p) => {
        const tags = (p.tags || []).map((t) => t.slug);
        const c = courses[tags[0]];
        // New courses' first lesson is also the course page (#lesson and #book).
        const isLesson = tags.includes('hash-lesson') || !tags.some((t) => NOT_LESSONS.has(t));
        if (c && isLesson && !tags.includes('hash-blog')) c.lessons.push({slug: p.slug, title: p.title, url: p.url});
    });
    const index = {courses};
    try { sessionStorage.setItem('cc-index', JSON.stringify(index)); } catch { /* fine */ }
    return index;
}

const progressOf = (course) => {
    const done = course.lessons.filter((l) => doneAt(l.slug));
    const next = course.lessons.find((l) => !doneAt(l.slug)) || course.lessons[0];
    return {done: done.length, total: course.lessons.length, next, pct: course.lessons.length ? Math.round(100 * done.length / course.lessons.length) : 0};
};

/** The reader's most recent lesson, and the course it's in. */
function lastActivity(index) {
    let best = null;
    Object.entries(index.courses).forEach(([slug, c]) => c.lessons.forEach((l, i) => {
        const at = doneAt(l.slug);
        if (at && (!best || at > best.at)) best = {at, slug, course: c, i};
    }));
    return best;
}

function initCatalog() {
    const root = document.querySelector('[data-cc-catalog]');
    if (!root) return;
    const cards = [...root.querySelectorAll('[data-cc-course]')];
    const chips = [...root.querySelectorAll('[data-cc-filter]')];
    const search = root.querySelector('[data-cc-search]');
    const count = root.querySelector('[data-cc-count]');
    const empty = root.querySelector('[data-cc-empty]');
    let filter = '';
    const lessonText = {};

    // "Start here" courses (Design setting) go first, with a badge.
    const start = (root.dataset.start || '').split(',').map((s) => s.trim()).filter(Boolean);
    cards.forEach((card) => {
        const i = start.indexOf(card.dataset.ccPage);
        if (i >= 0) { card.style.order = String(i - 100); card.querySelector('.cc-start-badge').hidden = false; }
    });

    const apply = () => {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        cards.forEach((card) => {
            const inCat = !filter || card.dataset.ccCats.split(' ').includes(filter);
            const text = (card.dataset.ccText + ' ' + (lessonText[card.dataset.ccCourse] || '')).toLowerCase();
            const show = inCat && (!q || text.includes(q));
            card.hidden = !show;
            if (show) shown++;
        });
        count.textContent = shown + (shown === 1 ? ' course' : ' courses');
        empty.hidden = shown > 0;
    };
    chips.forEach((chip) => chip.addEventListener('click', () => {
        filter = chip.dataset.ccFilter;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        apply();
    }));
    search.addEventListener('input', apply);
    root.querySelector('[data-cc-clear]').addEventListener('click', () => { search.value = ''; chips[0].click(); });
    apply();

    loadIndex().then((index) => {
        if (!index) return;
        cards.forEach((card) => {
            const c = index.courses[card.dataset.ccCourse];
            if (!c) return;
            lessonText[card.dataset.ccCourse] = c.lessons.map((l) => l.title).join(' ');
            const p = progressOf(c);
            if (p.total) card.querySelector('[data-cc-lessons]').textContent = p.total + (p.total === 1 ? ' lesson' : ' lessons');
            if (p.done) {
                card.querySelector('[data-cc-done]').textContent = p.done === p.total ? 'Finished' : p.pct + '% done';
                card.querySelector('[data-cc-bar]').style.width = p.pct + '%';
                card.querySelector('.cc-bar').hidden = false;
            }
        });
        apply();
        const last = lastActivity(index);
        const box = document.querySelector('[data-cc-resume]');
        if (last && box) {
            const p = progressOf(last.course);
            const finished = p.done === p.total;
            const target = finished ? last.course.lessons[last.i] : p.next;
            box.querySelector('[data-cc-resume-link]').textContent = target.title;
            box.querySelector('[data-cc-resume-link]').href = target.url;
            box.querySelector('[data-cc-resume-meta]').textContent = last.course.name + ' · ' + (finished ? 'course finished' : 'lesson ' + (last.course.lessons.indexOf(target) + 1) + ' of ' + p.total);
            box.querySelector('[data-cc-resume-bar]').style.width = p.pct + '%';
            const go = box.querySelector('[data-cc-resume-go]');
            go.href = finished ? last.course.url : target.url;
            go.textContent = finished ? 'Review the course' : 'Continue';
            box.hidden = false;
        }
    }).catch(() => {});
}

function initMine() {
    const root = document.querySelector('[data-cc-mine]');
    if (!root) return;
    loadIndex().then((index) => {
        const started = index ? Object.values(index.courses).map((c) => ({c, p: progressOf(c)})).filter((x) => x.p.done) : [];
        const lessons = started.reduce((n, x) => n + x.p.done, 0);
        if (!lessons) { root.querySelector('[data-cc-mine-empty]').hidden = false; return; }
        const scores = [];
        const days = new Set();
        const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        started.forEach(({c}) => c.lessons.forEach((l) => {
            const q = quizOf(l.slug);
            if (q && q.total) scores.push(q.best / q.total);
            const at = doneAt(l.slug);
            if (at >= weekStart.getTime()) days.add(new Date(at).toDateString());
        }));
        const set = (k, v) => { root.querySelector(`[data-cc-stat="${k}"]`).textContent = v; };
        set('lessons', lessons);
        set('average', scores.length ? Math.round(100 * scores.reduce((a, b) => a + b, 0) / scores.length) + '%' : '–');
        set('courses', started.length);
        set('week', days.size + '/7');
        root.querySelector('[data-cc-stats]').hidden = false;
        root.querySelector('[data-cc-keep-title]').hidden = false;
        started.sort((a, b) => (a.p.done === a.p.total) - (b.p.done === b.p.total) || b.p.pct - a.p.pct);
        root.querySelector('[data-cc-tracks]').innerHTML = started.map(({c, p}) => `
            <div class="cc-track">
                <a class="cc-track-name" href="${esc(c.url)}">${esc(c.name)}<small>${p.done} of ${p.total} done</small></a>
                <div class="cc-squares">${c.lessons.map((l, i) => {
                    const q = quizOf(l.slug);
                    const state = doneAt(l.slug) ? 'done' : l === p.next && p.done < p.total ? 'next' : '';
                    const label = `Lesson ${i + 1}: ${l.title}${q ? ` (quiz ${q.best}/${q.total})` : state === 'done' ? ' (watched)' : ''}`;
                    return `<a class="cc-square ${state}" href="${esc(l.url)}" title="${esc(label)}" aria-label="${esc(label)}">${i + 1}</a>`;
                }).join('')}</div>
                <a class="cc-track-go" href="${esc(p.done < p.total ? p.next.url : c.url)}">${p.done < p.total ? 'Continue' : 'Review'} →</a>
            </div>`).join('');
    }).catch(() => { root.querySelector('[data-cc-mine-empty]').hidden = false; });
}

export function initCatalogPages() {
    initCatalog();
    initMine();
}
