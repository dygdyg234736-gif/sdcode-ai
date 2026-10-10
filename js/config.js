/* ============================================================
   SD CODE AI – Configuration & Constants
   ============================================================ */

window.SDCode = window.SDCode || {};

SDCode.CONFIG = {
    VERSION: '4.0.0',
    APP_NAME: 'SD CODE AI',
    STORAGE_KEY: 'sdcode_state_v4',
    DEFAULT_NVIDIA_KEY: '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',
    DEFAULT_MODEL: 'auto',
    MAX_FILE_SIZE: 800 * 1024,
    MAX_CONTEXT_CHARS: 30000,
    MAX_FILES_PER_CONTEXT: 8,
    TERMINAL_SCROLLBACK: 1000,
};

/* NVIDIA NIM active models – sorted by capability */
SDCode.NVIDIA_MODELS = [
    { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B', tier: 'S+', score: 68, type: 'coding', tag: 'Best Coding' },
    { id: 'deepseek-ai/deepseek-coder-6.7b-instruct', name: 'DeepSeek Coder 6.7B', tier: 'A', score: 50, type: 'coding' },
    { id: 'meta/codellama-70b', name: 'CodeLlama 70B', tier: 'A+', score: 55, type: 'coding' },
    { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tier: 'S', score: 65, type: 'general', tag: 'Balanced' },
    { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', tier: 'S+', score: 72, type: 'general' },
    { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', tier: 'A+', score: 58, type: 'general' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'Nemotron Super 49B', tier: 'S', score: 62, type: 'reasoning' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', tier: 'A+', score: 60, type: 'general' },
    { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1', tier: 'S+', score: 70, type: 'reasoning', tag: 'Best Reasoning' },
    { id: 'deepseek-ai/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', tier: 'A+', score: 60, type: 'reasoning' },
    { id: 'qwen/qwen2.5-72b-instruct', name: 'Qwen2.5 72B', tier: 'S', score: 66, type: 'general' },
    { id: 'qwen/qwq-32b-preview', name: 'QwQ 32B Preview', tier: 'S', score: 65, type: 'reasoning' },
    { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B', tier: 'A', score: 55, type: 'general' },
    { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', tier: 'A+', score: 62, type: 'general' },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', tier: 'A', score: 50, type: 'general' },
    { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', tier: 'B+', score: 42, type: 'general' },
    { id: 'ibm-granite/granite-3.0-8b-instruct', name: 'Granite 3.0 8B', tier: 'B', score: 40, type: 'general' },
];

SDCode.GEMINI_MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Free)', tier: 'A', score: 55, type: 'general' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B (Free)', tier: 'B', score: 45, type: 'general' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tier: 'S', score: 65, type: 'general' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', tier: 'S', score: 68, type: 'general' },
];

/* Language map for Monaco */
SDCode.LANG_MAP = {
    html:'html', htm:'html', css:'css', scss:'scss', less:'less',
    js:'javascript', mjs:'javascript', cjs:'javascript', jsx:'javascript',
    ts:'typescript', tsx:'typescript',
    json:'json', md:'markdown', markdown:'markdown',
    py:'python', java:'java', c:'c', h:'c', cpp:'cpp', cc:'cpp',
    cs:'csharp', php:'php', phtml:'php',
    xml:'xml', yaml:'yaml', yml:'yaml', toml:'ini', ini:'ini', env:'ini',
    sh:'shell', bash:'shell', zsh:'shell',
    sql:'sql', rb:'ruby', go:'go', rs:'rust', swift:'swift',
    kt:'kotlin', dart:'dart', lua:'lua', r:'r', vue:'html',
    svelte:'html', astro:'html',
};

SDCode.FILE_ICONS = {
    html:'fa-html5', htm:'fa-html5', css:'fa-css3-alt', scss:'fa-css3-alt',
    js:'fa-js', mjs:'fa-js', cjs:'fa-js', jsx:'fa-js', ts:'fa-js', tsx:'fa-js',
    php:'fa-file-php', phtml:'fa-file-php',
    py:'fa-file-code', rb:'fa-file-code', go:'fa-file-code', rs:'fa-file-code',
    java:'fa-file-code', c:'fa-file-code', cpp:'fa-file-code', cs:'fa-file-code',
    json:'fa-file-code', xml:'fa-file-code', yaml:'fa-file-code', yml:'fa-file-code',
    md:'fa-file-lines', txt:'fa-file-lines',
    sql:'fa-database', sh:'fa-terminal', bash:'fa-terminal',
};