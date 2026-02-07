(function () {
    const body = document.body;
    if (!body) return;

    const modeKeys = new Set(['`', '~']);
    const secret = [106, 111, 103, 105].map((code) => String.fromCharCode(code)).join('');
    const matrixMessage = body.dataset.matrixMessage || [106, 111, 103, 105, 32, 105, 115, 32, 114, 101, 97, 108].map((code) => String.fromCharCode(code)).join('');
    const allowMatrix = body.dataset.matrix !== 'off';

    let secretIndex = 0;
    let matrixActive = false;
    let matrixInterval = null;

    const indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    indicator.setAttribute('aria-live', 'polite');
    document.body.appendChild(indicator);

    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function showIndicator(message) {
        indicator.textContent = message;
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 1200);
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const fontSize = 14;
    let columns = 0;
    let drops = [];
    let glyphOffsets = [];

    function initMatrix() {
        columns = Math.floor(canvas.width / fontSize);
        drops = [];
        glyphOffsets = [];

        for (let i = 0; i < columns; i++) {
            drops[i] = Math.random() * -100;
            glyphOffsets[i] = Math.floor(Math.random() * matrixMessage.length);
        }
    }

    function drawMatrix() {
        if (!ctx || !matrixActive || !body.classList.contains('dark-mode')) {
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.fillStyle = 'rgba(13, 17, 23, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffd700';
        ctx.font = fontSize + 'px "Courier Prime", monospace';

        for (let i = 0; i < drops.length; i++) {
            const char = matrixMessage[glyphOffsets[i] % matrixMessage.length];
            ctx.fillText(char, i * fontSize, drops[i] * fontSize);

            if (Math.random() > 0.95) glyphOffsets[i]++;

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
                glyphOffsets[i] = Math.floor(Math.random() * matrixMessage.length);
            }
            drops[i]++;
        }
    }

    function stopMatrix() {
        matrixActive = false;
        canvas.classList.remove('active');
        if (matrixInterval) {
            clearInterval(matrixInterval);
            matrixInterval = null;
        }
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function toggleMatrix() {
        if (!allowMatrix || !ctx) return;

        if (!matrixActive) {
            matrixActive = true;
            canvas.classList.add('active');
            initMatrix();
            matrixInterval = setInterval(drawMatrix, 50);
            showIndicator('signal found');
            return;
        }

        stopMatrix();
        showIndicator('signal closed');
    }

    function toggleMode() {
        const isDark = body.classList.toggle('dark-mode');
        showIndicator(isDark ? 'night' : 'day');
        if (!isDark && matrixActive) stopMatrix();
    }

    document.addEventListener('keydown', function (event) {
        if (modeKeys.has(event.key)) {
            event.preventDefault();
            toggleMode();
            return;
        }

        const key = (event.key || '').toLowerCase();

        if (allowMatrix && key === secret[secretIndex]) {
            secretIndex++;
            if (secretIndex === secret.length) {
                toggleMatrix();
                secretIndex = 0;
            }
        } else if (allowMatrix && key.length === 1) {
            secretIndex = key === secret[0] ? 1 : 0;
        }

        if (event.key === 'Escape' && matrixActive) {
            stopMatrix();
            showIndicator('signal closed');
        }
    });
})();
