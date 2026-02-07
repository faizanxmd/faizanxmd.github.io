const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'faizanxmd';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'mysite';
const REF = process.env.GITHUB_REPO_REF || 'main';
const FALLBACK = process.env.LAST_UPDATED_FALLBACK || 'Feb 2, 2026';

function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return FALLBACK;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ ok: false });
        return;
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ok: true, date: FALLBACK, source: 'fallback' });
        return;
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${REF}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'faizanxmd-mysite'
            }
        });

        if (!response.ok) {
            res.setHeader('Cache-Control', 'no-store');
            res.status(200).json({ ok: true, date: FALLBACK, source: 'fallback' });
            return;
        }

        const data = await response.json();
        const commitDate = data?.commit?.committer?.date || data?.commit?.author?.date;
        const formatted = formatDate(commitDate);

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        res.status(200).json({ ok: true, date: formatted, source: 'github' });
    } catch (_error) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ok: true, date: FALLBACK, source: 'fallback' });
    }
};
