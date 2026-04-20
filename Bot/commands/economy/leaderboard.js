// commands/economy/leaderboard.js
// Bảng xếp hạng top 10 đại gia — dùng compound index { isBlacklisted, balance } để sort nhanh.
// Alias: !lb

const { EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');
const { COLORS, fmt } = require('../../utils/embed');

const MEDALS  = ['🥇', '🥈', '🥉'];
const NUMBERS = ['4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

module.exports = {
    name: 'leaderboard',
    aliases: ['lb'],
    description: 'Bảng xếp hạng Top 10 đại gia server.',

    async execute(message, args, client, userData) {
        const topUsers = await User.find({ isBlacklisted: false })
            .sort({ balance: -1 })
            .limit(10)
            .lean();

        if (!topUsers.length)
            return message.reply('📊 Chưa có dữ liệu người chơi nào.');

        // Tìm vị trí của người gọi lệnh (kể cả ngoài top 10)
        const callerRank = await User.countDocuments({
            isBlacklisted: false,
            balance: { $gt: userData.balance },
        }) + 1;

        const rows = topUsers.map((u, i) => {
            const icon    = MEDALS[i] ?? NUMBERS[i - 3];
            const isSelf  = u.userId === message.author.id;
            const name    = isSelf ? `**${message.author.username} ← Bạn**` : `<@${u.userId}>`;
            return `${icon} ${name}\n┗ 💰 **${fmt(u.balance)} xu**`;
        });

        const embed = new EmbedBuilder()
            .setColor(COLORS.CASINO)
            .setTitle('🏆  Bảng Xếp Hạng — Top 10 Đại Gia')
            .setDescription(rows.join('\n\n'))
            .setThumbnail(message.guild?.iconURL({ dynamic: true }) ?? null)
            .setTimestamp()
            .setFooter({
                text: callerRank <= 10
                    ? `Bạn đang ở hạng #${callerRank}`
                    : `Bạn đang ở hạng #${callerRank} — Cần ${fmt(topUsers[9].balance - userData.balance + 1)} xu để vào Top 10`,
            });

        return message.reply({ embeds: [embed] });
    },
};
