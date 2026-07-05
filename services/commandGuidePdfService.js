const fs = require('fs');
const path = require('path');
const config = require('../config');
const {
    getCommandCategories,
    getCommandGuideFileName,
} = require('../constants/commandCatalog');

const DEFAULT_OUTPUT_PATH = path.join(config.rootDir, 'docs', getCommandGuideFileName());

function ensureCommandGuidePdf(outputPath = DEFAULT_OUTPUT_PATH) {
    generateCommandGuidePdf(outputPath);
    return outputPath;
}

function generateCommandGuidePdf(outputPath = DEFAULT_OUTPUT_PATH) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const blocks = buildCommandGuideBlocks();
    const pdfBuffer = createSimplePdf(blocks);
    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
}

function buildCommandGuideBlocks() {
    const blocks = [
        { type: 'title', text: 'Panduan Command Bot CodeFlow' },
        { type: 'body', text: `Diperbarui: ${formatWibDateTime(new Date())}` },
        { type: 'body', text: 'Dokumen ini berisi daftar command bot, fungsi, format penggunaan, contoh, dan catatan akses.' },
        { type: 'body', text: 'Ringkasan penting: hadir wajib di grup. Izin boleh di grup atau private bot, tetapi wajib menyertakan alasan.' },
        { type: 'space' },
    ];

    getCommandCategories().forEach((category, categoryIndex) => {
        blocks.push(
            { type: 'h1', text: `${categoryIndex + 1}. ${category.title}` },
            { type: 'body', text: `Akses: ${category.access}` },
            { type: 'body', text: category.description },
        );

        category.commands.forEach((item, commandIndex) => {
            blocks.push(
                { type: 'h2', text: `${categoryIndex + 1}.${commandIndex + 1}. ${item.command}` },
                { type: 'body', text: `Fungsi: ${item.summary}` },
                { type: 'body', text: `Format: ${item.usage || item.command}` },
            );

            if (Array.isArray(item.aliases) && item.aliases.length) {
                blocks.push({ type: 'body', text: `Alias: ${item.aliases.join(', ')}` });
            }

            if (Array.isArray(item.examples) && item.examples.length) {
                blocks.push({ type: 'body', text: 'Contoh:' });
                item.examples.forEach((example) => {
                    blocks.push({ type: 'code', text: example });
                });
            }

            if (Array.isArray(item.notes) && item.notes.length) {
                blocks.push({ type: 'body', text: 'Catatan:' });
                item.notes.forEach((note) => {
                    blocks.push({ type: 'bullet', text: note });
                });
            }
        });

        blocks.push({ type: 'space' });
    });

    blocks.push(
        { type: 'h1', text: 'Rekomendasi Penggunaan' },
        { type: 'bullet', text: 'Gunakan menu untuk melihat ringkasan command.' },
        { type: 'bullet', text: 'Gunakan command untuk meminta ulang PDF panduan ini.' },
        { type: 'bullet', text: 'Jika command admin ditolak, pastikan LID/role admin sudah benar di .env.' },
        { type: 'bullet', text: 'Jika dokumentasi gagal upload, cek folder aktif Google Drive dan bridge Discord.' },
    );

    return blocks;
}

function createSimplePdf(blocks) {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 46;
    const bottomMargin = 46;
    const maxWidth = pageWidth - margin * 2;
    const pages = [];
    let currentPage = [];
    let y = pageHeight - margin;

    function pushPage() {
        if (currentPage.length) {
            pages.push(currentPage);
        }
        currentPage = [];
        y = pageHeight - margin;
    }

    function addLine(text, style) {
        const leading = style.leading || style.size + 4;
        if (y - leading < bottomMargin) {
            pushPage();
        }

        currentPage.push({
            text,
            x: margin + (style.indent || 0),
            y,
            font: style.font || 'F1',
            size: style.size,
        });
        y -= leading;
    }

    for (const block of blocks) {
        const style = getBlockStyle(block.type);

        if (block.type === 'space') {
            y -= 10;
            if (y < bottomMargin) pushPage();
            continue;
        }

        if (block.type === 'h1' && y < 140) {
            pushPage();
        }

        y -= style.before || 0;
        const prefix = block.type === 'bullet' ? '- ' : '';
        const availableWidth = maxWidth - (style.indent || 0);
        const lines = wrapText(`${prefix}${block.text || ''}`, availableWidth, style.size, block.type === 'code');
        lines.forEach((line, index) => {
            const continuedStyle = index === 0 ? style : { ...style, indent: (style.indent || 0) + (block.type === 'bullet' ? 10 : 0) };
            addLine(line, continuedStyle);
        });
        y -= style.after || 0;
    }

    pushPage();
    return buildPdfDocument(pages, pageWidth, pageHeight);
}

function getBlockStyle(type) {
    const styles = {
        title: { font: 'F2', size: 22, leading: 28, before: 0, after: 10 },
        h1: { font: 'F2', size: 15, leading: 20, before: 8, after: 4 },
        h2: { font: 'F2', size: 11, leading: 15, before: 6, after: 2 },
        body: { font: 'F1', size: 10, leading: 14, before: 0, after: 1 },
        bullet: { font: 'F1', size: 10, leading: 14, before: 0, after: 1, indent: 12 },
        code: { font: 'F3', size: 9, leading: 13, before: 0, after: 1, indent: 16 },
    };

    return styles[type] || styles.body;
}

function wrapText(text, maxWidth, fontSize, preserveLongText = false) {
    const averageCharWidth = fontSize * (preserveLongText ? 0.58 : 0.52);
    const maxChars = Math.max(18, Math.floor(maxWidth / averageCharWidth));
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!source) return [''];

    const words = source.split(' ');
    const lines = [];
    let current = '';

    for (const word of words) {
        if (!current) {
            current = word;
            continue;
        }

        if ((current + ' ' + word).length <= maxChars) {
            current += ' ' + word;
        } else {
            lines.push(current);
            current = word;
        }
    }

    if (current) lines.push(current);
    return lines.flatMap((line) => splitLongLine(line, maxChars));
}

function splitLongLine(line, maxChars) {
    if (line.length <= maxChars) return [line];
    const chunks = [];
    for (let index = 0; index < line.length; index += maxChars) {
        chunks.push(line.slice(index, index + maxChars));
    }
    return chunks;
}

function buildPdfDocument(pages, pageWidth, pageHeight) {
    const objects = [];
    const addObject = (content) => {
        objects.push(content);
        return objects.length;
    };

    const catalogId = addObject('');
    const pagesId = addObject('');
    const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const fontMonoId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    const pageIds = [];

    pages.forEach((page) => {
        const content = page.map(renderPdfTextLine).join('\n');
        const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
        const pageId = addObject([
            '<< /Type /Page',
            `/Parent ${pagesId} 0 R`,
            `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
            `/Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontMonoId} 0 R >> >>`,
            `/Contents ${contentId} 0 R`,
            '>>',
        ].join('\n'));
        pageIds.push(pageId);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let output = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(output, 'utf8'));
        output += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(output, 'utf8');
    output += `xref\n0 ${objects.length + 1}\n`;
    output += '0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index += 1) {
        output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(output, 'utf8');
}

function renderPdfTextLine(line) {
    return `BT /${line.font} ${line.size} Tf ${formatNumber(line.x)} ${formatNumber(line.y)} Td (${escapePdfText(line.text)}) Tj ET`;
}

function escapePdfText(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function formatNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, '');
}

function formatWibDateTime(date) {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

module.exports = {
    DEFAULT_OUTPUT_PATH,
    ensureCommandGuidePdf,
    generateCommandGuidePdf,
};
