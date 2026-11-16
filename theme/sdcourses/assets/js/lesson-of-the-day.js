// Lesson of the day on the home page (partials/components/lesson-of-the-day.hbs).
// Moved here from Code injection (ghost/home-picks.js). It runs in the visitor's
// browser because Ghost serves cached pages. The pick changes once a day, and everyone
// sees the same one that day. It uses the Content API key the site already publishes
// for its search box.

const PAGES = /^\/(course|lesson)\//;   // lessons live here; /blog/ never counts
const NOT_LESSONS = /^(sources|congratulations!?|.*downloads?)$|advent/i;

// Easter Sunday (Gregorian), as a local date.
export function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

// From a week before Ash Wednesday (Easter − 46 days) through Easter Sunday.
export function isAroundLent(now = new Date()) {
    const e = easter(now.getFullYear());
    const start = new Date(e.getFullYear(), e.getMonth(), e.getDate() - 46 - 7);
    const end = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    return now >= start && now < end;
}

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export function initLessonOfTheDay() {
    const box = document.querySelector('[data-cc-lotd]');
    const keyEl = document.querySelector('[data-key][data-api]');
    if (!box || !keyEl) return;

    const api = keyEl.getAttribute('data-api').replace(/\/$/, '') + '/posts/';
    const key = keyEl.getAttribute('data-key');
    const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const lent = list(box.dataset.lent);
    // Lenten posts never join the daily rotation; around Lent they get their own card.
    const skip = new Set([...list(box.dataset.skip), ...lent]);
    const grid = box.querySelector('.sd-picks-grid');
    const button = box.querySelector('[data-cc-lotd-random]');

    // Every lesson in the pool (a few dozen), filtered here as well as by the API:
    // a long filter in the address gets refused (HTTP 403) by the site's firewall.
    const load = async () => {
        const all = [];
        for (let page = 1; page <= 5; page++) {
            const res = await fetch(api + '?key=' + key + '&filter=' + encodeURIComponent(box.dataset.filter) +
                '&limit=100&page=' + page + '&fields=title,slug,url,feature_image,custom_excerpt,excerpt');
            if (!res.ok) break;
            const data = await res.json();
            all.push(...(data.posts || []));
            if (!data.meta || !data.meta.pagination || !data.meta.pagination.next) break;
        }
        return all.filter((p) => {
            const path = new URL(p.url, location.origin).pathname;
            return PAGES.test(path) && !skip.has(p.slug) && !NOT_LESSONS.test(p.title || '');
        });
    };

    const card = (p, label) => {
        // (an automatic excerpt can start with the video player's "0:00 /1:23 1×" or a callout's emoji)
        const text = (p.custom_excerpt || p.excerpt || '').replace(/^[\s\d:/×.\p{Extended_Pictographic}\uFE0F]+(?=\S)/u, '');
        return '<a class="sd-pick" href="' + esc(p.url) + '">' +
            (p.feature_image ? '<img src="' + esc(p.feature_image) + '" alt="" loading="lazy">' : '') +
            '<div>' + (label ? '<span class="sd-pick-label">' + esc(label) + '</span>' : '') +
            '<h3>' + esc(p.title) + '</h3>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div></a>';
    };

    const lentCards = () => !lent.length || !isAroundLent() ? Promise.resolve([]) :
        Promise.all(lent.map((slug) => fetch(api + 'slug/' + encodeURIComponent(slug) + '/?key=' + key +
            '&fields=title,slug,url,feature_image,custom_excerpt,excerpt')
            .then((r) => (r.ok ? r.json() : {})).then((d) => (d.posts || [])[0]).catch(() => null)))
            .then((posts) => posts.filter(Boolean));

    Promise.all([load(), lentCards()]).then(([pool, seasonal]) => {
        seasonal.forEach((p) => grid.insertAdjacentHTML('beforeend', card(p, 'For Lent')));
        if (seasonal.length) box.hidden = false;
        if (!pool.length) { button.hidden = true; return; }
        // Same order for everyone, so the day's pick is the same everywhere; spread the
        // days over the list (a fixed shuffle, not just "the next one").
        pool.sort((a, b) => (a.slug < b.slug ? -1 : 1));
        const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
        const today = pool[((day + 7) * 2654435761 >>> 0) % pool.length];
        grid.insertAdjacentHTML('afterbegin', card(today));
        box.hidden = false;
        button.addEventListener('click', () => {
            const others = pool.length > 1 ? pool.filter((p) => p !== today) : pool;
            location.href = others[Math.floor(Math.random() * others.length)].url;
        });
    }).catch(() => {});
}
