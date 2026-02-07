(function () {
    const body = document.body;
    if (!body) return;

    const modeKeys = new Set(['`', '~']);
    const allowMatrix = body.dataset.matrix !== 'off';

    let matrixMessage = body.dataset.matrixMessage || 'signal';
    let matrixActive = false;
    let matrixInterval = null;
    let keyBuffer = '';
    let requestInFlight = false;

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

    async function verifyServerUnlock() {
        if (!allowMatrix || requestInFlight || keyBuffer.length < 4) return;

        requestInFlight = true;

        try {
            const response = await fetch('/api/easter-egg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: keyBuffer })
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data && data.unlock) {
                if (typeof data.matrixMessage === 'string' && data.matrixMessage.trim()) {
                    matrixMessage = data.matrixMessage.trim();
                }
                toggleMatrix();
                keyBuffer = '';
            }
        } catch (_error) {
            // No fallback here: if API is unavailable, the secret stays server-side.
        } finally {
            requestInFlight = false;
        }
    }

    document.addEventListener('keydown', function (event) {
        if (modeKeys.has(event.key)) {
            event.preventDefault();
            toggleMode();
            return;
        }

        const key = (event.key || '').toLowerCase();

        if (allowMatrix && key.length === 1 && /[a-z0-9]/.test(key)) {
            keyBuffer = (keyBuffer + key).slice(-128);
            verifyServerUnlock();
        }

        if (event.key === 'Escape' && matrixActive) {
            stopMatrix();
            showIndicator('signal closed');
        }
    });
})();
