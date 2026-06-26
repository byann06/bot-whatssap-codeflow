const driveDocs = require('./drive');
const { handleGeneralCommand } = require('./generalCommandHandler');
const { handleFunCommand } = require('./funCommandHandler');
const { handleRegistrationCommand, handleRegistrationConversation } = require('./registrationCommandHandler');
const { handlePemateriCommand } = require('./pemateriCommandHandler');
const { loadDocsState, listFoldersFromDrive, removeFolder, getMediaType, uploadMediaBatch } = driveDocs;
const config = require('../config');
const { loadMembers, saveMembers } = require('../repositories/members');
const { loadAttendance, saveAttendance } = require('../repositories/attendance');
const { sendBotNotice } = require('../services/notification');
const {
    getWibDateKey,
    getWibTimeLabel,
    formatDateKey,
    parseWibDateTime,
    formatDateTimeLabel,
    normalizeDateInput,
    normalizeTimeInput,
    parseTimeRange,
    isSkipValue,
} = require('../lib/dateTime');
const {
    parseAttendanceCommand,
    parseAttendanceReportCommand,
} = require('../parsers/attendanceParser');
const {
    parseRegisterText,
    parseAddCommand,
} = require('../parsers/registrationParser');
const {
    parseDocumentationCommand,
    isDocumentationUploadCommand,
} = require('../parsers/documentationParser');
const { parseAdminCommands } = require('../parsers/pemateriAdminParser');
const {
    getAttendanceIdentity,
    getAttendanceMeta,
    getSessionExcuses,
    getSessionTitle,
    findOpenSessionForChat,
    findRelevantSessionForExcuse,
    createAttendanceSession,
    openAttendanceSession,
    closeAttendanceSession,
    recordAttendanceInSession,
    recordExcuseInSession,
    removeAttendanceFromSession,
    formatAttendanceSessionReport,
    findScheduleByQuery,
    saveAttendanceSession,
    formatScheduleList,
} = require('../services/attendanceService');

const {
    normalizePhone,
    normalizeLid,
    buildSenderIdentity,
    findMemberEntriesByIdentity,
} = require('../services/memberIdentityService');
const {
    isAdminUser,
    hasLidRole,
} = require('../services/permissionService');
const AVAILABLE_COMMANDS = new Set(['menu', 'link', 'logo', 'drive auth', 'sirpai', 'info', 'daftar', 'pemateri', 'jadwalku', 'add', 'hadir', 'daftar hadir', 'codeflowchallenge', 'aspek penilaian', 'upin ipin', 'cek lid', 'min ukm di um apa aja ni?', 'folder list', 'jadwal absen', 'buat jadwal', 'liat jadwal', 'hapus jadwal', 'ubah jadwal', 'jam absen', 'close absen', 'buka absen', 'tutup absen', 'hapus hadir', 'izin', 'daftar izin']);
const ADMIN_LID = config.roles.adminLid;
// Antrian upload media per admin
const uploadQueue = new Map();
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000; // 2 menit
const UPLOAD_WARNING_MS = 105 * 1000; // warning di DETIK ke-1:45
const HADIR_LID = config.roles.hadirLid;
const DOKUMENTASI_LID = config.roles.dokumentasiLid;
const KOMUNIKASI_LID = config.roles.komunikasiLid;
const PEMATERI_LID = config.roles.pemateriLid;
const ATTENDANCE_SESSIONS_KEY = config.attendanceKeys.sessions;
const ATTENDANCE_ACTIVE_KEY = config.attendanceKeys.activeByChat;
const ATTENDANCE_REMINDER_MINUTES = config.attendanceReminderMinutes;
const attendanceReminderTimers = new Map();
const conversationStates = new Map();

function getConversationKey(identity, chatId) {
    return normalizeLid(identity?.lid) || normalizePhone(identity?.phone) || chatId || 'unknown';
}

function logInteraction(type, details) {
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    console.log(`[${timestamp}] [${type}] ${details}`);
}

function scheduleAttendanceReminder(client, session, targetChatId) {
    if (!client?.sock || !session?.id || attendanceReminderTimers.has(session.id)) {
        return;
    }

    const startsAt = parseWibDateTime(session.dateKey, session.startTime);
    if (!startsAt) {
        return;
    }

    const remindAt = startsAt.getTime() - ATTENDANCE_REMINDER_MINUTES * 60 * 1000;
    const delay = remindAt - Date.now();
    if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) {
        return;
    }

    const timer = setTimeout(async () => {
        attendanceReminderTimers.delete(session.id);
        try {
            const mentions = HADIR_LID.length ? HADIR_LID : ADMIN_LID;
            const mentionText = mentions.map((lid) => `@${lid.split('@')[0]}`).join(' ');
            await client.sock.sendMessage(targetChatId || session.chatId, {
                text: `${mentionText ? mentionText + ' ' : ''}pengingat: sesi absen *${getSessionTitle(session)}* dijadwalkan mulai ${formatDateTimeLabel(session.dateKey, session.startTime)}. Ketik *buka absen* saat kegiatan dimulai.`,
                mentions,
            });
        } catch (error) {
            logInteraction('WARN', `attendance_reminder_failed | session=${session.id} | error=${error.message}`);
        }
    }, delay);

    attendanceReminderTimers.set(session.id, timer);
}
function getUploadQueue(lid) {
    return uploadQueue.get(lid) || null;
}

function clearUploadQueue(lid) {
    const queue = uploadQueue.get(lid);
    if (queue) {
        if (queue.timeoutId) clearTimeout(queue.timeoutId);
        if (queue.warningId) clearTimeout(queue.warningId);
        uploadQueue.delete(lid);
    }
}

