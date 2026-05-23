const { files } = require('../config');
const { loadJsonFile, saveJsonFile } = require('../lib/jsonFile');

function loadAttendance() {
    return loadJsonFile(files.attendance, {}, (value) => value && typeof value === 'object' && !Array.isArray(value));
}

function saveAttendance(attendance) {
    saveJsonFile(files.attendance, attendance);
}

module.exports = {
    loadAttendance,
    saveAttendance,
};
