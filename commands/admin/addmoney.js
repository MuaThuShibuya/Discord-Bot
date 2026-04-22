// commands/admin/addmoney.js — Admin bơm tiền vào tài khoản người chơi.

const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'addmoney',
    description: 'Admin: Bơm tiền. Cú pháp: !addmoney @user <số_tiền>',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0 || target.bot)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!addmoney @user <số_tiền>`')] });

        const updated = await processTransaction(
            target.id, amount, 'ADMIN_ADD',
            `Admin ${message.author.username} bơm tiền`, { guildId: message.guild?.id }
        );

        return message.reply({
            embeds: [
                Embed.admin('Bơm Tiền Thành Công')
                    .addFields(
                        { name: '👤 Người nhận', value: target.username,           inline: true },
                        { name: '💰 Số tiền',    value: `+${fmt(amount)} xu`,      inline: true },
                        { name: '📊 Số dư mới',  value: `${fmt(updated.balance)} xu`, inline: true },
                    ),
            ],
        });
    },
};
