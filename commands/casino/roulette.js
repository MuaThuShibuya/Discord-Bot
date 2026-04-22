// commands/casino/roulette.js
// Roulette Châu Âu (0–36) — Tương tác bằng nút bấm, hiệu ứng hồi hộp.
// Cú pháp: !roulette <số_tiền>

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    description: 'Cò quay Châu Âu (Red/Black/Green/Số). Cú pháp: !roulette <số_tiền>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!roulette <số_tiền>`')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        try {
            // 1. Tạo các nút cược
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rl_red').setLabel('Đỏ (x2)').setEmoji('🔴').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rl_black').setLabel('Đen (x2)').setEmoji('⚫').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rl_green').setLabel('Xanh (x14)').setEmoji('🟢').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('rl_random').setLabel('Số Bất Kỳ (x36)').setEmoji('🎲').setStyle(ButtonStyle.Primary)
            );

            const promptEmbed = Embed.playing('ROULETTE 🎡', `Bạn đã đặt **${fmt(betAmount)} xu**.\nChọn ô bạn muốn cược ở bên dưới!`, betAmount);
            const replyMsg = await message.reply({ embeds: [promptEmbed], components: [row] });

            // 2. Đợi người dùng chọn
            let interaction;
            try {
                interaction = await replyMsg.awaitMessageComponent({
                    filter: i => i.user.id === message.author.id,
                    time: 30_000,
                });
            } catch (err) {
                const timeoutEmbed = Embed.error('Hết Thời Gian', 'Bạn chưa đặt cược. Lượt quay đã bị huỷ.');
                return replyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }

            await interaction.deferUpdate();

            // 3. Phân tích loại cược dựa trên nút bấm
            let betType, betLabel;
            if (interaction.customId === 'rl_red')   { betType = 'red'; betLabel = 'ĐỎ 🔴'; }
            else if (interaction.customId === 'rl_black') { betType = 'black'; betLabel = 'ĐEN ⚫'; }
            else if (interaction.customId === 'rl_green') { betType = 'green'; betLabel = 'XANH 🟢'; }
            else {
                const rand = secureRandom(0, 36);
                betType = rand.toString();
                betLabel = `SỐ ${rand} 🎲`;
            }

            // 4. Hiệu ứng chờ hồi hộp
            const suspenseEmbed = Embed.playing('ROULETTE 🎡', `Bạn cược: **${betLabel}**\n\n⏳ *Nhà cái đã tung bóng. Bánh xe đang quay...*`, betAmount);
            await interaction.editReply({ embeds: [suspenseEmbed], components: [] });
            
            // Delay 2.5 giây
            await new Promise(resolve => setTimeout(resolve, 2500));

            const winNum = secureRandom(0, 36);
            const wc     = getColor(winNum);
            const { win, net, label } = calcPayout(betAmount, betType, winNum);
            const guildId = message.guild?.id;

            const updated = await processTransaction(
                userData.userId, net,
                win ? 'BET_WIN' : 'BET_LOSS',
                `Roulette ${betLabel} → ${winNum}`, { guildId }
            );

            await interaction.editReply({
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
