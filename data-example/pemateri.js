const fs = require('fs');
const path = require('path');

const PEMATERI_FILE = path.join(__dirname, 'pemateri.json');

function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeSpeakerEntry(speaker) {
    return {
        name: String(speaker?.name || '').trim(),
        aliases: Array.isArray(speaker?.aliases)
            ? speaker.aliases.map((alias) => String(alias || '').trim()).filter(Boolean)
            : [],
    };
}

function loadSchedule() {
    if (!fs.existsSync(PEMATERI_FILE)) {
        return [];
    }

    try {
        const raw = fs.readFileSync(PEMATERI_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.map((schedule) => ({
                week: Number(schedule.week),
                speakers: Array.isArray(schedule.speakers)
                    ? schedule.speakers.map(normalizeSpeakerEntry)
                    : [],
            }))
            : [];
    } catch (error) {
        return [];
    }
}

let PEMATERI_SCHEDULE = loadSchedule();

function saveSchedule() {
    fs.writeFileSync(`${PEMATERI_FILE}`, `${JSON.stringify(PEMATERI_SCHEDULE, null, 2)}\n`, 'utf8');
}

function refreshScheduleReference() {
    PEMATERI_SCHEDULE = loadSchedule();
    module.exports.PEMATERI_SCHEDULE = PEMATERI_SCHEDULE;
    return PEMATERI_SCHEDULE;
}

function setEmptySpeaker(schedule, index) {
    schedule.speakers[index] = { name: '', aliases: [] };
}

function findSpeakerSchedule(name) {
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
        return null;
    }

    for (const schedule of PEMATERI_SCHEDULE) {
        for (let index = 0; index < schedule.speakers.length; index += 1) {
            const speaker = schedule.speakers[index];
            const aliases = Array.isArray(speaker.aliases) ? speaker.aliases.map(normalizeName) : [];
            const speakerName = normalizeName(speaker.name);

            if (speakerName === normalizedName || aliases.includes(normalizedName)) {
                return {
                    week: schedule.week,
                    order: index + 1,
                    name: speaker.name,
                    speakers: schedule.speakers,
                };
            }
        }
    }

    return null;
}

function findScheduleByWeek(week) {
    const targetWeek = Number(week);
    if (!Number.isInteger(targetWeek) || targetWeek <= 0) {
        return null;
    }

    return PEMATERI_SCHEDULE.find((schedule) => schedule.week === targetWeek) || null;
}

function removeSpeakerByName(name) {
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
        return null;
    }

    for (const schedule of PEMATERI_SCHEDULE) {
        for (let index = 0; index < schedule.speakers.length; index += 1) {
            const speaker = schedule.speakers[index];
            if (normalizeName(speaker.name) === normalizedName) {
                const removedSpeaker = { ...speaker };
                setEmptySpeaker(schedule, index);
                saveSchedule();
                refreshScheduleReference();
                return {
                    removedSpeaker,
                    week: schedule.week,
                    line: index + 1,
                };
            }
        }
    }

    return null;
}

function moveSpeakerByName(name, targetWeek, targetLine) {
    const normalizedName = normalizeName(name);
    const weekNumber = Number(targetWeek);
    const lineNumber = Number(targetLine);
    if (!normalizedName || !Number.isInteger(weekNumber) || !Number.isInteger(lineNumber) || lineNumber <= 0) {
        return { error: 'invalid_target' };
    }

    const sourceMatch = findSpeakerSchedule(name);
    if (!sourceMatch) {
        return null;
    }

    const sourceSchedule = findScheduleByWeek(sourceMatch.week);
    const destinationSchedule = findScheduleByWeek(weekNumber);
    if (!sourceSchedule || !destinationSchedule || lineNumber > destinationSchedule.speakers.length) {
        return { error: 'invalid_target' };
    }

    const sourceIndex = sourceMatch.order - 1;
    const destinationIndex = lineNumber - 1;
    const movingSpeaker = { ...sourceSchedule.speakers[sourceIndex] };
    const displacedSpeaker = { ...destinationSchedule.speakers[destinationIndex] };

    destinationSchedule.speakers[destinationIndex] = movingSpeaker;

    if (sourceSchedule.week === destinationSchedule.week && sourceIndex === destinationIndex) {
        saveSchedule();
        refreshScheduleReference();
        return {
            movedSpeaker: movingSpeaker,
            fromWeek: sourceSchedule.week,
            fromLine: sourceIndex + 1,
            toWeek: destinationSchedule.week,
            toLine: destinationIndex + 1,
            swappedSpeaker: null,
        };
    }

    if (normalizeName(displacedSpeaker.name)) {
        sourceSchedule.speakers[sourceIndex] = displacedSpeaker;
    } else {
        setEmptySpeaker(sourceSchedule, sourceIndex);
    }

    saveSchedule();
    refreshScheduleReference();
    return {
        movedSpeaker: movingSpeaker,
        fromWeek: sourceSchedule.week,
        fromLine: sourceIndex + 1,
        toWeek: destinationSchedule.week,
        toLine: destinationIndex + 1,
        swappedSpeaker: normalizeName(displacedSpeaker.name) ? displacedSpeaker : null,
    };
}

function addSpeakerToSchedule(name, targetWeek, targetLine) {
    const speakerName = String(name || '').trim();
    const weekNumber = Number(targetWeek);
    const lineNumber = Number(targetLine);
    if (!speakerName || !Number.isInteger(weekNumber) || !Number.isInteger(lineNumber) || lineNumber <= 0) {
        return { error: 'invalid_target' };
    }

    if (findSpeakerSchedule(speakerName)) {
        return { error: 'already_exists' };
    }

    const destinationSchedule = findScheduleByWeek(weekNumber);
    if (!destinationSchedule || lineNumber > destinationSchedule.speakers.length) {
        return { error: 'invalid_target' };
    }

    const destinationIndex = lineNumber - 1;
    if (normalizeName(destinationSchedule.speakers[destinationIndex]?.name)) {
        return { error: 'slot_filled', speaker: destinationSchedule.speakers[destinationIndex] };
    }

    destinationSchedule.speakers[destinationIndex] = { name: speakerName, aliases: [] };
    saveSchedule();
    refreshScheduleReference();
    return {
        addedSpeaker: destinationSchedule.speakers[destinationIndex],
        week: destinationSchedule.week,
        line: destinationIndex + 1,
    };
}

module.exports = {
    PEMATERI_SCHEDULE,
    findSpeakerSchedule,
    findScheduleByWeek,
    removeSpeakerByName,
    moveSpeakerByName,
    addSpeakerToSchedule,
    refreshScheduleReference,
};
