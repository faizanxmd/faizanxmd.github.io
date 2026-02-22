(function () {
    const body = document.body;
    if (!body) return;

    const STORAGE_KEY = 'dark-mode';
    const modeKeys = new Set(['`', '~']);

    const indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    indicator.setAttribute('aria-live', 'polite');
    document.body.appendChild(indicator);

    function showIndicator(message) {
        indicator.textContent = message;
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 1200);
    }

    function applyMode(isDark) {
        if (isDark) {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
    }

    function toggleMode() {
        const isDark = body.classList.toggle('dark-mode');
        try { localStorage.setItem(STORAGE_KEY, isDark ? '1' : '0'); } catch (_) {}
        showIndicator(isDark ? 'night' : 'day');
    }

    // Restore saved preference on load
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === '1') {
            applyMode(true);
        }
    } catch (_) {}

    document.addEventListener('keydown', function (event) {
        if (modeKeys.has(event.key)) {
            event.preventDefault();
            toggleMode();
        }
    });
})();
