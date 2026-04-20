// commands/admin/blacklist.js — Toggle cấm/mở cấm người chơi.

const User = require('../../database/models/User');
const { Embed } = require('../../utils/embed');

module.exports = {
    name: 'blacklist',
    description: 'Admin: Cấm/Mở cấm người chơi. Cú pháp: !blacklist @user',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const target = message.mentions.users.first();
        if (!target || target.bot)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!blacklist @user`')] });

        // Pipeline update để toggle atomic — không race condition
        const updated = await User.findOneAndUpdate(
            { userId: target.id },
            [{ $set: { isBlacklisted: { $not: '$isBlacklisted' } } }],
            { new: true, upsert: true }
        );

        const banned = updated.isBlacklisted;
        return message.reply({
            embeds: [
                Embed.admin(banned ? 'Đã Thêm Vào Danh Sách Đen' : 'Đã Xóa Khỏi Danh Sách Đen')
                    .setDescription(
                        banned
                            ? `🔴 **${target.username}** đã bị **cấm** sử dụng bot.`
                            : `🟢 **${target.username}** đã được **mở cấm** và có thể dùng bot trở lại.`
                    ),
            ],
        });
    },
};
