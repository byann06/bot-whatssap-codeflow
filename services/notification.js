const { botNoticeGroupId } = require('../config');

async function sendGroupNotice(sock, text, options = {}) {
    const groupId = options.groupId || botNoticeGroupId;
    if (!groupId || !sock?.sendMessage) return;

    if (options.gifUrl) {
        await sock.sendMessage(groupId, {
            video: { url: options.gifUrl },
            caption: text,
            gifPlayback: true,
            mimetype: 'video/mp4',
        });
        return;
    }

    await sock.sendMessage(groupId, { text });
}

async function sendBotNotice(client, text, options = {}) {
    if (!client?.sock) return;
    await sendGroupNotice(client.sock, text, options);
}

module.exports = {
    sendBotNotice,
    sendGroupNotice,
};