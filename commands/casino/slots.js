// commands/casino/slots.js
// Máy đánh bạc 3 ô — hiệu ứng "đang quay" bằng cách gửi rồi edit message.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        let currentBalance = userData.balance;
        if (currentBalance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(currentBalance)} xu**`)] });

        let isPlaying = true;
        let currentMessage = null;
        let skipPrompt = false;

        while (isPlaying) {
            // Kiểm tra số dư người dùng trước mỗi lần quay kế tiếp
            if (currentMessage && currentBalance < betAmount) {
                const noMoneyEmbed = Embed.error('Không Đủ Tiền', `Bạn không còn đủ **${fmt(betAmount)} xu** để quay tiếp!\nSố dư hiện tại: **${fmt(currentBalance)} xu**`);
                await currentMessage.edit({ embeds: [noMoneyEmbed], components: [] });
                break;
            }

            // Khóa tài khoản cho lượt chơi này
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

            try {
                let interaction;

                // 1. Chỉ hỏi xác nhận nếu là lần đầu hoặc họ bị mất tương tác
                if (!skipPrompt) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('slots_pull').setLabel('Quay Ngay').setEmoji('🎰').setStyle(ButtonStyle.Success)
                    );
                    const promptEmbed = Embed.playing('SLOTS MACHINE 🎰', `Bạn đang cược **${fmt(betAmount)} xu**.\nNhấn nút bên dưới để quay!`, betAmount);
                    
                    if (!currentMessage) currentMessage = await message.reply({ embeds: [promptEmbed], components: [row] });
                    else await currentMessage.edit({ embeds: [promptEmbed], components: [row] });

                    try {
                        interaction = await currentMessage.awaitMessageComponent({
                            filter: i => i.user.id === message.author.id, time: 30_000
                        });
                        await interaction.deferUpdate();
                    } catch (err) {
                        await currentMessage.edit({ content: '⏳ Hết thời gian chờ, giao dịch bị huỷ.', components: [] }).catch(() => {});
                        isPlaying = false;
                        break;
                    }
                }

                // 2. Hiệu ứng máy quay
                const suspenseEmbed = Embed.playing('SLOTS MACHINE 🎰', '┃ 🔄 ┃ 🔄 ┃ 🔄 ┃\n\n⏳ *Máy đang quay lạch cạch...*', betAmount);
                
                await currentMessage.edit({ embeds: [suspenseEmbed], components: [] });
                await new Promise(resolve => setTimeout(resolve, 2000));

                // 3. Tính toán kết quả
                const result = [weightedPick(), weightedPick(), weightedPick()];
                const [a, b, c] = result;

                let multiplier = 0;
                if (a === b && b === c)     multiplier = 5;
                else if (a === b || b === c || a === c) multiplier = 1.5;

                const slotDisplay = `┃ ${a} ┃ ${b} ┃ ${c} ┃`;
                const guildId = message.guild?.id;

                let finalEmbed;
                if (multiplier > 0) {
                    const winAmount = Math.floor(betAmount * multiplier);
                    const netWin = winAmount - betAmount;
                    const updated = await processTransaction(
                        userData.userId, netWin, 'BET_WIN',
                        `Thắng Slots ${MULTIPLIERS[multiplier]}`, { guildId }
                    );
                    finalEmbed = Embed.win(`SLOTS — ${MULTIPLIERS[multiplier]}`, null, betAmount)
                        .setDescription(
                            `${slotDisplay}\n\n` +
                            `🎉 **+${fmt(winAmount)} xu**\n` +
                            balanceChange(currentBalance, updated.balance)
                        );
                    currentBalance = updated.balance; // Đồng bộ biến nội bộ
                } else {
                    const updated = await processTransaction(userData.userId, -betAmount, 'BET_LOSS', 'Thua Slots', { guildId });
                    finalEmbed = Embed.lose('SLOTS — Không Trùng', null, betAmount)
                        .setDescription(
                            `${slotDisplay}\n\n` +
                            `💀 **-${fmt(betAmount)} xu**\n` +
                            balanceChange(currentBalance, updated.balance)
                        );
                    currentBalance = updated.balance; // Đồng bộ biến nội bộ
                }

                // 4. In ra kết quả và móc vào nút QUAY TIẾP
                const replayRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('slots_replay').setLabel('Quay Tiếp').setEmoji('🎰').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('slots_stop').setLabel('Dừng Lại').setStyle(ButtonStyle.Secondary)
                );

                await currentMessage.edit({ embeds: [finalEmbed], components: [replayRow] });

                // 5. Đợi xem người chơi muốn đánh tiếp vòng mới không
                try {
                    const replayInteraction = await currentMessage.awaitMessageComponent({
                        filter: i => i.user.id === message.author.id, time: 30_000
                    });
                    
                    await replayInteraction.deferUpdate();

                    if (replayInteraction.customId === 'slots_stop') {
                        await currentMessage.edit({ components: [] });
                        isPlaying = false; // Kết thúc vòng lặp
                    } else {
                        skipPrompt = true; // Nhảy thẳng vào vòng lặp spin tiếp theo
                    }
                } catch (err) {
                    await currentMessage.edit({ components: [] }).catch(() => {});
                    isPlaying = false;
                }

            } finally {
                // Giải phóng khóa bảo vệ tạm thời giữa các luồng
                await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
            }
        }
    },
};
