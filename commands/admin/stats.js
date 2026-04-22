// commands/admin/stats.js — Thống kê tổng quan hệ thống bằng MongoDB aggregation.

const { EmbedBuilder } = require('discord.js');
const User        = require('../../database/models/User');
const Transaction = require('../../database/models/Transaction');
const { COLORS, fmt } = require('../../utils/embed');

module.exports = {
    name: 'stats',
    description: 'Admin: Thống kê tổng quan hệ thống.',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [new EmbedBuilder().setColor(COLORS.ERROR).setDescription('❌ Yêu cầu quyền **Administrator**.')] });

        // 3 aggregation chạy song song để tối ưu thời gian
        const [agg, txCount, richest] = await Promise.all([
            User.aggregate([{
                $group: {
                    _id:          null,
                    totalUsers:   { $sum: 1 },
                    totalBalance: { $sum: '$balance' },
                    blacklisted:  { $sum: { $cond: ['$isBlacklisted', 1, 0] } },
                    locked:       { $sum: { $cond: ['$isLocked',      1, 0] } },
                },
            }]),
            Transaction.estimatedDocumentCount(),
            User.findOne({ isBlacklisted: false }).sort({ balance: -1 }).lean(),
        ]);

        const s = agg[0] ?? { totalUsers: 0, totalBalance: 0, blacklisted: 0, locked: 0 };

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ADMIN)
                    .setTitle('📊  Thống Kê Hệ Thống CasinoPro')
                    .setThumbnail(message.guild?.iconURL({ dynamic: true }) ?? null)
                    .addFields(
                        { name: '👥 Tổng người chơi',     value: fmt(s.totalUsers),                                   inline: true },
                        { name: '💰 Tiền lưu thông',      value: `${fmt(s.totalBalance)} xu`,                         inline: true },
                        { name: '📋 Giao dịch (30 ngày)', value: fmt(txCount),                                        inline: true },
                        { name: '⛔ Đang bị blacklist',   value: fmt(s.blacklisted),                                  inline: true },
                        { name: '🔒 Đang trong ván bài',  value: fmt(s.locked),                                       inline: true },
                        { name: '🏆 Người giàu nhất',     value: richest ? `<@${richest.userId}> — **${fmt(richest.balance)} xu**` : '_Chưa có_', inline: true },
                    )
                    .setFooter({ text: `Yêu cầu bởi ${message.author.username}` })
                    .setTimestamp(),
            ],
        });
    },
};
