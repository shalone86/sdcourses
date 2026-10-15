// Dark mode: follows the device setting until the reader picks with the
// sun/moon button (remembered in this browser). default.hbs applies it
// before the page draws; this keeps it in sync after.
export const DARK_BG = '#141925';

const stored = () => { try { return localStorage.getItem('cc-theme'); } catch { return null; } };
const systemDark = matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(dark) {
    const root = document.documentElement;
    if (dark) root.style.setProperty('--background-color', DARK_BG);
    else root.style.removeProperty('--background-color');
    root.classList.toggle('has-light-text', dark);
    root.classList.toggle('has-dark-text', !dark);
    root.classList.toggle('is-dark', dark);
    document.querySelectorAll('[data-cc-theme-toggle]').forEach((b) => {
        b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        b.setAttribute('aria-pressed', String(dark));
    });
}

export function initThemeToggle() {
    applyTheme(document.documentElement.classList.contains('is-dark'));
    document.querySelectorAll('[data-cc-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
        const dark = !document.documentElement.classList.contains('is-dark');
        try { localStorage.setItem('cc-theme', dark ? 'dark' : 'light'); } catch { /* not remembered */ }
        applyTheme(dark);
    }));
    systemDark.addEventListener('change', (e) => { if (!stored()) applyTheme(e.matches); });
}
