const fs = require('fs');
const path = require('path');

function getKnowledgeStats(options = {}) {
    const rootDir = options.rootDir || path.join(__dirname, '..', 'knowledge');
    const markdownFiles = fs.existsSync(rootDir) ? listMarkdownFiles(rootDir) : [];
    const commandFiles = markdownFiles.filter((filePath) => isInsideCommandsDir(rootDir, filePath));
    const generalFiles = markdownFiles.filter((filePath) => !isInsideCommandsDir(rootDir, filePath));
    const sectionCount = markdownFiles.reduce((total, filePath) => total + countMarkdownHeadings(filePath), 0);
    const categories = getCategories(rootDir, markdownFiles);

    return {
        rootDir,
        markdownFiles: markdownFiles.length,
        sections: sectionCount,
        commandFiles: commandFiles.length,
        generalKnowledgeFiles: generalFiles.length,
        categories,
        status: getStatus({ markdownFiles, sectionCount, commandFiles }),
        text: formatKnowledgeStats({
            markdownFiles: markdownFiles.length,
            sections: sectionCount,
            commandFiles: commandFiles.length,
            generalKnowledgeFiles: generalFiles.length,
            categories,
            status: getStatus({ markdownFiles, sectionCount, commandFiles }),
        }),
    };
}

function listMarkdownFiles(rootDir) {
    const result = [];
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            result.push(...listMarkdownFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            result.push(fullPath);
        }
    }

    return result.sort();
}

function isInsideCommandsDir(rootDir, filePath) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    return relativePath.startsWith('commands/');
}

function countMarkdownHeadings(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/^#{1,6}\s+.+$/gm);
    return matches ? matches.length : 0;
}

function getCategories(rootDir, markdownFiles) {
    const categories = new Set();

    for (const filePath of markdownFiles) {
        const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        if (parts.length > 1) {
            categories.add(parts[0]);
            continue;
        }

        categories.add(path.basename(filePath, '.md'));
    }

    return Array.from(categories).sort();
}

function getStatus({ markdownFiles, sectionCount, commandFiles }) {
    if (!markdownFiles.length) return 'EMPTY';
    if (!sectionCount) return 'NO_SECTIONS';
    if (!commandFiles.length) return 'NO_COMMANDS';
    return 'OK';
}

function formatKnowledgeStats(stats) {
    return [
        `Knowledge Files : ${stats.markdownFiles}`,
        `Sections : ${stats.sections}`,
        '',
        `Commands Files : ${stats.commandFiles}`,
        `General Knowledge Files : ${stats.generalKnowledgeFiles}`,
        '',
        'Categories:',
        ...stats.categories.map((category) => `- ${category}`),
        '',
        'Status:',
        stats.status,
    ].join('\n');
}

module.exports = {
    getKnowledgeStats,
    listMarkdownFiles,
    countMarkdownHeadings,
    formatKnowledgeStats,
};