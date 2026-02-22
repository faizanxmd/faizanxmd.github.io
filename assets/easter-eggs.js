/**
 * Dark Mode Toggle
 * ────────────────
 * Toggle:  Press ` (backtick) or ~ on any page
 * Console: toggleDarkMode()
 */
(function () {
    var STORAGE_KEY = 'dark-mode';

    function applyMode(dark) {
        if (dark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    function toggle() {
        var isDark = !document.body.classList.contains('dark-mode');
        applyMode(isDark);
        try { localStorage.setItem(STORAGE_KEY, isDark ? '1' : '0'); } catch (e) { }
        return isDark ? 'dark mode on' : 'dark mode off';
    }

    // Restore saved preference immediately
    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') {
            applyMode(true);
        }
    } catch (e) { }

    // Keyboard shortcut: backtick or tilde
    document.addEventListener('keydown', function (e) {
        if (e.key === '`' || e.key === '~') {
            e.preventDefault();
            toggle();
        }
    });

    // Expose to console
    window.toggleDarkMode = toggle;

    console.log('%c🌙 toggleDarkMode() %c— switch between light and dark', 'font-weight:bold', 'color:gray');
})();
