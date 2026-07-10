(function () {
    function applyScheme() {
        var stored = localStorage.getItem('color-scheme');
        var osDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var useDark =
            stored === 'dark' ? true
                : stored === 'light' ? false
                    : osDark;
        document.documentElement.classList.toggle('dark-mode', useDark);
    }

    applyScheme();

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) applyScheme();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== '`') return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        var current = localStorage.getItem('color-scheme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (!current) {
            localStorage.setItem('color-scheme', prefersDark ? 'light' : 'dark');
        } else if (current === 'dark') {
            localStorage.setItem('color-scheme', 'light');
        } else {
            localStorage.removeItem('color-scheme');
        }
        applyScheme();
    });

    window.__applyScheme = applyScheme;
})();
