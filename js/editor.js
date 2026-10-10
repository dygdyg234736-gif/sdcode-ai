/* ============================================================
   SD CODE AI – Monaco Editor Wrapper
   ============================================================ */

SDCode.editor = (function() {
    const { $, storage } = SDCode.utils;
    const CONFIG = SDCode.CONFIG;

    let __initialized = false;
    let __creating = false;
    let editorInstance = null;

    function init() {
        if (__initialized) return;
        if (window.monaco && window.monaco.editor) {
            __initialized = true;
            createInstance();
            return;
        }
        if (__creating) return;
        __creating = true;

        if (!window.__monacoLoaderConfigured) {
            window.__monacoLoaderConfigured = true;
            try {
                require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
            } catch (e) {
                console.error('Monaco loader config failed:', e);
            }
        }

        if (typeof require === 'undefined') {
            console.error('Monaco loader not available.');
            return;
        }

        require(['vs/editor/editor.main'], () => {
            __creating = false;
            if (__initialized) return;
            __initialized = true;
            createInstance();
        }, (err) => {
            __creating = false;
            console.error('Monaco load error:', err);
        });
    }

    function createInstance() {
        if (!window.monaco) return;
        if (editorInstance) return;

        const container = $('#editor-container');
        if (!container) return;

        monaco.editor.defineTheme('sdcode-dark', {
            base: 'vs-dark', inherit: true, rules: [],
            colors: {
                'editor.background':'#1e1e1e',
                'editorCursor.foreground':'#aeafad',
                'editor.lineHighlightBackground':'#2a2d2e',
                'editorLineNumber.foreground':'#858585',
                'editor.selectionBackground':'#264f78',
            }
        });

        const settings = SDCode.state.settings;
        editorInstance = monaco.editor.create(container, {
            value: '',
            language: 'plaintext',
            theme: 'sdcode-dark',
            fontSize: settings.fontSize,
            fontFamily: "'SF Mono','Cascadia Code','Fira Code',Consolas,monospace",
            minimap: { enabled: settings.minimap },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            tabSize: 2,
            padding: { top: 8 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true },
            renderWhitespace: 'selection',
        });

        editorInstance.onDidChangeModelContent(() => {
            const sd = SDCode.state;
            if (sd.activeFile) {
                sd.files[sd.activeFile] = editorInstance.getValue();
                SDCode.storage.saveSoon();
                SDCode.ui.markUnsaved();
            }
        });

        editorInstance.onDidChangeCursorPosition((e) => {
            const el = $('#status-pos');
            if (el) el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
        });

        SDCode.state.editor = editorInstance;
    }

    function setValue(text) {
        if (!editorInstance) return;
        const model = editorInstance.getModel();
        if (model) editorInstance.setValue(text || '');
    }

    function getValue() {
        return editorInstance ? editorInstance.getValue() : '';
    }

    function setLanguage(filename) {
        if (!editorInstance || !window.monaco) return;
        const ext = SDCode.utils.getExt(filename);
        const lang = SDCode.LANG_MAP[ext] || 'plaintext';
        const model = editorInstance.getModel();
        if (model) monaco.editor.setModelLanguage(model, lang);
        const el = $('#status-lang');
        if (el) el.textContent = lang.charAt(0).toUpperCase() + lang.slice(1).substring(0, 10);
    }

    function updateSettings(newSettings) {
        if (!editorInstance) return;
        if (newSettings.fontSize) editorInstance.updateOptions({ fontSize: newSettings.fontSize });
        if (typeof newSettings.wordWrap !== 'undefined') {
            editorInstance.updateOptions({ wordWrap: newSettings.wordWrap ? 'on' : 'off' });
        }
        if (typeof newSettings.minimap !== 'undefined') {
            editorInstance.updateOptions({ minimap: { enabled: newSettings.minimap } });
        }
    }

    function layout() {
        if (editorInstance) {
            try { editorInstance.layout(); } catch (e) {}
        }
    }

    function focus() {
        if (editorInstance) editorInstance.focus();
    }

    function revealLine(lineNumber) {
        if (!editorInstance) return;
        editorInstance.revealLineInCenter(lineNumber);
    }

    return { init, setValue, getValue, setLanguage, updateSettings, layout, focus, revealLine, get instance() { return editorInstance; } };
})();