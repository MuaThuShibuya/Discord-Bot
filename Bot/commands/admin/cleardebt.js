// commands/admin/cleardebt.js
// Gỡ lệnh siết nợ và xóa nợ cho người chơi
// Cú pháp: !cleardebt @user

const User = require('../../database/models/User');
const { Embed } = require('../../utils/embed');

module.exports = {
    name: 'cleardebt',
    aliases: ['gocam', 'pardondebt'],
    description: 'Xóa nợ và gỡ cấm (siết nợ) cho người chơi. Cú pháp: !cleardebt @user',

    async execute(message, args, client, userData, guildConfig) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply({ embeds: [Embed.error('Thiếu Quyền', 'Chỉ Administrator mới có thể dùng lệnh này.')] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', 'Vui lòng tag người dùng: `!cleardebt @user`')] });
        }

        const targetData = await User.findOne({ userId: targetUser.id });
        if (!targetData) {
            return message.reply('Người dùng này chưa có tài khoản trong hệ thống.');
        }

        await User.updateOne({ userId: targetUser.id }, {
            $set: { loanAmountDue: 0, loanDueDate: null }
        });

        message.reply({ embeds: [Embed.success('Đã Xoá Nợ 🛡️', `Đã xóa nợ và mở khóa tài khoản thành công cho <@${targetUser.id}>.`)] });
    }
};