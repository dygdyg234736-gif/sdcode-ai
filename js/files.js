/* ============================================================
   SD CODE AI – File Management + Project Analyzer
   ============================================================ */

SDCode.files = (function() {
    const { $, $$, escapeHtml, getExt, getBaseName, getDir, storage, download, sortPaths } = SDCode.utils;
    const CONFIG = SDCode.CONFIG;

    /* ====== Render ====== */
    function render() {
        renderFileList();
        renderTabs();
    }

    function renderFileList() {
        const el = $('#file-list');
        if (!el) return;
        const files = sortPaths(Object.keys(SDCode.state.files));
        el.innerHTML = '';
        files.forEach(name => {
            const item = document.createElement('div');
            item.className = 'file-item' + (name === SDCode.state.activeFile ? ' active' : '');
            const ext = getExt(name);
            const icon = SDCode.FILE_ICONS[ext] || 'fa-file';
            item.innerHTML = `
                <i class="fa-solid ${icon}"></i>
                <span title="${escapeHtml(name)}">${escapeHtml(getBaseName(name))}</span>
                <button class="del-btn" data-name="${escapeHtml(name)}" title="Delete">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
            item.addEventListener('click', (e) => {
                if (e.target.closest('.del-btn')) {
                    e.stopPropagation();
                    deleteFile(name);
                } else {
                    openFile(name);
                }
            });
            el.appendChild(item);
        });
    }

    function renderTabs() {
        const el = $('#tabs');
        if (!el) return;
        el.innerHTML = '';
        SDCode.state.openTabs.forEach(name => {
            const tab = document.createElement('div');
            tab.className = 'tab' + (name === SDCode.state.activeFile ? ' active' : '');
            const related = SDCode.state.project.analyzed
                ? SDCode.project.findRelatedFiles(name).length : 0;
            tab.innerHTML = `
                ${related > 0 ? '<span class="related-dot" title="' + related + ' related files"></span>' : ''}
                <span>${escapeHtml(getBaseName(name))}</span>
                <button class="close-tab" data-name="${escapeHtml(name)}"><i class="fa-solid fa-xmark"></i></button>`;
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.close-tab')) {
                    e.stopPropagation();
                    closeTab(name);
                } else openFile(name);
            });
            el.appendChild(tab);
        });
    }

    /* ====== CRUD ====== */
    function openFile(name) {
        if (!SDCode.state.files[name] && SDCode.state.files[name] !== '') return;
        SDCode.state.activeFile = name;
        if (!SDCode.state.openTabs.includes(name)) SDCode.state.openTabs.push(name);
        SDCode.editor.setValue(SDCode.state.files[name] || '');
        SDCode.editor.setLanguage(name);
        const sf = $('#status-file');
        if (sf) sf.textContent = getBaseName(name);
        render();
    }

    function closeTab(name) {
        SDCode.state.openTabs = SDCode.state.openTabs.filter(t => t !== name);
        if (SDCode.state.activeFile === name) {
            const last = SDCode.state.openTabs[SDCode.state.openTabs.length - 1];
            SDCode.state.activeFile = last || null;
            if (last) openFile(last);
            else {
                SDCode.editor.setValue('');
                const sf = $('#status-file');
                if (sf) sf.textContent = 'No file';
            }
        }
        renderTabs();
    }

    function deleteFile(name) {
        if (!confirm('Delete ' + name + '?')) return;
        delete SDCode.state.files[name];
        SDCode.state.openTabs = SDCode.state.openTabs.filter(t => t !== name);
        if (SDCode.state.activeFile === name) {
            SDCode.state.activeFile = SDCode.state.openTabs[0] || null;
            if (SDCode.state.activeFile) openFile(SDCode.state.activeFile);
            else {
                SDCode.editor.setValue('');
                const sf = $('#status-file');
                if (sf) sf.textContent = 'No file';
            }
        }
        SDCode.storage.saveSoon();
        render();
    }

    function createFile(name) {
        if (!name) return;
        if (SDCode.state.files[name] !== undefined) {
            alert('File already exists.');
            return;
        }
        SDCode.state.files[name] = '';
        SDCode.storage.saveSoon();
        openFile(name);
    }

    /* ====== Folder Upload ====== */
    async function handleFolderUpload(fileList) {
        let count = 0, skipped = 0;
        for (const file of fileList) {
            const path = file.webkitRelativePath || file._path || file.name;
            if (file.size > CONFIG.MAX_FILE_SIZE) { skipped++; continue; }
            try {
                SDCode.state.files[path] = await SDCode.utils.readFileAsText(file);
                count++;
            } catch (e) { skipped++; }
        }
        SDCode.storage.saveSoon();
        render();
        if (count > 0) {
            SDCode.ui.addMessage(`✓ ${count} files loaded.${skipped ? ' (' + skipped + ' skipped)' : ''}`, 'context');
            const first = Object.keys(SDCode.state.files)[0];
            if (first) openFile(first);
            await SDCode.project.analyze();
            SDCode.ui.addMessage(
                `🔬 Analyzed: ${SDCode.state.project.framework} • ${SDCode.state.project.language} • ${count} files`,
                'context'
            );
        } else {
            SDCode.ui.addMessage('⚠️ No files loaded. Check size limit (' + (CONFIG.MAX_FILE_SIZE/1024) + 'KB).', 'context');
        }
    }

    /* ====== Preview ====== */
    function runPreview(filename) {
        const content = SDCode.state.files[filename];
        if (!content) return;
        $$('.panel-tab').forEach(t => t.classList.remove('active'));
        const previewTab = document.querySelector('.panel-tab[data-tab="preview"]');
        if (previewTab) previewTab.classList.add('active');
        const termEl = $('#terminal-container');
        const outEl = $('#output-container');
        const prevEl = $('#preview-container');
        if (termEl) termEl.style.display = 'none';
        if (outEl) outEl.style.display = 'none';
        if (prevEl) prevEl.style.display = 'block';
        const blob = new Blob([content], { type: 'text/html' });
        const iframe = $('#preview-iframe');
        if (iframe) iframe.src = URL.createObjectURL(blob);
        const panel = $('#panel');
        if (panel) panel.classList.remove('collapsed');
        setTimeout(() => { SDCode.terminal.fit(); SDCode.editor.layout(); }, 100);
    }

    /* ====== Export / Import ====== */
    function exportProject() {
        const payload = {
            version: CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            files: SDCode.state.files,
            project: SDCode.state.project,
        };
        const name = 'sdcode-project-' + Date.now() + '.json';
        download(name, JSON.stringify(payload, null, 2));
    }

    async function importProject(file) {
        try {
            const text = await SDCode.utils.readFileAsText(file);
            const data = JSON.parse(text);
            if (!data.files || typeof data.files !== 'object') throw new Error('Invalid project file');
            if (!confirm(`Import ${Object.keys(data.files).length} files? Yeh current files ko replace kar dega.`)) return;
            SDCode.state.files = data.files;
            if (data.project) SDCode.state.project = data.project;
            SDCode.state.activeFile = null;
            SDCode.state.openTabs = [];
            SDCode.storage.saveSoon();
            render();
            const first = Object.keys(SDCode.state.files)[0];
            if (first) openFile(first);
            SDCode.ui.addMessage('✓ Project imported.', 'context');
        } catch (e) {
            alert('Import failed: ' + e.message);
        }
    }

    return {
        render, renderFileList, renderTabs,
        openFile, closeTab, deleteFile, createFile,
        handleFolderUpload, runPreview,
        exportProject, importProject,
    };
})();

/* ============================================================
   Project Analyzer
   ============================================================ */

SDCode.project = (function() {
    const { $, getExt, getBaseName } = SDCode.utils;

    function analyzeAsync() {
        return new Promise(resolve => setTimeout(() => resolve(analyzeSync()), 50));
    }

    function analyzeSync() {
        const progress = $('#analysis-progress');
        const ptext = $('#analysis-text');
        const show = (msg) => {
            if (progress) progress.classList.add('show');
            if (ptext) ptext.textContent = msg;
        };
        const hide = () => { if (progress) progress.classList.remove('show'); };

        const p = SDCode.state.project;
        const files = Object.keys(SDCode.state.files);
        if (!files.length) { hide(); return p; }

        show('Scanning files...');

        /* 1. Languages + extensions */
        const langCount = {}, extCount = {};
        files.forEach(f => {
            const ext = getExt(f);
            extCount[ext] = (extCount[ext] || 0) + 1;
            const map = {
                php:'PHP', py:'Python', js:'JavaScript', mjs:'JavaScript',
                ts:'TypeScript', tsx:'TypeScript', jsx:'JavaScript',
                java:'Java', rb:'Ruby', go:'Go', rs:'Rust', html:'HTML',
                css:'CSS', scss:'SCSS', cpp:'C++', c:'C', cs:'C#',
                swift:'Swift', kt:'Kotlin', dart:'Dart',
            };
            if (map[ext]) langCount[map[ext]] = (langCount[map[ext]] || 0) + 1;
        });
        p.language = Object.entries(langCount).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Unknown';
        p.extensions = extCount;

        /* 2. Framework */
        show('Detecting framework...');
        const allContent = Object.values(SDCode.state.files).join('\n').toLowerCase();
        p.framework = detectFramework(allContent, files);

        /* 3. Code style */
        show('Detecting code style...');
        p.style = detectStyle(files);

        /* 4. Dependencies + classes + functions */
        show('Extracting dependencies...');
        p.dependencies = {};
        p.entryPoints = [];
        p.classes = {};
        p.functions = {};
        for (const [path, content] of Object.entries(SDCode.state.files)) {
            if (!content || content.length < 5) continue;
            const ext = getExt(path);
            const deps = new Set(), classes = [], funcs = [];

            if (ext === 'php') {
                const re = /(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g;
                let m; while ((m = re.exec(content))) deps.add(m[1]);
                const cre = /(?:class|interface|trait)\s+(\w+)/g;
                while ((m = cre.exec(content))) classes.push(m[1]);
                const fre = /function\s+(\w+)\s*\(/g;
                while ((m = fre.exec(content))) funcs.push(m[1]);
                if (content.includes('new PDO') || content.includes('mysqli_connect') ||
                    content.includes('$this->db')) p.entryPoints.push(path);
            }
            if (['js','ts','jsx','tsx','mjs','cjs'].includes(ext)) {
                const re = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
                let m; while ((m = re.exec(content))) deps.add(m[1] || m[2]);
                const cre = /class\s+(\w+)/g;
                while ((m = cre.exec(content))) classes.push(m[1]);
                const fre = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\()/g;
                while ((m = fre.exec(content))) funcs.push(m[1] || m[2]);
            }
            if (ext === 'py') {
                const re = /(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/g;
                let m; while ((m = re.exec(content))) deps.add(m[1] || m[2]);
                const cre = /class\s+(\w+)/g;
                while ((m = cre.exec(content))) classes.push(m[1]);
                const fre = /def\s+(\w+)\s*\(/g;
                while ((m = fre.exec(content))) funcs.push(m[1]);
            }

            p.dependencies[path] = [...deps];
            if (classes.length) p.classes[path] = classes;
            if (funcs.length) p.functions[path] = funcs.slice(0, 30);
        }

        /* 5. Tree */
        show('Building tree...');
        const tree = new Set();
        for (const f of files) {
            const parts = f.split('/');
            for (let i = 0; i < parts.length; i++) tree.add(parts.slice(0, i + 1).join('/'));
        }
        p.structure = [...tree].sort();

        p.analyzed = true;
        SDCode.storage.saveSoon();
        updateUI();
        hide();
        return p;
    }

    function detectFramework(content, files) {
        const check = (str) => content.includes(str);
        if (check('illuminate\\') || files.some(f => f.includes('artisan'))) return 'Laravel';
        if (check('wp_') || files.some(f => f.includes('wp-content'))) return 'WordPress';
        if (check('symfony\\')) return 'Symfony';
        if (check('codeigniter')) return 'CodeIgniter';
        if (check('use yii')) return 'Yii2';
        if (check("require('express')") || check('require("express")')) return 'Express.js';
        if (check("from 'react'") || check('from "react"')) return 'React';
        if (check('vue.createapp') || check('vue.createApp') || check('new Vue')) return 'Vue.js';
        if (check("from 'next") || check('next.config')) return 'Next.js';
        if (check('from django')) return 'Django';
        if (check('from flask')) return 'Flask';
        if (check('from fastapi')) return 'FastAPI';
        if (check("from 'svelte")) return 'Svelte';
        if (check("from 'angular") || check('@angular/core')) return 'Angular';
        return 'Plain / Vanilla';
    }

    function detectStyle(files) {
        const style = { indent: '4 spaces', quotes: 'single', naming: 'camelCase' };
        const samples = files.filter(f => /\.(php|js|ts|py|java|rb|go)$/.test(f)).slice(0, 6);
        let tabs = 0, spaces2 = 0, spaces4 = 0, single = 0, double = 0;
        for (const f of samples) {
            const c = SDCode.state.files[f] || '';
            if (/^\t/m.test(c)) tabs++;
            else if (/^ {2}[^\s]/m.test(c)) spaces2++;
            else if (/^ {4}[^\s]/m.test(c)) spaces4++;
            single += (c.match(/'/g) || []).length;
            double += (c.match(/"/g) || []).length;
        }
        style.indent = tabs > Math.max(spaces2, spaces4) ? 'tabs' : (spaces2 > spaces4 ? '2 spaces' : '4 spaces');
        style.quotes = double > single ? 'double' : 'single';
        return style;
    }

    function findRelatedFiles(filename) {
        const related = new Set();
        const p = SDCode.state.project;
        const deps = p.dependencies[filename] || [];
        const allFiles = Object.keys(SDCode.state.files);

        for (const dep of deps) {
            const cleanDep = dep.replace(/^\.\//, '').replace(/\.(php|js|ts|py)$/, '');
            allFiles.forEach(f => {
                const cleanF = f.replace(/\.(php|js|ts|py)$/, '');
                if (f.endsWith(dep) || cleanF.endsWith(cleanDep) || cleanF === cleanDep) {
                    related.add(f);
                }
            });
        }

        const baseName = filename.split('/').pop().replace(/\.[^.]+$/, '');
        for (const [f, d] of Object.entries(p.dependencies)) {
            if (f === filename) continue;
            if (d.some(dep => dep.includes(baseName))) related.add(f);
        }

        const dir = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : '';
        if (dir) {
            allFiles.forEach(f => {
                if (f !== filename && f.startsWith(dir + '/') &&
                    !f.substring(dir.length + 1).includes('/')) related.add(f);
            });
        }

        return [...related].slice(0, 12);
    }

    function updateUI() {
        const el = $('#project-info');
        if (!el) return;
        const p = SDCode.state.project;
        if (!p.analyzed) {
            el.innerHTML = '<div>No project loaded</div><div style="margin-top:4px;font-size:9px;">📁 Folder drop karo ya icon tap karo</div>';
            return;
        }
        el.innerHTML = `
            <div style="color:#4ec9b0;font-weight:600;">${p.framework}</div>
            <div style="margin-top:2px;">${p.language} • ${Object.keys(SDCode.state.files).length} files</div>
            <div style="margin-top:4px;">
                <span class="tag">${p.style.indent}</span>
                <span class="tag">${p.style.quotes}</span>
                ${p.entryPoints.length ? `<span class="tag warn">${p.entryPoints.length} entry</span>` : ''}
            </div>`;
    }

    function getAnalysisReport() {
        const p = SDCode.state.project;
        if (!p.analyzed) return 'Project not analyzed yet.';
        return `🔬 PROJECT ANALYSIS
════════════════════════════════════

Framework:     ${p.framework}
Language:      ${p.language}
Total Files:   ${Object.keys(SDCode.state.files).length}
Entry Points:  ${p.entryPoints.length}

CODE STYLE
────────────────────────────────
Indentation:   ${p.style.indent}
Quotes:        ${p.style.quotes}

EXTENSIONS
────────────────────────────────
${Object.entries(p.extensions || {}).map(([k,v]) => `  .${k}: ${v}`).join('\n')}

ENTRY POINTS
────────────────────────────────
${p.entryPoints.slice(0, 10).join('\n') || '  (none)'}

STRUCTURE (${p.structure.length} paths)
────────────────────────────────
${p.structure.slice(0, 50).join('\n')}

CLASSES
────────────────────────────────
${Object.entries(p.classes || {}).slice(0, 15).map(([f,cs]) => `${f}: ${cs.slice(0,5).join(', ')}`).join('\n') || '  (none)'}

FUNCTIONS
────────────────────────────────
${Object.entries(p.functions || {}).slice(0, 15).map(([f,fs]) => `${f}: ${fs.slice(0,5).join(', ')}`).join('\n') || '  (none)'}`;
    }

    return { analyze: analyzeAsync, analyzeSync, findRelatedFiles, updateUI, getAnalysisReport };
})();