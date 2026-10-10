/* ============================================================
   SD CODE AI – UI Events, Tabs, Modals, Command Palette
   ============================================================ */

SDCode.ui = (function() {
    const { $, $$ } = SDCode.utils;

    let unsavedTimer = null;

    function addMessage(text, type) {
        const el = $('#chat-messages');
        if (!el) return null;
        const div = document.createElement('div');
        div.className = 'msg ' + type;
        div.textContent = text;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
        return div;
    }

    function markUnsaved() {
        const el = $('#status-autosave');
        if (!el) return;
        el.innerHTML = '<i class="fa-solid fa-circle" style="color:#f44747;font-size:8px;"></i> Saving...';
        clearTimeout(unsavedTimer);
        unsavedTimer = setTimeout(() => {
            el.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Saved';
        }, 400);
    }

    function toggleChat() {
        const p = $('#chat-panel');
        if (!p) return;
        p.classList.toggle('hidden');
        if (!p.classList.contains('hidden')) {
            const input = $('#chat-input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }

    function switchPanelTab(tab) {
        $$('.panel-tab').forEach(t => {
            if (t.id !== 'panel-collapse') t.classList.toggle('active', t.dataset.tab === tab);
        });
        const t = $('#terminal-container');
        const o = $('#output-container');
        const p = $('#preview-container');
        if (t) t.style.display = tab === 'terminal' ? 'block' : 'none';
        if (o) o.style.display = tab === 'output' ? 'block' : 'none';
        if (p) p.style.display = tab === 'preview' ? 'block' : 'none';
        if (tab === 'terminal') setTimeout(() => SDCode.terminal.fit(), 50);
    }

    function openSettings() {
        const s = SDCode.state;
        $('#sel-provider').value = s.provider;
        $('#inp-nvidia-key').value = s.nvidiaKey;
        $('#inp-gemini-key').value = s.geminiKey;
        $('#inp-plesk-url').value = s.pleskUrl;
        $('#inp-plesk-token').value = s.pleskToken;
        $('#inp-font-size').value = s.settings.fontSize;
        $('#font-size-label').textContent = s.settings.fontSize + 'px';
        $('#inp-wordwrap').checked = s.settings.wordWrap;
        $('#inp-minimap').checked = s.settings.minimap;

        // Populate model dropdowns
        const selN = $('#sel-nvidia-model');
        selN.innerHTML = '<option value="auto">🤖 Auto (Best for task)</option>' +
            SDCode.NVIDIA_MODELS.map(m => `<option value="${m.id}">${m.name} [${m.tier}]${m.tag ? ' — ' + m.tag : ''}</option>`).join('');
        selN.value = s.nvidiaModel;

        const selG = $('#sel-gemini-model');
        selG.innerHTML = SDCode.GEMINI_MODELS.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        selG.value = s.geminiModel;

        $('#settings-modal').classList.add('show');
    }

    function saveSettings() {
        const s = SDCode.state;
        s.provider = $('#sel-provider').value;
        s.nvidiaKey = $('#inp-nvidia-key').value.trim();
        s.nvidiaModel = $('#sel-nvidia-model').value;
        s.geminiKey = $('#inp-gemini-key').value.trim();
        s.geminiModel = $('#sel-gemini-model').value;
        s.pleskUrl = $('#inp-plesk-url').value.trim();
        s.pleskToken = $('#inp-plesk-token').value.trim();
        s.settings.fontSize = parseInt($('#inp-font-size').value, 10) || 13;
        s.settings.wordWrap = $('#inp-wordwrap').checked;
        s.settings.minimap = $('#inp-minimap').checked;

        SDCode.editor.updateSettings(s.settings);
        SDCode.storage.saveSoon();
        updateStatusAI();
        updatePleskStatus();
        $('#settings-modal').classList.remove('show');
    }

    function updateStatusAI() {
        const s = SDCode.state;
        const key = s.provider === 'nvidia' ? s.nvidiaKey : s.geminiKey;
        const el = $('#status-ai');
        if (el) el.innerHTML = key
            ? '<i class="fa-solid fa-circle" style="color:#4ec9b0;font-size:8px;"></i> AI'
            : '<i class="fa-solid fa-circle" style="color:#f44747;font-size:8px;"></i> Off';
        const me = $('#status-model');
        if (me) me.textContent = s.nvidiaModel === 'auto' ? 'auto'
            : SDCode.ai.getModelDisplayName(s.nvidiaModel).substring(0, 14);
    }

    function updatePleskStatus() {
        const s = SDCode.state;
        const el = $('#plesk-status');
        if (!el) return;
        if (s.pleskUrl && s.pleskToken) {
            el.className = 'plesk-status connected';
            el.textContent = 'Plesk: On';
        } else {
            el.className = 'plesk-status disconnected';
            el.textContent = 'Plesk: Off';
        }
    }

    function showAnalysisModal() {
        if (!SDCode.state.project.analyzed) {
            alert('Analyze project first.');
            return;
        }
        const c = $('#analysis-content');
        if (c) c.textContent = SDCode.project.getAnalysisReport();
        $('#analysis-modal').classList.add('show');
    }

    function searchProject(query) {
        const re = new RegExp(SDCode.utils.escapeRegex(query), 'gi');
        const results = [];
        for (const [f, c] of Object.entries(SDCode.state.files)) {
            c.split('\n').forEach((line, i) => {
                if (re.test(line)) results.push(f + ':' + (i+1) + ': ' + line.trim().slice(0, 120));
            });
        }
        const out = $('#output-container');
        if (!results.length) {
            if (out) out.textContent = 'No results for: ' + query;
        } else {
            if (out) out.textContent = `Found ${results.length} results for "${query}":\n\n` + results.slice(0, 200).join('\n');
        }
        switchPanelTab('output');
        const panel = $('#panel');
        if (panel) panel.classList.remove('collapsed');
    }

    /* ---------- Command Palette ---------- */
    const COMMANDS = [
        { id: 'analyze',    title: '🔬 Analyze Project',        run: () => { SDCode.project.analyze().then(showAnalysisModal); } },
        { id: 'export',     title: '📦 Export Project JSON',    run: () => SDCode.files.exportProject() },
        { id: 'import',     title: '📥 Import Project JSON',    run: () => $('#import-input').click() },
        { id: 'newfile',    title: '📄 New File',               run: () => { $('#newfile-modal').classList.add('show'); setTimeout(() => $('#inp-new-filename').focus(), 100); } },
        { id: 'settings',   title: '⚙️ Open Settings',          run: openSettings },
        { id: 'chat',       title: '🤖 Toggle AI Chat',         run: toggleChat },
        { id: 'terminal',   title: '💻 Show Terminal',          run: () => { $('#panel').classList.remove('collapsed'); switchPanelTab('terminal'); } },
        { id: 'preview',    title: '▶️ Preview Active File',    run: () => { if (SDCode.state.activeFile) SDCode.files.runPreview(SDCode.state.activeFile); } },
        { id: 'search',     title: '🔍 Search in Project',      run: () => { const q = prompt('Search:'); if (q) searchProject(q); } },
        { id: 'clearchat',  title: '🗑️ Clear Chat History',     run: () => { $('#chat-messages').innerHTML = '<div class="msg system">Chat cleared.</div>'; SDCode.state.chatHistory = []; } },
        { id: 'save',       title: '💾 Save Project',           run: () => SDCode.storage.saveNow() },
        { id: 'closeall',   title: '❌ Close All Tabs',          run: () => { SDCode.state.openTabs = []; SDCode.state.activeFile = null; SDCode.editor.setValue(''); SDCode.files.renderTabs(); } },
        { id: 'fontinc',    title: '➕ Increase Font Size',     run: () => { SDCode.state.settings.fontSize = Math.min(22, SDCode.state.settings.fontSize + 1); SDCode.editor.updateSettings(SDCode.state.settings); } },
        { id: 'fontdec',    title: '➖ Decrease Font Size',     run: () => { SDCode.state.settings.fontSize = Math.max(10, SDCode.state.settings.fontSize - 1); SDCode.editor.updateSettings(SDCode.state.settings); } },
        { id: 'togglemap',  title: '🗺️ Toggle Minimap',         run: () => { SDCode.state.settings.minimap = !SDCode.state.settings.minimap; SDCode.editor.updateSettings(SDCode.state.settings); } },
        { id: 'togglewrap', title: '↩️ Toggle Word Wrap',       run: () => { SDCode.state.settings.wordWrap = !SDCode.state.settings.wordWrap; SDCode.editor.updateSettings(SDCode.state.settings); } },
    ];

    function openCommandPalette() {
        $('#command-modal').classList.add('show');
        const inp = $('#command-input');
        inp.value = '';
        renderCommandList('');
        setTimeout(() => inp.focus(), 100);
    }

    function renderCommandList(filter) {
        const list = $('#command-list');
        if (!list) return;
        const q = filter.toLowerCase();
        const filtered = COMMANDS.filter(c => c.title.toLowerCase().includes(q) || c.id.includes(q));
        if (!filtered.length) {
            list.innerHTML = '<div style="padding:10px;color:#858585;">No commands found</div>';
            return;
        }
        list.innerHTML = '';
        filtered.forEach((c, i) => {
            const div = document.createElement('div');
            div.className = 'cmd-item' + (i === 0 ? ' selected' : '');
            div.innerHTML = `<span>${c.title}</span>`;
            div.addEventListener('click', () => { runCommand(c.id); });
            list.appendChild(div);
        });
    }

    function runCommand(id) {
        const cmd = COMMANDS.find(c => c.id === id);
        $('#command-modal').classList.remove('show');
        if (cmd) setTimeout(() => cmd.run(), 50);
    }

    /* ---------- Wire everything ---------- */
    function initEvents() {
        // Titlebar buttons
        $('#btn-settings')?.addEventListener('click', openSettings);
        $('#btn-chat-toggle')?.addEventListener('click', toggleChat);
        $('#btn-sidebar-toggle')?.addEventListener('click', () => {
            $('#sidebar').classList.toggle('hidden');
            setTimeout(() => { SDCode.terminal.fit(); SDCode.editor.layout(); }, 100);
        });
        $('#btn-folder-upload')?.addEventListener('click', () => $('#folder-input').click());
        $('#btn-analyze')?.addEventListener('click', () => {
            SDCode.project.analyze().then(showAnalysisModal);
        });
        $('#btn-command')?.addEventListener('click', openCommandPalette);
        $('#btn-export')?.addEventListener('click', () => SDCode.files.exportProject());
        $('#btn-import')?.addEventListener('click', () => $('#import-input').click());

        // File inputs
        $('#folder-input')?.addEventListener('change', (e) => {
            if (e.target.files.length) SDCode.files.handleFolderUpload(e.target.files);
            e.target.value = '';
        });
        $('#import-input')?.addEventListener('change', (e) => {
            if (e.target.files[0]) SDCode.files.importProject(e.target.files[0]);
            e.target.value = '';
        });

        // Drop zone
        const dropZone = $('#drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                const files = [];
                for (const item of e.dataTransfer.items) {
                    if (item.kind === 'file') {
                        const entry = item.webkitGetAsEntry?.();
                        if (entry) files.push(...await traverseEntry(entry));
                    }
                }
                if (files.length) SDCode.files.handleFolderUpload(files);
            });
            dropZone.addEventListener('click', (e) => {
                if (e.target.id !== 'folder-input') $('#folder-input').click();
            });
        }

        // Activity bar
        $$('.act-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.act-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const p = btn.dataset.panel;
                if (p === 'terminal') { $('#panel').classList.remove('collapsed'); switchPanelTab('terminal'); }
                else if (p === 'preview') {
                    $('#panel').classList.remove('collapsed');
                    switchPanelTab('preview');
                    if (SDCode.state.activeFile) SDCode.files.runPreview(SDCode.state.activeFile);
                }
                else if (p === 'search') {
                    const q = prompt('Search:');
                    if (q) searchProject(q);
                } else if (p === 'explorer') {
                    $('#sidebar').classList.remove('hidden');
                }
            });
        });

        // Panel tabs
        $$('.panel-tab').forEach(tab => {
            if (tab.id === 'panel-collapse') return;
            tab.addEventListener('click', () => switchPanelTab(tab.dataset.tab));
        });
        $('#panel-collapse')?.addEventListener('click', () => {
            $('#panel').classList.toggle('collapsed');
            setTimeout(() => { SDCode.terminal.fit(); SDCode.editor.layout(); }, 100);
        });

        // New file modal
        $('#btn-new-file')?.addEventListener('click', () => {
            $('#newfile-modal').classList.add('show');
            setTimeout(() => $('#inp-new-filename').focus(), 100);
        });
        $('#btn-newfile-cancel')?.addEventListener('click', () => $('#newfile-modal').classList.remove('show'));
        $('#btn-newfile-create')?.addEventListener('click', () => {
            const name = $('#inp-new-filename').value.trim();
            if (name) {
                SDCode.files.createFile(name);
                $('#newfile-modal').classList.remove('show');
                $('#inp-new-filename').value = '';
            }
        });

        // Settings modal
        $('#btn-settings-cancel')?.addEventListener('click', () => $('#settings-modal').classList.remove('show'));
        $('#btn-settings-save')?.addEventListener('click', saveSettings);
        $('#inp-font-size')?.addEventListener('input', (e) => {
            const lbl = $('#font-size-label');
            if (lbl) lbl.textContent = e.target.value + 'px';
        });

        // Analysis modal
        $('#btn-analysis-close')?.addEventListener('click', () => $('#analysis-modal').classList.remove('show'));

        // Command palette
        $('#command-input')?.addEventListener('input', (e) => renderCommandList(e.target.value));
        $('#command-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const first = $('#command-list .cmd-item');
                if (first) first.click();
            } else if (e.key === 'Escape') {
                $('#command-modal').classList.remove('show');
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const items = $$('#command-list .cmd-item');
                const cur = document.querySelector('#command-list .cmd-item.selected');
                let idx = items.indexOf(cur);
                idx = e.key === 'ArrowDown' ? Math.min(items.length-1, idx+1) : Math.max(0, idx-1);
                items.forEach(i => i.classList.remove('selected'));
                if (items[idx]) { items[idx].classList.add('selected'); items[idx].scrollIntoView({block:'nearest'}); }
            }
        });
        $('#command-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'command-modal') $('#command-modal').classList.remove('show');
        });

        // Chat
        const sendBtn = $('#send-btn');
        const chatInput = $('#chat-input');
        sendBtn?.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (text) { chatInput.value = ''; SDCode.ai.sendChat(text); }
        });
        chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
        });
        chatInput?.addEventListener('input', () => {
            sendBtn.disabled = !chatInput.value.trim();
        });
        $('#btn-chat-close')?.addEventListener('click', toggleChat);

        // Quick actions
        $$('.quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const a = btn.dataset.action;
                const file = SDCode.state.activeFile;
                const prompts = {
                    analyze: 'Analyze this project: explain the architecture, main components, and how everything connects.',
                    explain: file ? `Explain ${file} in detail — its purpose, dependencies, and how it fits into the project.` : null,
                    improve: file ? `Improve ${file} — suggest refactoring, better patterns, and best practices. Match the existing style.` : null,
                    fix: file ? `Find and fix bugs in ${file}. Consider the full project context.` : null,
                    doc: file ? `Add comprehensive documentation/comments to ${file}, matching the project style.` : null,
                    test: file ? `Write unit tests for ${file}, using the project's testing framework if any.` : null,
                };
                const p = prompts[a];
                if (p) SDCode.ai.sendChat(p);
                else addMessage('Open a file first.', 'system');
            });
        });

        // Close modals on overlay click
        $$('.modal-overlay').forEach(o => {
            o.addEventListener('click', (e) => { if (e.target === o) o.classList.remove('show'); });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
            else if (mod && e.key === 's') { e.preventDefault(); SDCode.storage.saveNow(); addMessage('💾 Project saved.', 'context'); }
            else if (mod && e.key === 'p') { e.preventDefault(); openCommandPalette(); }
            else if (mod && e.key === '`') { e.preventDefault(); $('#panel').classList.toggle('collapsed'); }
            else if (mod && e.key === 'b') { e.preventDefault(); $('#sidebar').classList.toggle('hidden'); }
            else if (e.key === 'Escape') {
                $$('.modal-overlay.show').forEach(o => o.classList.remove('show'));
            }
        });

        // Window resize
        window.addEventListener('resize', SDCode.utils.debounce(() => {
            SDCode.terminal.fit();
            SDCode.editor.layout();
        }, 200));
    }

    function traverseEntry(entry, path = '') {
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file((file) => { file._path = path + entry.name; resolve([file]); }, () => resolve([]));
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                reader.readEntries(async (entries) => {
                    let files = [];
                    for (const e of entries) files = files.concat(await traverseEntry(e, path + entry.name + '/'));
                    resolve(files);
                }, () => resolve([]));
            } else resolve([]);
        });
    }

    return {
        initEvents, addMessage, markUnsaved,
        toggleChat, switchPanelTab,
        openSettings, saveSettings,
        updateStatusAI, updatePleskStatus,
        showAnalysisModal, searchProject,
        openCommandPalette,
    };
})();