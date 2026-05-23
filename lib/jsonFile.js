const fs = require('fs');

function loadJsonFile(filePath, fallback, validate = () => true) {
    if (!fs.existsSync(filePath)) return fallback;

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return validate(parsed) ? parsed : fallback;
    } catch (error) {
        console.warn(`[jsonFile] failed to load ${filePath}: ${error.message}`);
        return fallback;
    }
}

function saveJsonFile(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

module.exports = {
    loadJsonFile,
    saveJsonFile,
};