function setUploadQueue(lid, data) {
    uploadQueue.set(lid, data);
}
function getDriveErrorMessage(error) {
    const code = error?.message || '';
    const messages = {
        credentials_not_found: 'file Google Drive credentials belum ditemukan. Pastikan ada di `credentials/google-drive-credentials.json`.',
        invalid_credentials: 'file Google Drive credentials tidak valid. Download ulang OAuth Client JSON dari Google Cloud.',
        drive_not_authorized: 'Google Drive belum login. Jalankan `drive auth`, buka link, lalu kirim `drive code <kode>`.',
        parent_folder_required: 'GOOGLE_DRIVE_PARENT_FOLDER_ID belum diisi di `.env` bot utama.',
        folder_name_required: 'nama folder wajib diisi. Contoh: `create folder "pkkmb 2026"`.',
        folder_not_found: 'folder dokumentasi belum ditemukan. Buat dulu dengan `create folder "nama folder"`.',
        active_folder_required: 'belum ada folder aktif. Pilih dulu dengan `folder aktif "nama folder"`.',
        discord_channel_unavailable: 'bridge Discord hidup, tapi channel Discord belum bisa diakses.',
        unauthorized: 'BRIDGE_INTERNAL_SECRET tidak cocok dengan secret di bridge.',
    };

    return messages[code] || `terjadi error dokumentasi: ${code || 'unknown_error'}`;
}

function recordAttendance(member, identity = {}) {
    const attendance = loadAttendance();
    const dateKey = getWibDateKey();
    const todayRecords = Array.isArray(attendance[dateKey]) ? attendance[dateKey] : [];
    const attendanceIdentity = getAttendanceIdentity(identity) || getAttendanceIdentity(member);
    const existingRecord = todayRecords.find((record) => getAttendanceIdentity(record) === attendanceIdentity);

    if (existingRecord) {
        return { status: 'exists', dateKey, record: existingRecord };
    }

    const now = new Date();
    const record = {
        phone: normalizePhone(identity.phone || member.phone),
        lid: normalizeLid(identity.lid || member.lid),
        name: member.name || '-',
        npm: member.npm || '',
        role: member.role || '-',
        time: getWibTimeLabel(now),
        timestamp: now.toISOString(),
    };

    todayRecords.push(record);
    attendance[dateKey] = todayRecords;
    saveAttendance(attendance);

    return { status: 'saved', dateKey, record };
}

function formatAttendanceReport(dateKey) {
    const attendance = loadAttendance();
    const records = Array.isArray(attendance[dateKey]) ? attendance[dateKey] : [];

    if (records.length === 0) {
        return '*Daftar Hadir - ' + formatDateKey(dateKey) + '*\n\nBelum ada anggota yang mengisi hadir.';
    }

    const lines = records.map((record, index) => (index + 1) + '. ' + (record.name || '-') + ' - ' + (record.time || '-') + ' WIB');
    return '*Daftar Hadir - ' + formatDateKey(dateKey) + '*\nTotal: ' + records.length + ' anggota\n\n' + lines.join('\n');
}
function getMentionHandle(contact, senderName) {
    const mentionId = contact?.id?._serialized || '';
    if (mentionId) {
        return `@${mentionId.split('@')[0]}`;
    }

    return senderName;
}

function getMentionTargets(contact) {
    return contact ? [contact] : [];
}

async function replyToUser(msg, contact, senderName, text) {
    const mentionHandle = getMentionHandle(contact, senderName);
    return msg.reply(`${mentionHandle} ${text}`.trim(), undefined, {
        mentions: getMentionTargets(contact),
    });
}



function findMembersByIdentity(identity, options = {}) {
    const matchedEntries = findMemberEntriesByIdentity(identity, options);
    if (matchedEntries.length === 1) {
        rememberSenderIdentity(matchedEntries[0].index, identity);
    }

    return matchedEntries.map(({ member }) => member);
}

function rememberSenderIdentity(index, identity) {
    if (!Number.isInteger(index) || index < 0) {
        return;
    }

    const members = loadMembers();
    const member = members[index];
    if (!member) {
        return;
    }

    let changed = false;
    const phone = normalizePhone(identity?.phone);
    const lid = normalizeLid(identity?.lid);

    if (phone && normalizePhone(member.phone) !== phone) {
        member.phone = phone;
        changed = true;
    }

    if (lid && normalizeLid(member.lid) !== lid) {
        member.lid = lid;
        changed = true;
    }

    if (changed) {
        saveMembers(members);
    }
}

function findPrimaryMemberByIdentity(identity, options = {}) {
    const matchedEntries = findMemberEntriesByIdentity(identity, options);
    if (matchedEntries.length !== 1) {
        return null;
    }

    rememberSenderIdentity(matchedEntries[0].index, identity);
    return matchedEntries[0].member;
}

function createScheduleFromData(data, chatId, senderName) {
    if (!data.dateKey) return { error: 'tanggal jadwal belum ada.' };
    if (!data.title) return { error: 'nama jadwal belum ada.' };
    const startTime = data.startTime || '00:00';
    const startsAt = parseWibDateTime(data.dateKey, startTime);
    if (!startsAt) return { error: 'format tanggal/jam belum benar.' };
    const session = createAttendanceSession(chatId, data.dateKey, startTime, data.title, senderName, data.endTime || null);
    return { session };
}

