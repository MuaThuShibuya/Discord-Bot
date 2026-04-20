// commands/casino/roulette.js
// Roulette Châu Âu (0–36) — hiệu ứng quay bằng edit message.
// Cú pháp: !roulette <số_tiền> <red|black|green|0-36>

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');

const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n) {
    if (n === 0)            return { icon: '🟢', name: 'green', label: 'XANH' };
    if (RED_NUMS.has(n))    return { icon: '🔴', name: 'red',   label: 'ĐỎ'   };
    return                         { icon: '⚫', name: 'black', label: 'ĐEN'  };
}

// Payout: red/black = x2 (net +1x), green = x14 (net +13x), số = x36 (net +35x)
function calcPayout(bet, betType, winNum) {
    const wc = getColor(winNum);
    if (['red','black','green'].includes(betType)) {
        if (betType !== wc.name) return { win: false, net: -bet, label: `x0` };
        const m = betType === 'green' ? 14 : 2;
        return { win: true, net: bet * (m - 1), label: `x${m}` };
    }
    const picked = parseInt(betType);
    if (picked === winNum) return { win: true, net: bet * 35, label: 'x36' };
    return { win: false, net: -bet, label: 'x0' };
}

// Hiển thị bánh xe roulette mini bằng text
const WHEEL = '🎡🟢🔴⚫🔴⚫🔴⚫🔴⚫🔴⚫🔴⚫🔴⚫🔴⚫🔴🟢';

module.exports = {
    name: 'roulette',
    description: 'Cò quay Châu Âu. Cú pháp: !roulette <số_tiền> <red|black|green|0–36>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);
        const betType   = args[1]?.toLowerCase();

        if (isNaN(betAmount) || betAmount <= 0 || !betType)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!roulette <số_tiền> <red|black|green|0-36>`')] });

        const isColor  = ['red','black','green'].includes(betType);
        const isNum    = !isNaN(parseInt(betType)) && parseInt(betType) >= 0 && parseInt(betType) <= 36;

        if (!isColor && !isNum)
            return message.reply({ embeds: [Embed.error('Loại Cược Không Hợp Lệ', 'Dùng `red`, `black`, `green` hoặc số **0–36**.')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        // Hiệu ứng quay
        const spinning = await message.reply({
            embeds: [
                Embed.casino('ROULETTE — Đang Quay...', null, betAmount)
                    .setDescription(`${WHEEL}\n\n🔄 _Bóng đang quay..._`),
            ],
        });

        try {
            const winNum = secureRandom(0, 36);
            const wc     = getColor(winNum);
            const { win, net, label } = calcPayout(betAmount, betType, winNum);
            const guildId = message.guild?.id;

            const betLabel = isColor ? betType.toUpperCase() : `Số ${betType}`;

            const updated = await processTransaction(
                userData.userId, net,
                win ? 'BET_WIN' : 'BET_LOSS',
                `Roulette ${betLabel} → ${winNum}`, { guildId }
            );

            await spinning.edit({
                embeds: [
                    (win ? Embed.win : Embed.lose)
                        .call(null, `ROULETTE — ${win ? 'THẮNG ' + label : 'THUA'}`, null, betAmount)
                        .setDescription(
                            `${WHEEL}\n\n` +
                            `🎯 Bóng dừng ở: **${wc.icon} ${wc.label} — Số ${winNum}**\n` +
                            `📌 Bạn cược: **${betLabel}**\n\n` +
                            `${win ? `✅ **+${fmt(net)} xu**` : `❌ **-${fmt(betAmount)} xu**`}\n` +
                            balanceChange(userData.balance, updated.balance)
                        ),
                ],
            });
        } finally {
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
        }
    },
};
