// commands/economy/pay.js
// Chuyển tiền giữa hai người dùng — dùng MongoDB ACID Session (all-or-nothing).

const { processTransaction, withDbTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'pay',
    description: 'Chuyển tiền cho người chơi khác. Cú pháp: !pay @user <số_tiền>',

    async execute(message, args, client, userData) {
        const targetUser = message.mentions.users.first();
        const amount     = parseInt(args[1]);

        if (!targetUser || isNaN(amount) || amount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!pay @user <số_tiền>`')] });
        if (targetUser.bot)
            return message.reply({ embeds: [Embed.error('Không Hợp Lệ', 'Không thể chuyển tiền cho bot.')] });
        if (targetUser.id === message.author.id)
            return message.reply({ embeds: [Embed.error('Không Hợp Lệ', 'Không thể tự chuyển khoản cho chính mình.')] });
        if (userData.balance < amount)
            return message.reply({
                embeds: [Embed.error('Không Đủ Tiền', `Số dư của bạn chỉ có **${fmt(userData.balance)} xu**.`)],
            });

        const guildId = message.guild?.id;
        const reason  = `${message.author.username} → ${targetUser.username}`;

        await withDbTransaction(async (session) => {
            await processTransaction(userData.userId, -amount, 'TRANSFER_OUT', reason, { session, guildId });
            await processTransaction(targetUser.id,   +amount, 'TRANSFER_IN',  reason, { session, guildId });
        });

        return message.reply({
            embeds: [
                Embed.success('Chuyển Khoản Thành Công')
                    .addFields(
                        { name: '📤 Người gửi',   value: `${message.author.username}`,        inline: true },
                        { name: '📥 Người nhận',  value: `${targetUser.username}`,             inline: true },
                        { name: '💸 Số tiền',     value: `**${fmt(amount)} xu**`,              inline: true },
                        { name: '💰 Số dư còn lại', value: `${fmt(userData.balance - amount)} xu`, inline: true },
                    ),
            ],
        });
    },
};
