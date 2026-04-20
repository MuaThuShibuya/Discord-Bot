// commands/casino/slots.js
// Máy đánh bạc 3 ô — hiệu ứng "đang quay" bằng cách gửi rồi edit message.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');

const SYMBOLS = [
    { icon: '🍎', weight: 30 },
    { icon: '🍊', weight: 25 },
    { icon: '🍋', weight: 20 },
    { icon: '🍒', weight: 15 },
    { icon: '💎', weight: 7  },
    { icon: '7️⃣', weight: 3  },
];

// Rút biểu tượng theo trọng số (7️⃣ hiếm hơn 🍎)
function weightedPick() {
    const total  = SYMBOLS.reduce((s, x) => s + x.weight, 0);
    let roll     = secureRandom(1, total);
    for (const sym of SYMBOLS) {
        roll -= sym.weight;
        if (roll <= 0) return sym.icon;
    }
    return SYMBOLS[0].icon;
}

const MULTIPLIERS = { 5: '**x5** 🎯 JACKPOT!', 1.5: '**x1.5**' };

module.exports = {
    name: 'slots',
    description: 'Quay hũ xèng — 2 trùng x1.5 | 3 trùng x5 Jackpot. Cú pháp: !slots <số_tiền>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!slots <số_tiền>`')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        // Hiệu ứng đang quay — gửi trước, edit sau
        const spinning = await message.reply({
            embeds: [
                Embed.casino('SLOTS MACHINE', null, betAmount)
                    .setDescription('┃ 🔄 ┃ 🔄 ┃ 🔄 ┃\n\n_Đang quay..._'),
            ],
        });

        try {
            const result = [weightedPick(), weightedPick(), weightedPick()];
            const [a, b, c] = result;

            let multiplier = 0;
            if (a === b && b === c)      multiplier = 5;
            else if (a === b || b === c || a === c) multiplier = 1.5;

            const slotDisplay = `┃ ${a} ┃ ${b} ┃ ${c} ┃`;
            const guildId = message.guild?.id;

            if (multiplier > 0) {
                const winAmount = Math.floor(betAmount * multiplier);
                const updated   = await processTransaction(
                    userData.userId, winAmount - betAmount, 'BET_WIN',
                    `Thắng Slots ${MULTIPLIERS[multiplier]}`, { guildId }
                );
                await spinning.edit({
                    embeds: [
                        Embed.win(`SLOTS — ${MULTIPLIERS[multiplier]}`, null, betAmount)
                            .setDescription(
                                `${slotDisplay}\n\n` +
                                `🎉 **+${fmt(winAmount)} xu**\n` +
                                balanceChange(userData.balance, updated.balance)
                            ),
                    ],
                });
            } else {
                const updated = await processTransaction(userData.userId, -betAmount, 'BET_LOSS', 'Thua Slots', { guildId });
                await spinning.edit({
                    embeds: [
                        Embed.lose('SLOTS — Không Trùng', null, betAmount)
                            .setDescription(
                                `${slotDisplay}\n\n` +
                                `💀 **-${fmt(betAmount)} xu**\n` +
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
