// commands/admin/reset.js — Xóa trắng tài khoản. Yêu cầu flag --confirm.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'reset',
    description: 'Admin: Xóa trắng tài khoản. Cú pháp: !reset @user --confirm',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const target     = message.mentions.users.first();
        const hasConfirm = args.includes('--confirm');

        if (!target)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!reset @user --confirm`')] });

        if (!hasConfirm)
            return message.reply({
                embeds: [
                    Embed.warning('Xác Nhận Reset Tài Khoản')
                        .setDescription(
                            `⚠️ Bạn sắp **xóa trắng** toàn bộ dữ liệu của **${target.username}**!\n` +
                            `Hành động này **không thể hoàn tác**.\n\n` +
                            `Gõ lại: \`!reset @${target.username} --confirm\``
                        ),
                ],
            });

        const targetData = await User.findOne({ userId: target.id }).lean();
        if (!targetData)
            return message.reply({ embeds: [Embed.error('Không Tìm Thấy', 'Người dùng chưa có dữ liệu trong hệ thống.')] });

        const oldBalance = targetData.balance;

        await processTransaction(target.id, -oldBalance, 'ADMIN_RESET',
            `Admin ${message.author.username} reset tài khoản — số dư cũ: ${oldBalance}`,
            { guildId: message.guild?.id }
        );
        await User.updateOne({ userId: target.id }, {
            $set: {
                balance: 0, lastWork: null, lastDaily: null, lastClaim: null,
                isLocked: false, lockedAt: null, owoDailyCount: 0, owoResetDate: null,
            },
        });

        return message.reply({
            embeds: [
                Embed.admin('Tài Khoản Đã Được Reset')
                    .addFields(
                        { name: '👤 Người chơi',      value: target.username,        inline: true },
                        { name: '💰 Số dư cũ',        value: `${fmt(oldBalance)} xu`, inline: true },
                        { name: '📊 Số dư mới',       value: `0 xu`,                 inline: true },
                    )
                    .setDescription('✅ Toàn bộ dữ liệu đã được xóa và ghi vào audit log.'),
            ],
        });
    },
};
