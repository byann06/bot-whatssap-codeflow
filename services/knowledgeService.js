const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_CONTEXT_CHARS = 3500;
const KEYWORD_ALIASES = {
    command: ['commands', 'menu', 'perintah', 'bot'],
    commands: ['command', 'menu', 'perintah', 'bot'],
    perintah: ['command', 'commands', 'menu', 'bot'],
    menu: ['command', 'commands', 'perintah', 'bot'],
    fitur: ['command', 'commands', 'menu'],
    absen: ['attendance', 'hadir', 'izin'],
    absensi: ['attendance', 'hadir', 'izin'],
    dokumentasi: ['drive', 'folder', 'upload'],
    ai: ['yanverse', '.ai'],
};
const STOP_WORDS = new Set([
    'yang', 'dan', 'atau', 'untuk', 'dengan', 'dari', 'jadi', 'bisa', 'apa', 'aja', 'itu', 'ini',
    'cara', 'gimana', 'bagaimana', 'tolong', 'minta', 'aku', 'gua', 'gw', 'lu', 'kamu', 'yanverse',
    'di', 'ke', 'kan', 'kah', 'nya', 'dong', 'nih', 'ya', 'the', 'a', 'an', 'of', 'to', 'in', 'is',
]);

function createKnowledgeService(options = {}) {
    const rootDir = options.rootDir;
    const maxContextChars = Number(options.maxContextChars || DEFAULT_MAX_CONTEXT_CHARS);
    const maxSections = Number(options.maxSections || 5);

    return {
        getRelevantContext(question) {
            if (!rootDir || !fs.existsSync(rootDir)) {
                logNoRelevantKnowledge();
                return '';
            }

            const sections = loadKnowledgeSections(rootDir);
            if (!sections.length) {
                logNoRelevantKnowledge();
                return '';
            }

            const keywords = extractKeywords(question);
            if (!keywords.length) {
                logNoRelevantKnowledge();
                return '';
            }

            if (isCommandOverviewQuery(question, keywords)) {
                const overview = buildCommandOverview(rootDir);
                if (overview) {
                    logKnowledgeSections(getCommandOverviewSources(rootDir));
                    return overview.slice(0, maxContextChars);
                }
            }

            const scored = sections
                .map((section) => ({ ...section, score: scoreSection(section, keywords) }))
                .filter((section) => section.score > 0);
            const commandSections = isCommandQuery(keywords)
                ? scored.filter((section) => String(section.source || '').startsWith('commands/'))
                : [];
            const ranked = (commandSections.length ? commandSections : scored)
                .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
                .slice(0, maxSections);

            if (!ranked.length) {
                logNoRelevantKnowledge();
                return '';
            }

            logKnowledgeSections(ranked);

            return buildContext(ranked, maxContextChars);
        },

        loadKnowledgeSections() {
            return rootDir && fs.existsSync(rootDir) ? loadKnowledgeSections(rootDir) : [];
        },
    };
}

function loadKnowledgeSections(rootDir) {
    return listMarkdownFiles(rootDir)
        .flatMap((filePath) => splitMarkdownFile(rootDir, filePath));
}

function listMarkdownFiles(rootDir) {
    const files = [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listMarkdownFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files.sort();
}

function splitMarkdownFile(rootDir, filePath) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (!content) return [];

    const lines = content.split(/\r?\n/);
    const sections = [];
    let currentTitle = path.basename(filePath, '.md');
    let buffer = [];

    function flush() {
        const text = buffer.join('\n').trim();
        if (!text) return;
        sections.push({
            source: relativePath,
            title: currentTitle,
            text,
            searchableText: `${relativePath} ${currentTitle} ${text}`.toLowerCase(),
        });
        buffer = [];
    }

    for (const line of lines) {
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            flush();
            currentTitle = heading[2].trim();
            buffer.push(line);
            continue;
        }

        buffer.push(line);
    }

    flush();
    return sections;
}

function extractKeywords(question) {
    const normalized = String(question || '')
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

    const expanded = [...normalized];
    for (const keyword of normalized) {
        expanded.push(...(KEYWORD_ALIASES[keyword] || []));
    }

    return Array.from(new Set(expanded));
}

function scoreSection(section, keywords) {
    let score = 0;
    const title = String(section.title || '').toLowerCase();
    const source = String(section.source || '').toLowerCase();
    const text = section.searchableText || '';

    for (const keyword of keywords) {
        const escaped = escapeRegExp(keyword);
        const matches = text.match(new RegExp(escaped, 'g')) || [];
        if (!matches.length) continue;

        score += matches.length;
        if (title.includes(keyword)) score += 6;
        if (source.includes(keyword)) score += 4;
    }

    return score;
}

