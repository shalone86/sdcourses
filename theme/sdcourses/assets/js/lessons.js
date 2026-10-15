// Video lessons (posts tagged #lesson): "Lesson 2 of 4" label and progress.
// A lesson counts as done when its quiz is finished (ghost/quiz.js stores
// "cc-quiz:<slug>") or its video is watched to the end ("cc-watched:<slug>").
// Everything stays in the reader's browser (localStorage); nothing is sent.

const read = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
};
const write = (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* private mode: no progress */ }
};
const isDone = (slug) => !!(read('cc-quiz:' + slug) || read('cc-watched:' + slug));

/** Tick finished lessons in every lesson list on the page, and count them. */
function markLists() {
    document.querySelectorAll('[data-cc-slug]').forEach((a) => {
        a.classList.toggle('cc-done', a.hasAttribute('data-cc-lesson') && isDone(a.getAttribute('data-cc-slug')));
    });
    document.querySelectorAll('[data-cc-progress]').forEach((box) => {
        const list = document.querySelector('.index-of-contents-container.static');
        const lessons = [...new Set([...(list || document).querySelectorAll('[data-cc-lesson]')].map((a) => a.getAttribute('data-cc-slug')))];
        const done = lessons.filter(isDone).length;
        box.hidden = !lessons.length;
        const n = lessons.length;
        box.textContent = done === n && done
            ? (n === 1 ? 'Lesson done ✓' : `All ${n} lessons done ✓`)
            : `${done} of ${n} ${n === 1 ? 'lesson' : 'lessons'} done`;
    });
}

/** "Lesson 2 of 4", from the post's place in its course's list. */
function labelLesson(slug) {
    const label = document.querySelector('[data-cc-lesson-label]');
    if (!label) return;
    const slugs = [...new Set([...document.querySelectorAll('.index-of-contents [data-cc-slug]')].map((a) => a.getAttribute('data-cc-slug')))];
    const i = slugs.indexOf(slug);
    label.textContent = i >= 0 ? `Lesson ${i + 1} of ${slugs.length}` : 'Lesson';
}

/** A "Take the quiz" button under the video, for readers who'd rather skip the script. */
function addQuizJump(article) {
    const quiz = article.querySelector('.cc-quiz');
    const video = article.querySelector('.cc-video');
    if (!quiz || article.querySelector('.cc-jump')) return;
    if (!quiz.id) quiz.id = 'quiz';
    const jump = document.createElement('a');
    jump.className = 'cc-jump';
    jump.href = '#' + quiz.id;
    jump.textContent = 'Take the quiz ↓';
    jump.addEventListener('click', (e) => {
        e.preventDefault();
        quiz.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
        history.replaceState(null, '', '#' + quiz.id);
        const first = quiz.querySelector('button, input');
        if (first) first.focus({preventScroll: true});
    });
    const row = document.createElement('div');
    row.className = 'cc-jump-row';
    row.append(jump);
    (video || quiz.parentNode.firstElementChild).after(row);
}

export function initLessons() {
    const article = document.querySelector('article[data-cc-post]');
    const slug = article && article.getAttribute('data-cc-post');
    if (slug && article.hasAttribute('data-cc-is-lesson')) {
        labelLesson(slug);
        addQuizJump(article);
        const video = article.querySelector('.cc-video video');
        if (video) video.addEventListener('ended', () => { write('cc-watched:' + slug, String(Date.now())); markLists(); });
        document.addEventListener('cc-quiz-done', markLists);
    }
    markLists();
}
