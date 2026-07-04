// terminal.js — hidden homepage terminal. Press ~ to open.
(function () {
    var term = document.getElementById('term');
    var input = document.getElementById('term-input');
    var output = document.getElementById('term-output');
    if (!term || !input || !output) return;

    var PAGES = {
        writing: 'writing.html',
        scraps: 'scraps.html',
        finds: 'cool-finds.html',
        'cool-finds': 'cool-finds.html',
        workbench: 'workbench.html',
        about: 'about.html',
        home: 'index.html'
    };

    var HELP = [
        'help          this',
        'ls            list the rooms',
        'cd <room>     go there (try: cd scraps)',
        'whoami        who is faizan',
        'dark / light  set the mood',
        'email         say hi',
        'clear         wipe the screen',
        'exit          close the terminal'
    ].join('\n');

    function print(text, accent) {
        var div = document.createElement('div');
        if (accent) div.className = 't-accent';
        div.textContent = text;
        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
    }

    function setScheme(mode) {
        localStorage.setItem('color-scheme', mode);
        if (window.__applyScheme) window.__applyScheme();
    }

    function run(raw) {
        var line = raw.trim();
        if (!line) return;
        print('~ $ ' + line, true);

        var parts = line.split(/\s+/);
        var cmd = parts[0].toLowerCase();
        var arg = (parts[1] || '').toLowerCase().replace('.html', '');

        switch (cmd) {
            case 'help':
                print(HELP);
                break;
            case 'ls':
                print(Object.keys(PAGES).filter(function (k) {
                    return k !== 'cool-finds' && k !== 'home';
                }).join('  '));
                break;
            case 'cd':
                if (PAGES[arg]) {
                    print('entering ' + arg + '...');
                    setTimeout(function () { window.location.href = PAGES[arg]; }, 350);
                } else {
                    print('no such room: ' + arg + ' (try ls)');
                }
                break;
            case 'whoami':
                print('faizan. engineering student, MSRIT.\nembedded in Mathikere since forever.');
                break;
            case 'dark':
                setScheme('dark');
                print('lights off.');
                break;
            case 'light':
                setScheme('light');
                print('lights on.');
                break;
            case 'email':
                print('faizanxmd@gmail.com — opening...');
                setTimeout(function () { window.location.href = 'mailto:faizanxmd@gmail.com'; }, 350);
                break;
            case 'clear':
                output.textContent = '';
                break;
            case 'exit':
                term.classList.remove('open');
                break;
            case 'sudo':
                print('nice try.');
                break;
            case 'pwd':
                print('/mathikere/faizan');
                break;
            default:
                print(cmd + ': command not found (try help)');
        }
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === '~' && document.activeElement !== input) {
            e.preventDefault();
            var opening = !term.classList.contains('open');
            term.classList.toggle('open');
            if (opening) {
                if (!output.textContent) {
                    print("you found the terminal. type 'help'.");
                }
                input.focus();
            }
        } else if (e.key === 'Escape' && term.classList.contains('open')) {
            term.classList.remove('open');
            input.blur();
        }
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            run(input.value);
            input.value = '';
        }
    });
})();
