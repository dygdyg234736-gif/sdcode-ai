/* ============================================================
   SD CODE AI – Bootstrap
   ============================================================ */

SDCode.state = {
    files: {},
    openTabs: [],
    activeFile: null,
    editor: null,
    provider: 'nvidia',
    nvidiaKey: SDCode.CONFIG.DEFAULT_NVIDIA_KEY,
    geminiKey: '',
    nvidiaModel: 'auto',
    geminiModel: 'gemini-1.5-flash',
    pleskUrl: '',
    pleskToken: '',
    chatHistory: [],
    busy: false,
    lastContextSize: 0,
    settings: {
        fontSize: 13,
        wordWrap: true,
        minimap: false,
    },
    project: {
        framework: null,
        language: null,
        style: null,
        files: {},
        dependencies: {},
        entryPoints: [],
        structure: [],
        extensions: {},
        classes: {},
        functions: {},
        analyzed: false,
    },
};

/* ---------- Persistence wrapper ---------- */
SDCode.storage = (function() {
    const { storage } = SDCode.utils;
    const KEY = SDCode.CONFIG.STORAGE_KEY;
    let saveTimer = null;

    function saveNow() {
        const s = SDCode.state;
        const payload = {
            files: s.files,
            provider: s.provider,
            nvidiaKey: s.nvidiaKey,
            geminiKey: s.geminiKey,
            nvidiaModel: s.nvidiaModel,
            geminiModel: s.geminiModel,
            pleskUrl: s.pleskUrl,
            pleskToken: s.pleskToken,
            settings: s.settings,
            project: s.project,
        };
        const ok = storage.save(KEY, payload);
        if (!ok) {
            // Fallback: save settings only (project too big)
            storage.save(KEY, {
                provider: s.provider,
                nvidiaKey: s.nvidiaKey,
                geminiKey: s.geminiKey,
                nvidiaModel: s.nvidiaModel,
                geminiModel: s.geminiModel,
                pleskUrl: s.pleskUrl,
                pleskToken: s.pleskToken,
                settings: s.settings,
            });
            console.warn('Project too large - only settings saved');
        }
    }

    function saveSoon() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 500);
    }

    function load() {
        const saved = storage.load(KEY, null);
        if (!saved) return;
        const s = SDCode.state;
        if (saved.files && typeof saved.files === 'object') s.files = saved.files;
        ['provider','nvidiaKey','geminiKey','nvidiaModel','geminiModel','pleskUrl','pleskToken']
            .forEach(k => { if (saved[k] !== undefined) s[k] = saved[k]; });
        if (saved.settings) Object.assign(s.settings, saved.settings);
        if (saved.project) s.project = saved.project;
    }

    return { saveNow, saveSoon, load };
})();

/* ---------- Default demo file ---------- */
function seedDemoFile() {
    if (Object.keys(SDCode.state.files).length > 0) return;
    SDCode.state.files['demo.php'] = `<?php
// SD CODE AI Demo
// Apna project folder drag karo → AI auto-analyze karega
// Phir AI se bolo: "currency.php mein multi-currency support add karo"

class Demo {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function getBalance($userId) {
        $stmt = $this->db->prepare("SELECT balance FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        return $stmt->fetchColumn();
    }
}
?>`;
}

/* ---------- Boot sequence ---------- */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c🚀 ' + SDCode.CONFIG.APP_NAME + ' v' + SDCode.CONFIG.VERSION, 'color:#007acc;font-weight:bold;font-size:14px;');

    // 1. Load saved state
    SDCode.storage.load();

    // 2. Wire UI events
    SDCode.ui.initEvents();

    // 3. Initialize editor
    SDCode.editor.init();

    // 4. Initialize terminal (waits for xterm)
    SDCode.terminal.init().catch(e => console.warn('Terminal init error:', e));

    // 5. Seed default file if empty
    seedDemoFile();

    // 6. Render file list
    SDCode.files.render();

    // 7. Open first file
    const first = SDCode.state.activeFile || Object.keys(SDCode.state.files)[0];
    if (first) {
        setTimeout(() => SDCode.files.openFile(first), 300);
    }

    // 8. Update status
    SDCode.ui.updateStatusAI();
    SDCode.ui.updatePleskStatus();
    SDCode.project.updateUI();

    // 9. Register service worker (offline support)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed:', e));
    }

    // 10. Resize all
    setTimeout(() => {
        SDCode.terminal.fit();
        SDCode.editor.layout();
    }, 500);

    console.log('%c✅ Ready. Ctrl+K for command palette.', 'color:#4ec9b0;');
});