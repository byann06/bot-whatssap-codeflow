function formatPemateriSchedule(schedules = []) {
    const sections = schedules.map((schedule) => {
        const speakerLines = (schedule.speakers || [])
            .map((speaker, index) => `${index + 1}. ${speaker.name || '-'}`)
            .join('\n');

        return `*Pertemuan ${schedule.week}:*\n${speakerLines}`;
    });

    return `*Susunan Pemateri Gen 2*\n\n${sections.join('\n\n')}`;
}

function formatMeetingForUser(schedule, lookupName) {
    const normalizedLookupName = String(lookupName || '').trim().toLowerCase();
    const lines = (schedule.speakers || []).map((speaker, index) => {
        const speakerName = String(speaker.name || '-').trim() || '-';
        const isCurrentUser = speakerName.toLowerCase() === normalizedLookupName;
        const displayName = isCurrentUser ? `*${speakerName}*` : speakerName;
        return `${index + 1}. ${displayName}`;
    });

    return `Pertemuan ${schedule.week}:\n${lines.join('\n')}`;
}

function formatMemberInfo(member, index = null) {
    const title = index ? `*Informasi Akun ${index}*` : '*Informasi Akun Anggota*';
    return [
        title,
        `>> Nama : ${member.name || '-'}`,
        `>> NPM : ${member.npm || '-'}`,
        `>> Prodi : ${member.studyProgram || '-'}`,
        `>> Role : ${member.role || '-'}`,
        `>> Pengurus : ${member.managementRole || '-'}`,
        `>> Nomor Untuk Dihubungi : ${member.phone || '-'}`,
        `>> Berikan saran : ${member.suggestion || '-'}`,
    ].join('\n');
}

function buildPemateriReminderText(recipientName, week) {
    return [
        `Halo ${recipientName},`,
        `ini pengingat bahwa kamu terjadwal sebagai pemateri Pertemuan ${week} di Code Flow Community.`,
        'Mohon pelajari materi yg sudah dikirim dan pantau grup untuk informasi lanjutan dari admin.',
    ].join('\n');
}

module.exports = {
    formatPemateriSchedule,
    formatMeetingForUser,
    formatMemberInfo,
    buildPemateriReminderText,
};