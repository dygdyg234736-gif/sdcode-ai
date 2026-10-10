/* ============================================================
   SD CODE AI – Terminal (xterm.js)
   ============================================================ */

SDCode.terminal = (function() {
    const { $, escapeRegex } = SDCode.utils;
    const CONFIG = SDCode.CONFIG;

    let term = null;
    let fitAddon = null;
    let initialized = false;
    let currentLine = '';

    function waitForLib(maxWait = 6000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                if (typeof window.Terminal !== 'undefined') return resolve();
                if (Date.now() - start > maxWait) return reject(new Error('xterm.js load timeout'));
                setTimeout(check, 100);
            };
            check();
        });
    }

    async function init() {
        if (initialized) return;
        try {
            await waitForLib();
        } catch (e) {
            console.error('Terminal lib missing:', e);
            const c = $('#terminal-container');
            if (c) c.innerHTML = '<div style="padding:20px;color:#f44747;">Terminal load nahi hua. Internet check karo.</div>';
            return;
        }

        initialized = true;
        try {
            term = new window.Terminal({
                cursorBlink: true,
                fontSize: window.innerWidth < 600 ? 11 : 12,
                fontFamily: "'SF Mono','Cascadia Code','Fira Code',Consolas,monospace",
                theme: {
                    background:'#1e1e1e', foreground:'#cccccc', cursor:'#aeafad',
                    selectionBackground:'#264f78',
                    black:'#1e1e1e', red:'#f44747', green:'#4ec9b0',
                    yellow:'#dcdcaa', blue:'#569cd6', magenta:'#c586c0',
                    cyan:'#4ec9b0', white:'#d4d4d4',
                },
                cols: 80, rows: 20, convertEol: true,
                scrollback: CONFIG.TERMINAL_SCROLLBACK,
            });

            // Fit addon (multiple possible global names)
            const FitClass = (window.FitAddon && window.FitAddon.FitAddon) ||
                              (window.FitAddon && typeof window.FitAddon === 'function' ? window.FitAddon : null);
            if (FitClass) {
                fitAddon = new FitClass();
                term.loadAddon(fitAddon);
            }

            term.open($('#terminal-container'));
            setTimeout(fit, 100);

            term.write('\x1b[1;32mSD CODE AI Terminal v' + CONFIG.VERSION + '\x1b[0m\r\n');
            term.write('Type \x1b[1;33mhelp\x1b[0m for commands.\r\n');
            prompt();

            term.onData(handleInput);
            window.addEventListener('resize', () => { if (fitAddon) try { fitAddon.fit(); } catch(e){} });
        } catch (e) {
            console.error('Terminal init failed:', e);
        }
    }

    function prompt() {
        if (term) term.write('\x1b[1;34m$\x1b[0m ');
    }

    function handleInput(data) {
        const code = data.charCodeAt(0);
        if (code === 13) {
            term.write('\r\n');
            const line = currentLine.trim();
            currentLine = '';
            execute(line).finally(() => prompt());
        } else if (code === 127) {
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
                term.write('\b \b');
            }
        } else if (code === 3) { // Ctrl+C
            term.write('^C\r\n');
            currentLine = '';
            prompt();
        } else if (code >= 32 && code < 127) {
            currentLine += data;
            term.write(data);
        }
    }

    async function execute(cmd) {
        if (!cmd || !term) return;
        const parts = cmd.split(/\s+/);
        const c = parts[0].toLowerCase();
        const args = parts.slice(1);

        switch (c) {
            case 'help':
                term.write('Commands:\r\n');
                term.write('  help              Show this help\r\n');
                term.write('  ls                List files\r\n');
                term.write('  cat <file>        Show file content\r\n');
                term.write('  tree              Folder structure\r\n');
                term.write('  echo <text>       Print text\r\n');
                term.write('  clear             Clear terminal\r\n');
                term.write('  date              Current date/time\r\n');
                term.write('  run <file>        Preview HTML file\r\n');
                term.write('  open <file>       Open in editor\r\n');
                term.write('  rm <file>         Delete file\r\n');
                term.write('  new <file>        Create new file\r\n');
                term.write('  ai <prompt>       Ask AI\r\n');
                term.write('  models            List AI models\r\n');
                term.write('  analyze           Analyze project\r\n');
                term.write('  related <file>    Related files\r\n');
                term.write('  deps              Show dependencies\r\n');
                term.write('  search <query>    Search in files\r\n');
                term.write('  stats             Project statistics\r\n');
                term.write('  plesk <cmd>       Plesk command\r\n');
                term.write('  export            Download project JSON\r\n');
                break;
            case 'ls':
                Object.keys(SDCode.state.files).sort().forEach(f => term.write('  📄 ' + f + '\r\n'));
                if (!Object.keys(SDCode.state.files).length) term.write('  (empty)\r\n');
                break;
            case 'cat':
                if (args[0] && SDCode.state.files[args[0]] !== undefined) {
                    term.write(SDCode.state.files[args[0]].replace(/\n/g, '\r\n') + '\r\n');
                } else term.write('\x1b[31mFile not found.\x1b[0m\r\n');
                break;
            case 'tree':
                SDCode.state.project.structure.slice(0, 60).forEach(l => term.write('  ' + l + '\r\n'));
                break;
            case 'echo': term.write(args.join(' ') + '\r\n'); break;
            case 'clear': term.clear(); break;
            case 'date': term.write(new Date().toString() + '\r\n'); break;
            case 'run':
                if (args[0]) SDCode.files.runPreview(args[0]);
                else term.write('Usage: run <file.html>\r\n');
                break;
            case 'open':
                if (args[0] && SDCode.state.files[args[0]] !== undefined) SDCode.files.openFile(args[0]);
                else term.write('File not found.\r\n');
                break;
            case 'rm':
                if (args[0] && SDCode.state.files[args[0]] !== undefined) {
                    delete SDCode.state.files[args[0]];
                    SDCode.files.render();
                    term.write('✓ Deleted ' + args[0] + '\r\n');
                } else term.write('File not found.\r\n');
                break;
            case 'new':
                if (args[0]) { SDCode.files.createFile(args[0]); term.write('✓ Created ' + args[0] + '\r\n'); }
                else term.write('Usage: new <file>\r\n');
                break;
            case 'ai':
                if (args.length) { term.write('Asking AI...\r\n'); SDCode.ai.sendChat(args.join(' ')); }
                else term.write('Usage: ai <prompt>\r\n');
                break;
            case 'models':
                SDCode.NVIDIA_MODELS.forEach(m =>
                    term.write(`  ${m.name} [${m.tier}] score:${m.score} (${m.type})\r\n`));
                break;
            case 'analyze':
                term.write('Analyzing...\r\n');
                await SDCode.project.analyze();
                term.write(`✓ ${SDCode.state.project.framework} | ${SDCode.state.project.language}\r\n`);
                break;
            case 'related':
                if (args[0]) SDCode.project.findRelatedFiles(args[0]).forEach(f => term.write('  → ' + f + '\r\n'));
                else term.write('Usage: related <file>\r\n');
                break;
            case 'deps':
                Object.entries(SDCode.state.project.dependencies).slice(0, 30).forEach(([k, v]) =>
                    term.write(`  ${k}: ${v.slice(0, 5).join(', ') || '(none)'}\r\n`));
                break;
            case 'search':
                if (args.length) {
                    const q = args.join(' ');
                    const re = new RegExp(escapeRegex(q), 'gi');
                    let count = 0;
                    for (const [f, c] of Object.entries(SDCode.state.files)) {
                        c.split('\n').forEach((line, i) => {
                            if (re.test(line) && count < 30) {
                                term.write(`  ${f}:${i+1}: ${line.trim().slice(0, 80)}\r\n`);
                                count++;
                            }
                        });
                    }
                    term.write(`Found ${count} matches.\r\n`);
                } else term.write('Usage: search <query>\r\n');
                break;
            case 'stats': {
                const files = Object.keys(SDCode.state.files).length;
                const size = Object.values(SDCode.state.files).join('').length;
                term.write(`Files: ${files}\r\nSize: ${SDCode.utils.formatBytes(size)}\r\n`);
                term.write(`Framework: ${SDCode.state.project.framework || 'Unknown'}\r\n`);
                term.write(`Language: ${SDCode.state.project.language || 'Unknown'}\r\n`);
                break;
            }
            case 'plesk':
                if (args.length) await SDCode.ai.pleskCommand(args.join(' '));
                else term.write('Usage: plesk <command>\r\n');
                break;
            case 'export':
                SDCode.files.exportProject();
                term.write('✓ Export started.\r\n');
                break;
            default:
                term.write(`\x1b[31mCommand not found: ${c}\x1b[0m\r\n`);
        }
    }

    function fit() {
        if (fitAddon) try { fitAddon.fit(); } catch (e) {}
    }

    function write(text) { if (term) term.write(text); }
    function clear() { if (term) term.clear(); }

    return { init, write, clear, fit, execute };
})();