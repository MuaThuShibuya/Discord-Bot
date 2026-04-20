// commands/casino/coinflip.js
// Lật đồng xu tỉ lệ 50/50 — dùng crypto RNG, mutex lock bảo vệ.
// Alias: !cf

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');

module.exports = {
    name: 'coinflip',
    aliases: ['cf'],
    description: 'Lật đồng xu 50/50 — thắng x2. Cú pháp: !cf <số_tiền>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!cf <số_tiền>`')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        try {
            const isWin   = secureRandom(0, 1) === 1;
            const guildId = message.guild?.id;

            if (isWin) {
                const updated = await processTransaction(userData.userId, betAmount, 'BET_WIN', 'Thắng Coinflip', { guildId });
                return message.reply({
                    embeds: [
                        Embed.win('NGỬA — Bạn Thắng! 🪙', null, betAmount)
                            .setDescription(
                                `🌕 Đồng xu lật ra **NGỬA**!\n\n` +
                                `✅ **+${fmt(betAmount)} xu**\n` +
                                balanceChange(userData.balance, updated.balance)
                            ),
                    ],
                });
            } else {
                const updated = await processTransaction(userData.userId, -betAmount, 'BET_LOSS', 'Thua Coinflip', { guildId });
                return message.reply({
                    embeds: [
                        Embed.lose('SẤP — Bạn Thua! 🪙', null, betAmount)
                            .setDescription(
                                `🌑 Đồng xu lật ra **SẤP**!\n\n` +
                                `❌ **-${fmt(betAmount)} xu**\n` +
                                balanceChange(userData.balance, updated.balance)
                            ),
                    ],
                });
            }
        } finally {
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
        }
    },
};
