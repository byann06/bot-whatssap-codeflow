const { files } = require('../config');
const { loadJsonFile, saveJsonFile } = require('../lib/jsonFile');

function loadMembers() {
    return loadJsonFile(files.members, [], Array.isArray);
}

function saveMembers(members) {
    saveJsonFile(files.members, members);
}

module.exports = {
    loadMembers,
    saveMembers,
};
