/* ============================================================
   SD CODE AI – Utilities & Storage
   ============================================================ */

SDCode.utils = (function() {
    const $  = (s, p) => (p || document).querySelector(s);
    const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
        }[c]));
    }

    function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function debounce(fn, ms) {
        let t;
        return function(...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function throttle(fn, ms) {
        let last = 0;
        return function(...args) {
            const now = Date.now();
            if (now - last >= ms) { last = now; fn.apply(this, args); }
        };
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    function getExt(path) {
        const m = path.match(/\.([^.\/]+)$/);
        return m ? m[1].toLowerCase() : '';
    }

    function getBaseName(path) {
        return path.split('/').pop();
    }

    function getDir(path) {
        const i = path.lastIndexOf('/');
        return i >= 0 ? path.substring(0, i) : '';
    }

    function nowTime() {
        return new Date().toLocaleTimeString();
    }

    /* ------------- Storage ------------- */
    const storage = {
        save(key, value) {
            try {
                const str = JSON.stringify(value);
                if (str.length > 4.5 * 1024 * 1024) {
                    console.warn('Payload too large for localStorage:', str.length);
                    return false;
                }
                localStorage.setItem(key, str);
                return true;
            } catch (e) {
                console.warn('Storage save failed:', e);
                return false;
            }
        },
        load(key, fallback = null) {
            try {
                const s = localStorage.getItem(key);
                return s ? JSON.parse(s) : fallback;
            } catch (e) {
                console.warn('Storage load failed:', e);
                return fallback;
            }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (e) {}
        },
    };

    /* ------------- File IO ------------- */
    function download(filename, content) {
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /* ------------- Array/Set helpers ------------- */
    function unique(arr) { return [...new Set(arr)]; }

    function sortPaths(paths) {
        return paths.slice().sort((a, b) => {
            const aDir = a.includes('/'), bDir = b.includes('/');
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    return {
        $, $$, escapeHtml, escapeRegex, debounce, throttle,
        formatBytes, getExt, getBaseName, getDir, nowTime,
        storage, download, readFileAsText, unique, sortPaths,
    };
})();