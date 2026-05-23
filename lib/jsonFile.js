const fs = require('fs');

function loadJsonFile(filePath, fallback, validate = () => true) {
    if (!fs.existsSync(filePath)) return fallback;

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!validate(parsed)) {
            console.warn(`[jsonFile] invalid JSON shape in ${filePath}; using fallback.`);
            return fallback;
        }

        return parsed;
    } catch (error) {
        console.warn(`[jsonFile] invalid JSON in ${filePath}: ${error.message}; using fallback.`);
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
