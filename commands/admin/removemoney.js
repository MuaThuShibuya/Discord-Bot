// commands/admin/removemoney.js — Admin trừ tiền người chơi vi phạm.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'removemoney',
    description: 'Admin: Trừ tiền. Cú pháp: !removemoney @user <số_tiền>',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0 || target.bot)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!removemoney @user <số_tiền>`')] });

        const targetData = await User.findOne({ userId: target.id }).lean();
        if (!targetData)
            return message.reply({ embeds: [Embed.error('Không Tìm Thấy', 'Người dùng chưa có dữ liệu trong hệ thống.')] });

        const actual  = Math.min(amount, targetData.balance);
        const updated = await processTransaction(
            target.id, -actual, 'ADMIN_REMOVE',
            `Admin ${message.author.username} trừ tiền`, { guildId: message.guild?.id }
        );

        return message.reply({
            embeds: [
                Embed.admin('Trừ Tiền Thành Công')
                    .addFields(
                        { name: '👤 Người bị trừ', value: target.username,             inline: true },
                        { name: '💸 Đã trừ',        value: `-${fmt(actual)} xu`,       inline: true },
                        { name: '📊 Số dư còn lại', value: `${fmt(updated.balance)} xu`, inline: true },
                    )
                    .setDescription(actual < amount
                        ? `⚠️ Chỉ trừ được **${fmt(actual)} xu** do số dư không đủ.`
                        : null),
            ],
        });
    },
};