function isCommandOverviewQuery(question, keywords) {
    const normalized = String(question || '').toLowerCase();
    return isCommandQuery(keywords) && (
        normalized.includes('apa aja') ||
        normalized.includes('semua') ||
        normalized.includes('daftar') ||
        normalized.includes('list') ||
        normalized.includes('fitur') ||
        normalized.includes('command bot') ||
        normalized.includes('perintah bot')
    );
}

function getCommandOverviewSources(rootDir) {
    const commandsDir = path.join(rootDir, 'commands');
    if (!fs.existsSync(commandsDir)) return [];

    return ['general.md', 'attendance.md', 'drive.md', 'ai.md']
        .filter((file) => fs.existsSync(path.join(commandsDir, file)))
        .map((file) => ({ source: `commands/${file}`, title: 'Command list' }));
}

function buildCommandOverview(rootDir) {
    const commandsDir = path.join(rootDir, 'commands');
    if (!fs.existsSync(commandsDir)) return '';

    const files = ['general.md', 'attendance.md', 'drive.md', 'ai.md'];
    const blocks = [];

    for (const file of files) {
        const filePath = path.join(commandsDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const commands = Array.from(content.matchAll(/^##\s+(.+)$/gm))
            .map((match) => `- ${match[1].trim()}`);

        if (commands.length) {
            blocks.push(`Source: commands/${file}\nCommand list:\n${commands.join('\n')}`);
        }
    }

    return blocks.length ? ['Knowledge lokal yang relevan:', ...blocks].join('\n\n---\n\n') : '';
}

function isCommandQuery(keywords) {
    return keywords.some((keyword) => ['command', 'commands', 'perintah', 'menu', 'fitur'].includes(keyword));
}

function searchKnowledgeSections(rootDir, keyword, options = {}) {
    const limit = Number(options.limit || 5);
    if (!rootDir || !fs.existsSync(rootDir)) return [];

    const query = String(keyword || '').trim();
    if (!query) return [];

    const sections = loadKnowledgeSections(rootDir);
    const keywords = extractSearchKeywords(query);
    if (!sections.length || !keywords.length) return [];

    return sections
        .map((section) => ({
            ...section,
            score: scoreSection(section, keywords),
            snippet: createSnippet(section.text, keywords, 120),
        }))
        .filter((section) => section.score > 0)
        .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
        .slice(0, limit)
        .map((section) => ({
            source: section.source,
            title: section.title,
            snippet: section.snippet,
            score: section.score,
        }));
}

function extractSearchKeywords(keyword) {
    return String(keyword || '')
        .toLowerCase()
        .replace(/[^a-z0-9@._-]+/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2);
}

function createSnippet(text, keywords, maxLength = 120) {
    const cleanText = String(text || '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleanText) return '';

    const lowerText = cleanText.toLowerCase();
    const firstIndex = keywords
        .map((keyword) => lowerText.indexOf(keyword))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, firstIndex - 30);
    let snippet = cleanText.slice(start, start + maxLength).trim();

    if (start > 0) snippet = `...${snippet}`;
    if (start + maxLength < cleanText.length) snippet += '...';
    return snippet;
}
function buildContext(sections, maxChars) {
    const blocks = [];
    let used = 0;

    for (const section of sections) {
        const block = [`Source: ${section.source}#${section.title}`, section.text].join('\n');
        if (used + block.length > maxChars) {
            const remaining = maxChars - used;
            if (remaining > 300) {
                blocks.push(block.slice(0, remaining).trim() + '\n...');
            }
            break;
        }

        blocks.push(block);
        used += block.length + 2;
    }

    if (!blocks.length) return '';
    return ['Knowledge lokal yang relevan:', ...blocks].join('\n\n---\n\n');
}

function formatKnowledgeSectionRef(section) {
    const source = String(section?.source || '').trim();
    const title = String(section?.title || '').trim();
    return title ? `${source}#${title}` : source;
}

function logKnowledgeSections(sections) {
    const refs = (sections || [])
        .map(formatKnowledgeSectionRef)
        .filter(Boolean);

    if (!refs.length) {
        logNoRelevantKnowledge();
        return;
    }

    console.log(`[KNOWLEDGE] sections=${refs.join(', ')}`);
}

function logNoRelevantKnowledge() {
    console.log('[KNOWLEDGE] no relevant context');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    createKnowledgeService,
    loadKnowledgeSections,
    extractKeywords,
    scoreSection,
    searchKnowledgeSections,
    createSnippet,
    isCommandQuery,
    isCommandOverviewQuery,
    buildCommandOverview,
    getCommandOverviewSources,
    logKnowledgeSections,
    logNoRelevantKnowledge,
};
