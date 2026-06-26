const config = require('../config');
const { normalizePhone } = require('./memberIdentityService');

const ADMIN_PHONE = config.roles.adminPhone;
const ADMIN_LID = config.roles.adminLid;

function isAdminUser(senderPhone, msg) {
    if (ADMIN_PHONE.includes(normalizePhone(senderPhone))) {
        return true;
    }

    const ids = [
        msg?.author, msg?.from,
        msg?.key?.remoteJid,
        msg?.key?.participant,
    ]
        .filter(Boolean)
        .map((value) => String(value).trim());

    return ids.some((id) => ADMIN_LID.includes(id));
}

function isDocumentationAdmin(senderPhone, msg) {
    return isAdminUser(senderPhone, msg);
}

function hasLidRole(senderIdentity, ...lidLists) {
    if (ADMIN_LID.includes(senderIdentity.lid)) return true;
    return lidLists.some((list) => list.includes(senderIdentity.lid));
}

module.exports = {
    isAdminUser,
    isDocumentationAdmin,
    hasLidRole,
};