// commands/admin/unlock.js
// Mở khóa (gỡ Mutex Lock) cho người dùng bị kẹt. 
// Hỗ trợ chế độ TẮT KIỂM TRA TRÙNG GAME (Bypass Lock) để Admin test nhiều game cùng lúc.
// Cú pháp: !unlock [@user]

const User = require('../../database/models/User');
const { Embed } = require('../../utils/embed');

module.exports = {
    name: 'unlock',
    aliases: ['mokhoa'],
    description: 'Admin: Mở khóa tài khoản hoặc Bật/Tắt chế độ test trùng game. Cú pháp: !unlock [@user]',

    async execute(message, args) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        // Nếu không tag ai, tự động áp dụng cho bản thân người gõ lệnh (Admin)
        const target = message.mentions.users.first() || message.author;
        if (target.bot) return;

        let userData = await User.findOne({ userId: target.id });
        if (!userData) {
            return message.reply({ embeds: [Embed.error('Lỗi', 'Người dùng này chưa có dữ liệu trong hệ thống.')] });
        }

        // Đảo ngược trạng thái ignoreLock hiện tại
        const newIgnoreLock = !userData.ignoreLock;

        await User.updateOne(
            { userId: target.id }, 
            { $set: { isLocked: false, lockedAt: null, ignoreLock: newIgnoreLock } }
        );

        if (newIgnoreLock) {
            return message.reply({
                embeds: [Embed.success('Đã Tắt Khóa Game (Test Mode)', `Đã **mở khóa** và **TẮT** chức năng chống trùng game cho <@${target.id}>.\nBây giờ bạn có thể spam lệnh mở nhiều game cùng lúc để test.`)]
            });
        } else {
            return message.reply({
                embeds: [Embed.success('Đã Bật Lại Khóa Game', `Đã **mở khóa** và **BẬT LẠI** chức năng chống trùng game (Mutex Lock) cho <@${target.id}> an toàn.`)]
            });
        }
    },
};