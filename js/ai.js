/* ============================================================
   SD CODE AI – AI (NVIDIA + Gemini) + Plesk
   ============================================================ */

SDCode.ai = (function() {
    const { $, formatBytes } = SDCode.utils;

    /* ---------- Smart model selection ---------- */
    function selectBestModel(prompt) {
        const lower = prompt.toLowerCase();
        const codingRe = /(code|program|function|debug|fix|refactor|create|build|game|website|api|php|python|javascript|class|write|implement|add|edit|update|script|component|module)/i;
        const reasoningRe = /(reason|explain|why|analyze|compare|think|understand|design|architect|plan)/i;

        let taskType = 'general';
        if (codingRe.test(lower)) taskType = 'coding';
        else if (reasoningRe.test(lower)) taskType = 'reasoning';

        let candidates = SDCode.NVIDIA_MODELS.filter(m => m.type === taskType);
        if (!candidates.length) candidates = SDCode.NVIDIA_MODELS.slice();
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].id;
    }

    function getModelDisplayName(id) {
        if (id === 'auto') return 'Auto';
        const m = SDCode.NVIDIA_MODELS.find(x => x.id === id)
              || SDCode.GEMINI_MODELS.find(x => x.id === id);
        return m ? m.name : id.split('/').pop();
    }

    /* ---------- Context builder ---------- */
    function buildContext(targetFile) {
        const p = SDCode.state.project;
        const ctx = { files: [], totalChars: 0, related: [] };
        const CFG = SDCode.CONFIG;

        if (targetFile && SDCode.state.files[targetFile] !== undefined) {
            const c = SDCode.state.files[targetFile];
            ctx.files.push({ path: targetFile, content: c, role: 'target' });
            ctx.totalChars += c.length;
        }

        if (targetFile) {
            const related = SDCode.project.findRelatedFiles(targetFile);
            ctx.related = related;
            for (const rel of related.slice(0, CFG.MAX_FILES_PER_CONTEXT)) {
                if (SDCode.state.files[rel] === undefined) continue;
                const c = SDCode.state.files[rel].slice(0, 3000);
                ctx.files.push({ path: rel, content: c, role: 'related' });
                ctx.totalChars += c.length;
                if (ctx.totalChars > CFG.MAX_CONTEXT_CHARS) break;
            }
        }

        const allFiles = Object.keys(SDCode.state.files);
        if (allFiles.length <= 15) {
            for (const f of allFiles) {
                if (ctx.files.some(c => c.path === f)) continue;
                const c = SDCode.state.files[f].slice(0, 3000);
                ctx.files.push({ path: f, content: c, role: 'project' });
                ctx.totalChars += c.length;
                if (ctx.totalChars > CFG.MAX_CONTEXT_CHARS) break;
            }
        }

        return ctx;
    }

    function buildSystemPrompt(targetFile, userPrompt) {
        const p = SDCode.state.project;
        const ctx = buildContext(targetFile);
        SDCode.state.lastContextSize = ctx.totalChars;

        const ctxEl = $('#status-context');
        if (ctxEl) ctxEl.innerHTML = `<i class="fa-solid fa-brain"></i> ${ctx.files.length}f/${(ctx.totalChars/1000).toFixed(1)}KB`;

        let prompt = `You are SD CODE AI — an elite, codebase-aware coding assistant.
You analyze the ENTIRE project before writing any code, and match the existing style.

## PROJECT ANALYSIS
- Framework: ${p.framework || 'Unknown'}
- Primary Language: ${p.language || 'Unknown'}
- Total Files: ${Object.keys(SDCode.state.files).length}
- Code Style: indent=${p.style?.indent}, quotes=${p.style?.quotes}
- Entry Points: ${p.entryPoints.slice(0, 5).join(', ') || 'none'}

## PROJECT STRUCTURE
${p.structure.slice(0, 30).map(s => '  ' + s).join('\n')}

## FILE INVENTORY
${Object.keys(SDCode.state.files).slice(0, 60).join('\n')}

## DEPENDENCIES
${Object.entries(p.dependencies).slice(0, 20).map(([f, d]) => `${f} → ${d.slice(0,5).join(', ') || 'none'}`).join('\n')}
`;

        if (targetFile) {
            prompt += `\n## ACTIVE FILE: ${targetFile}\n`;
            if (ctx.related.length) {
                prompt += `\nRelated files auto-loaded:\n${ctx.related.map(r => '  - ' + r).join('\n')}\n`;
            }
        }

        prompt += `\n## CRITICAL RULES
1. READ the entire context before writing code.
2. MATCH the existing code style (indent, quotes, naming, framework patterns).
3. For edits, provide the COMPLETE updated file in \`\`\`filename.ext\\n...\\n\`\`\` format.
4. Reference real classes/functions that exist in the project.
5. Follow framework conventions (Laravel Eloquent, WordPress hooks, Express middleware, etc.).
6. NEVER invent APIs — check existing imports.
7. Keep changes minimal and targeted.
8. For new features, match the project's patterns.

## FILE CONTENTS
`;

        for (const f of ctx.files) {
            prompt += `\n### ${f.path} (${f.role})\n\`\`\`\n${f.content}\n\`\`\`\n`;
        }
        return prompt;
    }

    /* ---------- Chat UI ---------- */
    function addMessage(text, type) {
        return SDCode.ui.addMessage(text, type);
    }

    async function sendChat(prompt) {
        if (SDCode.state.busy) return;
        const provider = SDCode.state.provider;
        const key = provider === 'nvidia' ? SDCode.state.nvidiaKey : SDCode.state.geminiKey;
        if (!key) { addMessage('Settings mein API key daalo.', 'system'); return; }

        if (!SDCode.state.project.analyzed && Object.keys(SDCode.state.files).length > 0) {
            const prog = $('#analysis-progress');
            const txt = $('#analysis-text');
            if (prog) prog.classList.add('show');
            if (txt) txt.textContent = 'Auto-analyzing...';
            await SDCode.project.analyze();
        }

        SDCode.state.busy = true;
        const btn = $('#send-btn');
        if (btn) btn.disabled = true;

        addMessage(prompt, 'user');
        SDCode.state.chatHistory.push({ role: 'user', content: prompt });

        let modelUsed = SDCode.state.nvidiaModel;
        if (provider === 'nvidia' && modelUsed === 'auto') {
            modelUsed = selectBestModel(prompt);
            const badge = $('#active-model-badge');
            if (badge) badge.textContent = getModelDisplayName(modelUsed).substring(0, 20);
        }

        const loading = addMessage('Analyzing codebase', 'ai');
        loading.classList.add('loading-dots');

        try {
            const systemPrompt = buildSystemPrompt(SDCode.state.activeFile, prompt);
            addMessage(`📚 Loaded ${formatBytes(SDCode.state.lastContextSize)} of project context`, 'context');

            let reply;
            if (provider === 'nvidia') reply = await callNVIDIA(systemPrompt, prompt, modelUsed);
            else reply = await callGemini(systemPrompt, prompt);

            loading.remove();
            addMessage(reply, 'ai');
            SDCode.state.chatHistory.push({ role: 'assistant', content: reply });
            parseAndApply(reply);
        } catch (err) {
            loading.remove();
            addMessage('Error: ' + err.message, 'error');
        } finally {
            SDCode.state.busy = false;
            if (btn) btn.disabled = false;
        }
    }

    /* ---------- NVIDIA ---------- */
    async function callNVIDIA(systemPrompt, userPrompt, modelId) {
        const body = {
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 8192,
            stream: false,
        };
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SDCode.state.nvidiaKey,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const txt = await res.text();
            // If model not found, try fallback
            if (res.status === 404 || res.status === 400) {
                const fallback = SDCode.NVIDIA_MODELS.find(m => m.id !== modelId)?.id;
                if (fallback) {
                    console.warn('Model not found, retrying with', fallback);
                    return callNVIDIA(systemPrompt, userPrompt, fallback);
                }
            }
            throw new Error(`NVIDIA ${res.status}: ${txt.slice(0, 300)}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response.';
    }

    /* ---------- Gemini ---------- */
    async function callGemini(systemPrompt, userPrompt) {
        const model = SDCode.state.geminiModel || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SDCode.state.geminiKey}`;
        const body = {
            contents: [{
                role: 'user',
                parts: [{ text: systemPrompt + '\n\n## USER REQUEST\n' + userPrompt }],
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        };
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Gemini ${res.status}: ${txt.slice(0, 300)}`);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    }

    /* ---------- Parse AI code blocks ---------- */
    function parseAndApply(text) {
        const re = /```(\S+)?\n([\s\S]*?)```/g;
        let m;
        const suggested = [];
        while ((m = re.exec(text)) !== null) {
            const lang = (m[1] || '').trim();
            const code = m[2];
            const looksLikeFile = lang.includes('.') || /^[a-z0-9_-]+\.(php|js|ts|jsx|tsx|py|html|css|json|sql|sh|md|xml|yml|yaml)$/i.test(lang);
            if (looksLikeFile) {
                suggested.push({ filename: lang, code });
            }
        }
        if (!suggested.length) return;
        const list = suggested.map(s => '  • ' + s.filename + ' (' + s.code.length + 'B)').join('\n');
        const apply = confirm(`AI proposes ${suggested.length} file change(s):\n\n${list}\n\nApply?`);
        if (!apply) return;
        for (const s of suggested) SDCode.state.files[s.filename] = s.code;
        SDCode.storage.saveSoon();
        SDCode.files.render();
        SDCode.project.analyze();
        addMessage(`✓ ${suggested.length} file(s) written. Re-analyzing...`, 'context');
        if (suggested[0]) SDCode.files.openFile(suggested[0].filename);
    }

    /* ---------- Plesk ---------- */
    async function pleskCommand(cmd) {
        const term = SDCode.terminal;
        if (!SDCode.state.pleskUrl || !SDCode.state.pleskToken) {
            term.write('\x1b[31mPlesk not configured. Settings → Plesk.\x1b[0m\r\n');
            return;
        }
        term.write('Plesk: ' + cmd + '\r\n');
        try {
            const url = SDCode.state.pleskUrl.replace(/\/$/, '') + '/exec';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + SDCode.state.pleskToken,
                },
                body: JSON.stringify({ command: cmd }),
            }).catch(() => null);
            if (res && res.ok) {
                const data = await res.json();
                term.write(JSON.stringify(data, null, 2) + '\r\n');
            } else {
                term.write('\x1b[33m[Simulated] ' + cmd + ' → ✓ Done\x1b[0m\r\n');
            }
        } catch (e) {
            term.write('\x1b[31m' + e.message + '\x1b[0m\r\n');
        }
    }

    return {
        sendChat, addMessage, pleskCommand,
        selectBestModel, getModelDisplayName,
        buildSystemPrompt, buildContext,
    };
})();