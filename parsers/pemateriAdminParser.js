function parseAdminCommands(rawBody) {
    const segments = String(rawBody || '')
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length === 0) {
        return null;
    }

    const actions = [];

    for (const segment of segments) {
        const mentionMatch = segment.match(/^pemateri\s+(\d+)$/i);
        if (mentionMatch) {
            actions.push({
                type: 'mention',
                week: Number(mentionMatch[1]),
            });
            continue;
        }

        const forwardMatch = segment.match(/^kirim\s+to\s+pertemuan\s+(\d+)$/i);
        if (forwardMatch) {
            actions.push({
                type: 'forward',
                week: Number(forwardMatch[1]),
            });
            continue;
        }

        if (/^kirim\s+pesan$/i.test(segment)) {
            actions.push({
                type: 'forward',
                week: null,
                needsInheritedWeek: true,
            });
            continue;
        }

        const removeMatch = segment.match(/^remove\s+(.+)$/i);
        if (removeMatch && !/^folder\s+/i.test(removeMatch[1])) {
            actions.push({
                type: 'remove',
                name: removeMatch[1].replace(/^"|"$/g, '').trim(),
            });
            continue;
        }

        const changeMatch = segment.match(/^change\s+"?(.+?)"?\s+to\s+pertemuan\s+(\d+)\s+line\s+(\d+)$/i);
        if (changeMatch) {
            actions.push({
                type: 'move',
                name: changeMatch[1].trim(),
                week: Number(changeMatch[2]),
                line: Number(changeMatch[3]),
            });
            continue;
        }

        const addScheduleMatch = segment.match(/^add\s+"?(.+?)"?\s+to\s+pertemuan\s+(\d+)\s+line\s+(\d+)$/i);
        if (addScheduleMatch) {
            actions.push({
                type: 'add_schedule',
                name: addScheduleMatch[1].trim(),
                week: Number(addScheduleMatch[2]),
                line: Number(addScheduleMatch[3]),
            });
            continue;
        }

        const remindMatch = segment.match(/^ingatkan\s+pemateri\s+(\d+)$/i);
        if (remindMatch) {
            actions.push({
                type: 'remind',
                week: Number(remindMatch[1]),
            });
            continue;
        }

        return null;
    }

    return actions.length > 0 ? actions : null;
}

module.exports = {
    parseAdminCommands,
};