async function handleConversationReply(msg, contact, senderName, senderIdentity, senderPhone, from, rawBody, client) {
    const key = getConversationKey(senderIdentity, from);
    const state = conversationStates.get(key);
    if (!state) return false;

    const text = String(rawBody || '').trim();
    if (/^(batal|cancel)$/i.test(text)) {
        conversationStates.delete(key);
        await replyToUser(msg, contact, senderName, 'baik, proses dibatalkan.');
        return true;
    }

    if (state.type === 'schedule') {
        if (!hasLidRole(senderIdentity, HADIR_LID)) {
            conversationStates.delete(key);
            await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
            return true;
        }

        if (state.step === 'date') {
            const dateKey = normalizeDateInput(text);
            if (!dateKey) {
                await replyToUser(msg, contact, senderName, 'format tanggal belum benar. Contoh: `21-05-2026`.');
                return true;
            }
            state.data.dateKey = dateKey;
            state.step = 'time';
            await replyToUser(msg, contact, senderName, 'oke. \napakah jam akses absen anggota \ndan\n jam close absen anggota mau. diisi sekarang? \nContoh: \n`jam absen 13.00` \n`jam close 17.00`\n\n atau kamu belum tau ? cukup ketik `belum`/`nanti`.');
            return true;
        }

        if (state.step === 'time') {
            if (isSkipValue(text)) {
                state.step = 'title';
                await replyToUser(msg, contact, senderName, 'baik, mohon berikan nama jadwal. Contoh: `pertemuan 3`.');
                return true;
            }
            const startMatch = text.match(/^jam\s+absen\s*,?\s*(.+)$/i);
            const range = parseTimeRange(startMatch ? startMatch[1] : text);
            if (!range.startTime) {
                await replyToUser(msg, contact, senderName, 'format jam belum benar. Contoh: `jam absen 13.00` atau `13.00-17.00`.');
                return true;
            }
            state.data.startTime = range.startTime;
            if (range.endTime) state.data.endTime = range.endTime;
            state.step = 'closeTime';
            await replyToUser(msg, contact, senderName, 'jam absen tersimpan. Mau isi jam close absen? Contoh `close absen,17.00` atau ketik `belum`.');
            return true;
        }

        if (state.step === 'closeTime') {
            if (!isSkipValue(text)) {
                const closeMatch = text.match(/^close\s+absen\s*,?\s*(.+)$/i);
                const closeTime = normalizeTimeInput(closeMatch ? closeMatch[1] : text);
                if (!closeTime) {
                    await replyToUser(msg, contact, senderName, 'format jam close belum benar. Contoh: `close absen,17.00` atau ketik `belum`.');
                    return true;
                }
                state.data.endTime = closeTime;
            }
            state.step = 'title';
            await replyToUser(msg, contact, senderName, 'baik, mohon berikan nama jadwal. Contoh: `pertemuan 3`.');
            return true;
        }

        if (state.step === 'title') {
            if (!text || isSkipValue(text)) {
                await replyToUser(msg, contact, senderName, 'nama jadwal wajib diisi. Contoh: `pertemuan 3`.');
                return true;
            }
            state.data.title = text;
            const result = createScheduleFromData(state.data, from, senderName);
            conversationStates.delete(key);
            if (result.error) {
                await replyToUser(msg, contact, senderName, result.error);
                return true;
            }
            scheduleAttendanceReminder(client, result.session, from);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(result.session)}* terbuat. Silakan lihat jadwal dengan *liat jadwal*.`);
            return true;
        }
    }
    if (state.type === 'register') {
        return handleRegistrationConversation({
            state,
            stateKey: key,
            msg,
            contact,
            senderName,
            senderIdentity,
            senderPhone,
            rawBody,
            conversationStates,
            replyToUser,
        });
    }

    return false;
}
async function handleMessage(msg, client) {
    const rawBody = msg.body.replace(/@\d+/g, '').replace(/^@bot\s+/i, '').trim();
    const body = rawBody.toLowerCase();
    const from = msg.from || '';
    const author = msg.author || '';
    const isChannelMessage = from.endsWith('@newsletter') || author.endsWith('@newsletter');

    if (isChannelMessage) {
        logInteraction('SKIP', `CHANNEL | chat=${from} | reason=unsupported_newsletter_message`);
        return;
    }

    const contact = await msg.getContact().catch(() => null);
    const senderName = contact?.pushname || contact?.name || author || from;
    const senderIdentity = buildSenderIdentity(contact, msg, senderName);
    const senderPhone = senderIdentity.phone;
    const addCommand = parseAddCommand(rawBody);
    const registerCommand = parseRegisterText(rawBody);
    const adminCommands = parseAdminCommands(rawBody);
    const attendanceReportCommand = parseAttendanceReportCommand(rawBody);
    const attendanceCommand = parseAttendanceCommand(rawBody);
    const documentationCommand = parseDocumentationCommand(rawBody);
    const documentationUploadCommand = isDocumentationUploadCommand(rawBody);
    const primaryCommand = addCommand ? 'add' : registerCommand ? 'daftar' : attendanceReportCommand ? 'daftar hadir' : attendanceCommand ? attendanceCommand.primary : documentationCommand ? 'documentation' : body;

    let chat = null;
    let chatType = 'PRIVATE';
    let isGroup = false;

    try {
        chat = await msg.getChat();
        isGroup = Boolean(chat?.isGroup);
        chatType = isGroup ? 'GROUP' : 'PRIVATE';
    } catch (error) {
        logInteraction('WARN', `chat=${from} | reason=getChat_failed | error="${error.message}"`);
    }

    if (await handleConversationReply(msg, contact, senderName, senderIdentity, senderPhone, from, rawBody, client)) {
        return;
    }

    // Handle media masuk dari admin dokumentasi (chat pribadi)
    if (!isGroup && msg.mediaInfo && typeof msg.downloadMedia === 'function') {
        if (hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
            const mediaType = getMediaType(msg.mediaInfo.mimetype, msg.mediaInfo.fileName);
            if (mediaType) {
                const lid = senderIdentity.lid;
                if (!getUploadQueue(lid)) {
                    uploadQueue.set(lid, { items: [], warningId: null, timeoutId: null, debounceId: null, sock: null });
                }
                const existing = getUploadQueue(lid);
                const downloaded = await msg.downloadMedia().catch(() => null);
                if (downloaded?.buffer) {
                    existing.items.push({
                        buffer: downloaded.buffer,
                        mimetype: downloaded.mimetype,
                        fileName: downloaded.fileName || msg.mediaInfo.fileName,
                        type: mediaType,
                    });
                    await client.sock.sendMessage(from, { text: `⏳ File diterima (${existing.items.length}). Menunggu file berikutnya...` });
                    // Reset timer setiap ada file baru masuk
                    if (existing.warningId) clearTimeout(existing.warningId);
                    if (existing.timeoutId) clearTimeout(existing.timeoutId);

                    // Warning menit ke-4
                    existing.warningId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        if (!q) return;
                        const foto = q.items.filter(i => i.type === 'foto').length;
                        const video = q.items.filter(i => i.type === 'video').length;
                        await client.sock.sendMessage(from, {
                            text: `⚠️ Sesi upload hampir habis (1 menit lagi)!\nTertampung: ${foto} foto, ${video} video.\nSegera balas: *ya*, *upload foto*, atau *upload video*`
                        });
                    }, UPLOAD_WARNING_MS);

                    // Timeout 5 menit → hapus antrian
                    existing.timeoutId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        if (!q) return;
                        clearUploadQueue(lid);
                        await client.sock.sendMessage(from, {
                            text: `❌ Sesi upload habis. File yang tertampung telah dihapus dari memory. Silakan kirim ulang.`
                        });
                    }, UPLOAD_TIMEOUT_MS);


                    // Balas konfirmasi setelah jeda singkat (debounce 2 detik)
                    if (existing.debounceId) clearTimeout(existing.debounceId);
                    existing.debounceId = setTimeout(async () => {
                        const q = getUploadQueue(lid);
                        console.log(`[debounce] fired | queue:`, q ? `${q.items.length} items` : 'null');
                        if (!q) return;
                        const foto = q.items.filter(i => i.type === 'foto').length;
                        const video = q.items.filter(i => i.type === 'video').length;
                        await client.sock.sendMessage(from, {
                            text: `📥 Saya menerima *${foto} foto* dan *${video} video* — total *${foto + video} item*.\n\nBalas dengan:\n- *ya* → upload semua\n- *upload foto* → upload foto saja\n- *upload video* → upload video saja\n- *reset* → batalkan semua file\n\nSesi akan habis dalam *1 menit*.`
                        });
                    }, 5000);

                }
                return;
            }
        }
    }



    const shouldLogCommand = primaryCommand === 'documentation' || AVAILABLE_COMMANDS.has(primaryCommand) || Boolean(adminCommands) || documentationUploadCommand || Boolean(attendanceCommand);
    logInteraction('INCOMING', `${chatType} | chat=${from} | phone=${senderIdentity.phone || '-'} | lid=${senderIdentity.lid || '-'} | messageLength=${String(msg.body || '').length}${shouldLogCommand ? ` | command=${primaryCommand || '-'}` : ''}`);

    if (adminCommands) {
        await handlePemateriCommand({ msg, client, contact, senderName, senderIdentity, adminCommands, hasLidRole, komunikasiLid: KOMUNIKASI_LID, pemateriLid: PEMATERI_LID, logInteraction, replyToUser });
        return;
    }

    if (documentationUploadCommand) {
        if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
            logInteraction('SKIP', `DOCUMENTATION_UPLOAD | from=${senderName} | reason=not_dokumentasi`);
            return;
        }

        // Ambil media dari quoted message (pesan yang di-reply)
        const quotedMsg = msg.hasQuotedMsg ? await msg.getQuotedMessage().catch(() => null) : null;
        const mediaSource = (quotedMsg?.mediaInfo && typeof quotedMsg.downloadMedia === 'function')
            ? quotedMsg
            : (msg.mediaInfo && typeof msg.downloadMedia === 'function')
                ? msg
                : null;

        if (!mediaSource) {
            await replyToUser(msg, contact, senderName, 'tidak ada file yang terdeteksi. Reply ke file/foto/video lalu ketik upload dokumentasi.');
            return;
        }

        try {
            const media = await mediaSource.downloadMedia();
            if (!media?.buffer) {
                await replyToUser(msg, contact, senderName, 'dokumen gagal dibaca dari WhatsApp. Coba kirim ulang sebagai document.');
                return;
            }

            const uploaded = await driveDocs.uploadBufferToActiveFolder(from, media);
            logInteraction('OUTGOING', `reply=documentation_upload_success | to=${senderName} | folder=${uploaded.folder.name} | file=${uploaded.file.name}`);
            await replyToUser(msg, contact, senderName, `file *${uploaded.file.name}* berhasil diupload ke folder *${uploaded.folder.name}*.`);
            return;
        } catch (error) {
            logInteraction('OUTGOING', `reply=documentation_upload_error | to=${senderName} | error=${error.message}`);
            await replyToUser(msg, contact, senderName, getDriveErrorMessage(error));
            return;
        }
    }

    if (isGroup) {
        const botNumber = client.info.wid._serialized;
        const isMentioned = msg.mentionedIds?.includes(botNumber);
        const isKnownCommand = AVAILABLE_COMMANDS.has(primaryCommand) || primaryCommand === 'documentation' || documentationUploadCommand || Boolean(adminCommands) || Boolean(attendanceCommand);
        if (!isMentioned && !isKnownCommand) {
            logInteraction('SKIP', `GROUP | from=${senderName} | reason=not_mentioned_and_unknown_command`);
            return;
        }
    }

    switch (primaryCommand) {
        case 'documentation': {
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) {
                logInteraction('OUTGOING', `reply=documentation_admin_only | to=${senderName}`);
                await replyToUser(msg, contact, senderName, 'fitur dokumentasi khusus admin dokumentasi.');
                break;
            }

            try {
                if (documentationCommand.type === 'drive_auth') {
                    const authUrl = driveDocs.getAuthUrl();
                    logInteraction('OUTGOING', `reply=drive_auth | to=${senderName}`);
                    await replyToUser(msg, contact, senderName, `buka link ini untuk login Google Drive:\n${authUrl}\n\nSetelah dapat kode, kirim:\n\`drive code KODE_DARI_GOOGLE\``);
                    break;
                }

                if (documentationCommand.type === 'drive_code') {
                    await driveDocs.saveTokenFromCode(documentationCommand.code);
                    logInteraction('OUTGOING', `reply=drive_code_saved | to=${senderName}`);
                    await replyToUser(msg, contact, senderName, 'login Google Drive berhasil disimpan. Sekarang bot bisa membuat folder dan upload dokumentasi.');
                    break;
                }

                if (documentationCommand.type === 'create_folder') {
                    const folder = await driveDocs.createFolder(documentationCommand.name, senderName);
                    driveDocs.setActiveFolder(from, folder.name);
                    logInteraction('OUTGOING', `reply=documentation_folder_created | to=${senderName} | folder=${folder.name}`);
                    await replyToUser(msg, contact, senderName, `${folder.exists ? 'folder sudah ada' : 'folder berhasil dibuat'}: *${folder.name}*\nFolder ini juga sudah dijadikan folder aktif.\n${folder.link}`);
                    break;
                }

                if (documentationCommand.type === 'set_active_folder') {
                    const folder = await driveDocs.setActiveFolder(from, documentationCommand.name);
                    logInteraction('OUTGOING', `reply=documentation_active_folder | to=${senderName} | folder=${folder.name}`);
                    await replyToUser(msg, contact, senderName, `folder aktif sekarang: *${folder.name}*. Kirim dokumentasi sebagai document agar langsung diupload ke folder ini.`);
                    break;
                }

                if (documentationCommand.type === 'share_folder') {
                    const result = await driveDocs.shareFolderToDiscord(documentationCommand.name, senderName);
                    logInteraction('OUTGOING', `reply=documentation_share_discord | to=${senderName} | folder=${result.folder.name}`);
                    await replyToUser(msg, contact, senderName, `link folder *${result.folder.name}* berhasil dikirim ke Discord.`);
                    break;
                }
            } catch (error) {
                logInteraction('OUTGOING', `reply=documentation_error | to=${senderName} | error=${error.message}`);
                await replyToUser(msg, contact, senderName, getDriveErrorMessage(error));
                break;
            }

            if (documentationCommand.type === 'list_folders') {
                const folders = await listFoldersFromDrive();

                if (folders.length === 0) {
                    await replyToUser(msg, contact, senderName, 'belum ada folder di Google Drive.');
                    break;
                }

                const lines = folders.map((folder, index) =>
                    `${index + 1}. *${folder.name}*\n` +
                    `${folder.photos} foto · ${folder.videos} video · ${folder.total} item\n` +
                    `${folder.webViewLink}`
                );

                logInteraction('OUTGOING', `reply=list_folders | to=${senderName} | count=${folders.length}`);
                await replyToUser(msg, contact, senderName, `*Daftar Folder Dokumentasi:*\n\n${lines.join('\n\n')}`);
                break;
            }
            if (documentationCommand.type === 'remove_folder') {
                const removed = await removeFolder(documentationCommand.name);
                logInteraction('OUTGOING', `reply=remove_folder | to=${senderName} | folder=${removed.name}`);
                await replyToUser(msg, contact, senderName, `folder *${removed.name}* berhasil dihapus dari Google Drive.`);
                break;
            }
            break;
        }

        case 'buat jadwal':
        case 'jadwal absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            if (attendanceCommand.type === 'schedule_prompt') {
                conversationStates.set(getConversationKey(senderIdentity, from), { type: 'schedule', step: 'date', data: {} });
                await replyToUser(msg, contact, senderName, 'untuk tanggal berapa? Contoh: `21-05-2026`.');
                break;
            }

            const result = createScheduleFromData(attendanceCommand, from, senderName);
            if (result.error) {
                await replyToUser(msg, contact, senderName, 'format jadwal belum benar. Contoh lengkap: `buat jadwal,21-05-2026,13.00-17.00,pertemuan ketiga`.');
                break;
            }

            scheduleAttendanceReminder(client, result.session, from);
            const closeText = result.session.endTime ? ` sampai ${result.session.endTime.replace(':', '.')} WIB` : '';
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(result.session)}* terbuat untuk ${formatDateKey(result.session.dateKey)} pukul ${result.session.startTime.replace(':', '.')} WIB${closeText}. Lihat semua jadwal dengan *liat jadwal*.`);
            break;
        }

        case 'liat jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            await replyToUser(msg, contact, senderName, formatScheduleList());
            break;
        }

        case 'hapus jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const attendance = loadAttendance();
            const { sessions, activeByChat } = getAttendanceMeta(attendance);
            const session = findScheduleByQuery(attendanceCommand.query, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'jadwal tidak ditemukan. Pakai nomor dari `liat jadwal`, tanggal, atau nama jadwal.');
                break;
            }
            delete sessions[session.id];
            for (const [scope, sessionId] of Object.entries(activeByChat)) {
                if (sessionId === session.id) delete activeByChat[scope];
            }
            saveAttendance(attendance);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(session)}* sudah dihapus.`);
            break;
        }

        case 'ubah jadwal': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const session = findScheduleByQuery(attendanceCommand.query, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'jadwal tidak ditemukan. Contoh: `ubah jadwal,1,nama,pertemuan 4`.');
                break;
            }
            const field = attendanceCommand.field;
            const value = attendanceCommand.value;
            if (['tanggal', 'date'].includes(field)) {
                const dateKey = normalizeDateInput(value);
                if (!dateKey) {
                    await replyToUser(msg, contact, senderName, 'format tanggal belum benar. Contoh: `ubah jadwal,1,tanggal,21-05-2026`.');
                    break;
                }
                session.dateKey = dateKey;
            } else if (['jam', 'jam absen', 'absen', 'mulai'].includes(field)) {
                const startTime = normalizeTimeInput(value);
                if (!startTime) {
                    await replyToUser(msg, contact, senderName, 'format jam belum benar. Contoh: `ubah jadwal,1,jam,13.00`.');
                    break;
                }
                session.startTime = startTime;
            } else if (['close', 'close absen', 'tutup'].includes(field)) {
                if (isSkipValue(value)) delete session.endTime;
                else {
                    const endTime = normalizeTimeInput(value);
                    if (!endTime) {
                        await replyToUser(msg, contact, senderName, 'format close absen belum benar. Contoh: `ubah jadwal,1,close,17.00`.');
                        break;
                    }
                    session.endTime = endTime;
                }
            } else if (['nama', 'judul', 'pertemuan'].includes(field)) {
                session.title = value;
            } else {
                await replyToUser(msg, contact, senderName, 'field yang bisa diubah: `tanggal`, `jam`, `close`, `nama`.');
                break;
            }
            saveAttendanceSession(session);
            await replyToUser(msg, contact, senderName, `jadwal diperbarui:\n${formatScheduleList()}`);
            break;
        }

        case 'jam absen':
        case 'close absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }
            const attendance = loadAttendance();
            const session = findOpenSessionForChat(attendance, from) || findRelevantSessionForExcuse(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'belum ada jadwal yang bisa diubah. Buat dulu dengan `buat jadwal`.');
                break;
            }
            const timeValue = normalizeTimeInput(attendanceCommand.value);
            if (!timeValue) {
                await replyToUser(msg, contact, senderName, `format jam belum benar. Contoh: \`${primaryCommand},17.00\`.`);
                break;
            }
            if (primaryCommand === 'jam absen') session.startTime = timeValue;
            else session.endTime = timeValue;
            saveAttendanceSession(session);
            await replyToUser(msg, contact, senderName, `jadwal *${getSessionTitle(session)}* diperbarui.\n${formatScheduleList()}`);
            break;
        }
        case 'buka absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const session = openAttendanceSession(from, attendanceCommand.title);
            const closeText = session.endTime ? ` sebelum pukul ${session.endTime.replace(':', '.')} WIB` : ' sebelum absen ditutup';
            await sendBotNotice(client, `*Absen Dibuka*\n\nAbsen untuk jadwal *${getSessionTitle(session)}* telah dibuka. Silakan ketik *hadir* di grup${closeText}.`);
            await replyToUser(msg, contact, senderName, `sesi absen *${getSessionTitle(session)}* sudah dibuka. Anggota hanya bisa absen dari grup dengan command *hadir*.`);
            break;
        }

        case 'tutup absen': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const session = closeAttendanceSession(from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'tidak ada sesi absen yang sedang dibuka.');
                break;
            }

            await sendBotNotice(client, `*Absen Ditutup*\n\nAbsen untuk jadwal *${getSessionTitle(session)}* telah ditutup. Terima kasih.`);
            await replyToUser(msg, contact, senderName, `sesi absen *${getSessionTitle(session)}* ditutup.\n\n${formatAttendanceSessionReport(session)}`);
            break;
        }

        case 'hapus hadir': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'command ini khusus admin hadir.');
                break;
            }

            const result = removeAttendanceFromSession(from, attendanceCommand.query);
            if (result.status === 'no_session') {
                await replyToUser(msg, contact, senderName, 'belum ada sesi absen aktif/terjadwal untuk dikoreksi.');
                break;
            }
            if (result.status === 'not_found') {
                await replyToUser(msg, contact, senderName, `nama/npm/lid *${attendanceCommand.query}* tidak ditemukan di daftar hadir sesi *${getSessionTitle(result.session)}*.`);
                break;
            }

            const removedType = result.type === 'izin' ? 'daftar izin' : 'daftar hadir';
            await replyToUser(msg, contact, senderName, `*${result.removed.name}* dihapus dari ${removedType} sesi *${getSessionTitle(result.session)}*.`);
            break;
        }

        case 'izin': {
            const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });
            if (matchedMembers.length === 0) {
                await replyToUser(msg, contact, senderName, 'data kamu belum terdaftar, jadi izin belum bisa dicatat. Hubungi pengurus/admin hadir.');
                break;
            }
            if (matchedMembers.length > 1) {
                await replyToUser(msg, contact, senderName, 'data kamu terdeteksi lebih dari satu profil. Hubungi admin agar data dirapikan dulu.');
                break;
            }

            const attendance = loadAttendance();
            const session = findRelevantSessionForExcuse(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'belum ada jadwal/sesi absen yang bisa menerima izin. Tunggu admin hadir menjadwalkan pertemuan dulu.');
                break;
            }

            const proof = msg.mediaInfo ? {
                hasMedia: true,
                type: msg.mediaInfo.type,
                fileName: msg.mediaInfo.fileName,
                mimetype: msg.mediaInfo.mimetype,
            } : null;
            const result = recordExcuseInSession(session.id, matchedMembers[0], senderIdentity, attendanceCommand.reason, proof);
            await replyToUser(msg, contact, senderName, `izin kamu untuk *${getSessionTitle(result.session)}* sudah ${result.status === 'updated' ? 'diperbarui' : 'dicatat'}. Alasan: ${result.record.reason}${proof ? '\nBukti media terdeteksi.' : ''}`);
            break;
        }

        case 'daftar izin': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                await replyToUser(msg, contact, senderName, 'rekap izin hanya bisa dilihat oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const { sessions } = getAttendanceMeta(attendance);
            const matchedSessions = Object.values(sessions).filter((session) => session.dateKey === attendanceCommand.dateKey);
            if (matchedSessions.length === 0) {
                await replyToUser(msg, contact, senderName, `belum ada sesi izin pada ${formatDateKey(attendanceCommand.dateKey)}.`);
                break;
            }

            const lines = matchedSessions.map((session) => {
                const excuses = getSessionExcuses(session);
                const detail = excuses.length
                    ? excuses.map((record, index) => `${index + 1}. ${record.name || '-'} - ${record.reason || '-'}${record.proof ? ' (ada bukti)' : ''}`).join('\n')
                    : 'Belum ada izin.';
                return `*${getSessionTitle(session)}*\n${detail}`;
            });
            await replyToUser(msg, contact, senderName, `*Daftar Izin - ${formatDateKey(attendanceCommand.dateKey)}*\n\n${lines.join('\n\n')}`);
            break;
        }
        case 'menu':
            await handleGeneralCommand({ command: primaryCommand, msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets });
            break;

        case 'hadir': {
            if (!isGroup) {
                await replyToUser(msg, contact, senderName, 'absen hadir hanya bisa dilakukan di grup saat sesi absen dibuka oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const session = findOpenSessionForChat(attendance, from);
            if (!session) {
                await replyToUser(msg, contact, senderName, 'sesi absen belum dibuka. Tunggu admin hadir membuka sesi dengan command *buka absen*.');
                break;
            }

            const nowMs = Date.now();
            const opensAt = parseWibDateTime(session.dateKey, session.startTime);
            const closesAt = session.endTime ? parseWibDateTime(session.dateKey, session.endTime) : null;
            if (opensAt && nowMs < opensAt.getTime()) {
                await replyToUser(msg, contact, senderName, `akses absen untuk *${getSessionTitle(session)}* belum dimulai. Mulai pukul ${session.startTime.replace(':', '.')} WIB.`);
                break;
            }
            if (closesAt && nowMs > closesAt.getTime()) {
                closeAttendanceSession(from);
                await replyToUser(msg, contact, senderName, `akses absen untuk *${getSessionTitle(session)}* sudah ditutup pukul ${session.endTime.replace(':', '.')} WIB.`);
                break;
            }

            const matchedMembers = findMembersByIdentity(senderIdentity, { allowNameFallback: true });
            if (matchedMembers.length === 0) {
                logInteraction('OUTGOING', 'reply=attendance_not_registered | to=' + senderName + ' | lid=' + (senderIdentity.lid || '-') + ' | names=' + (senderIdentity.names.join('|') || '-'));
                await replyToUser(msg, contact, senderName, 'data kamu belum terdaftar, jadi kehadiran belum bisa dicatat. Hubungi pengurus/admin hadir.');
                break;
            }

            if (matchedMembers.length > 1) {
                await replyToUser(msg, contact, senderName, 'data kamu terdeteksi lebih dari satu profil. Hubungi admin agar data dirapikan dulu.');
                break;
            }

            const attendanceResult = recordAttendanceInSession(session.id, matchedMembers[0], senderIdentity);
            if (attendanceResult.status === 'exists') {
                await replyToUser(msg, contact, senderName, 'kehadiran kamu sudah tercatat pada ' + (attendanceResult.record.time || '-') + ' WIB untuk sesi *' + getSessionTitle(session) + '*.');
                break;
            }

            await replyToUser(msg, contact, senderName, 'kehadiran berhasil dicatat untuk sesi *' + getSessionTitle(session) + '* pukul ' + attendanceResult.record.time + ' WIB.');
            break;
        }

        case 'daftar hadir': {
            if (!hasLidRole(senderIdentity, HADIR_LID)) {
                logInteraction('OUTGOING', 'reply=attendance_report_admin_only | to=' + senderName);
                await replyToUser(msg, contact, senderName, 'rekap daftar hadir hanya bisa dilihat oleh admin hadir.');
                break;
            }

            const attendance = loadAttendance();
            const { sessions } = getAttendanceMeta(attendance);

            if (!attendanceReportCommand.hasExplicitDate) {
                const activeSession = findOpenSessionForChat(attendance, from);
                if (activeSession) {
                    await replyToUser(msg, contact, senderName, formatAttendanceSessionReport(activeSession));
                    break;
                }
            }

            const matchedSessions = Object.values(sessions).filter((session) => session.dateKey === attendanceReportCommand.dateKey);
            if (matchedSessions.length > 0) {
                await replyToUser(msg, contact, senderName, matchedSessions.map(formatAttendanceSessionReport).join('\n\n'));
                break;
            }

            logInteraction('OUTGOING', 'reply=attendance_report_legacy | to=' + senderName + ' | date=' + attendanceReportCommand.dateKey);
            await replyToUser(msg, contact, senderName, formatAttendanceReport(attendanceReportCommand.dateKey));
            break;
        }
        case 'link':
            await handleGeneralCommand({ command: primaryCommand, msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets });
            break;
        case 'info': {
            await handleRegistrationCommand({ command: primaryCommand, msg, contact, senderName, senderIdentity, senderPhone, from, registerCommand, addCommand, conversationStates, getConversationKey, findMembersByIdentity, logInteraction, replyToUser });
            break;
        }
        case 'daftar': {
            await handleRegistrationCommand({ command: primaryCommand, msg, contact, senderName, senderIdentity, senderPhone, from, registerCommand, addCommand, conversationStates, getConversationKey, findMembersByIdentity, logInteraction, replyToUser });
            break;
        }
        case 'pemateri':
            await handlePemateriCommand({ command: primaryCommand, msg, contact, senderName, senderIdentity, findPrimaryMemberByIdentity, logInteraction, replyToUser });
            break;
        case 'codeflowchallenge':
            await handleGeneralCommand({ command: primaryCommand, msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets });
            break;
        case 'aspek penilaian':
            await handleGeneralCommand({ command: primaryCommand, msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets });
            break;
        case 'jadwalku': {
            await handlePemateriCommand({ command: primaryCommand, msg, contact, senderName, senderIdentity, findPrimaryMemberByIdentity, logInteraction, replyToUser });
            break;
        }
        case 'add': {
            await handleRegistrationCommand({ command: primaryCommand, msg, contact, senderName, senderIdentity, senderPhone, from, registerCommand, addCommand, conversationStates, getConversationKey, findMembersByIdentity, logInteraction, replyToUser });
            break;
        }

        case 'sirpai': {
            await handleFunCommand({ command: primaryCommand, msg, client, contact, senderName, senderPhone, isGroup, from, logInteraction, replyToUser });
            break;
        }
        case 'logo': {
            await handleGeneralCommand({ command: primaryCommand, msg, contact, senderName, logInteraction, replyToUser, getMentionHandle, getMentionTargets });
            break;
        }
        case 'upin ipin': {
            await handleFunCommand({ command: primaryCommand, msg, client, contact, senderName, senderPhone, isGroup, from, logInteraction, replyToUser });
            break;
        }
        case 'cek lid': {
            if (!isAdminUser(senderPhone, msg)) {
                logInteraction('SKIP', `${chatType} | from=${senderName} | reason=cek_lid_admin_only`);
                break;
            }

            const mentionedIds = msg.mentionedIds || [];
            if (mentionedIds.length === 0) {
                await replyToUser(msg, contact, senderName, 'tag anggota yang mau dicek LID-nya. Contoh: `cek lid @anggota`');
                break;
            }

            const lidLines = mentionedIds.map((jid) => {
                const normalized = String(jid || '').trim();
                const isLid = normalized.endsWith('@lid');
                const label = `@${normalized.split('@')[0]}`;
                return isLid
                    ? `${label} → \`${normalized}\``
                    : `${label} → _(LID tidak tersedia, hanya phone)_`;
            });

            logInteraction('OUTGOING', `reply=cek_lid | to=${senderName} | count=${mentionedIds.length}`);

            const sentMsg = await replyToUser(msg, contact, senderName, `*Hasil Cek LID:*\n\n${lidLines.join('\n')}`);

            // Hapus pesan bot setelah 10 detik
            // setTimeout(async () => {
            //     try {
            //         await client.sock.sendMessage(msg.from, {
            //             delete: sentMsg.key,
            //         });

            //         await client.sock.sendMessage(msg.from, {
            //             delete: msg.key,
            //         });

            //         logInteraction('OUTGOING', `delete=cek_lid | to=${senderName}`);
            //     } catch (err) {
            //         logInteraction('WARN', `delete=cek_lid_failed | reason=${err.message}`);
            //     }
            // }, 15 * 1000);

            break;
        }
        case 'min ukm di um apa aja ni?': {
            await handleFunCommand({ command: primaryCommand, msg, client, contact, senderName, senderPhone, isGroup, from, logInteraction, replyToUser });
            break;
        }
        case 'reset': {
            if (isGroup) break;
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) break;

            const lid = senderIdentity.lid;
            const queue = getUploadQueue(lid);

            if (!queue || queue.items.length === 0) {
                await client.sock.sendMessage(from, { text: '⚠️ Tidak ada sesi upload yang aktif.' });
                break;
            }

            const foto = queue.items.filter(i => i.type === 'foto').length;
            const video = queue.items.filter(i => i.type === 'video').length;
            clearUploadQueue(lid);
            await client.sock.sendMessage(from, { text: `🗑️ Sesi dibatalkan. ${foto} foto dan ${video} video telah dihapus dari memory.` });
            break;
        }



        case 'ya':
        case 'upload foto':
        case 'upload video': {
            if (isGroup) break;
            if (!hasLidRole(senderIdentity, DOKUMENTASI_LID)) break;

            const lid = senderIdentity.lid;
            const queue = getUploadQueue(lid);

            if (!queue || queue.items.length === 0) {
                await client.sock.sendMessage(from, { text: 'Tidak ada file yang tertampung. Silakan kirim file terlebih dahulu.' });
                break;
            }

            let toUpload = queue.items;
            if (body === 'upload foto') toUpload = queue.items.filter(i => i.type === 'foto');
            if (body === 'upload video') toUpload = queue.items.filter(i => i.type === 'video');

            if (toUpload.length === 0) {
                await client.sock.sendMessage(from, { text: `Tidak ada ${body === 'upload foto' ? 'foto' : 'video'} yang tertampung.` });
                break;
            }

            clearUploadQueue(lid);
            await client.sock.sendMessage(from, { text: `⏳ Mengupload ${toUpload.length} file ke Google Drive...` });

            try {
                const { folder, results } = await uploadMediaBatch(from, toUpload);
                const lines = [];
                if (results.foto.length) lines.push(`✅ ${results.foto.length} foto berhasil diupload`);
                if (results.video.length) lines.push(`✅ ${results.video.length} video berhasil diupload`);
                if (results.gagal.length) lines.push(`❌ ${results.gagal.length} file gagal: ${results.gagal.join(', ')}`);

                await client.sock.sendMessage(from, {
                    text: `*Upload selesai ke folder ${folder.name}*\n\n${lines.join('\n')}`
                });
                logInteraction('OUTGOING', `reply=upload_batch_done | to=${senderName} | foto=${results.foto.length} | video=${results.video.length} | gagal=${results.gagal.length}`);
            } catch (error) {
                await client.sock.sendMessage(from, { text: `❌ Gagal upload: ${getDriveErrorMessage(error)}` });
                logInteraction('OUTGOING', `reply=upload_batch_error | to=${senderName} | error=${error.message}`);
            }

            break;
        }

        default:
            logInteraction('SKIP', `${chatType} | from=${senderName} | reason=unknown_command`);
            break;
    }
}

module.exports = { handleMessage };
