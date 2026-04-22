// commands/casino/taixiu.js
// Tài Xỉu (Sic Bo) — cược tổng 3 xúc xắc.
// Alias: !tx

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DICE_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

module.exports = {
    name: 'taixiu',
    aliases: ['tx'],
    description: 'Tài Xỉu — Cược tổng 3 xúc xắc. Tài (11-17) / Xỉu (4-10). Thắng x2. Cú pháp: !tx <số_tiền>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!tx <số_tiền>`')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        try {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('tx_tai')
                    .setLabel('Tài (11-17)')
                    .setEmoji('🔼')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('tx_xiu')
                    .setLabel('Xỉu (4-10)')
                    .setEmoji('🔽')
                    .setStyle(ButtonStyle.Primary)
            );

            const promptEmbed = Embed.playing(
                'TÀI XỈU 🎲',
                `Bạn đã cược **${fmt(betAmount)} xu**.\nHãy chọn **Tài** hoặc **Xỉu** bên dưới!`,
                betAmount
            );

            const replyMsg = await message.reply({ embeds: [promptEmbed], components: [row] });

            let interaction;
            try {
                interaction = await replyMsg.awaitMessageComponent({
                    filter: i => i.user.id === message.author.id,
                    time: 30_000,
                });
            } catch (err) {
                const timeoutEmbed = Embed.error('Hết Thời Gian', 'Bạn đã không chọn. Giao dịch đã bị huỷ.');
                return replyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }

            await interaction.deferUpdate();

            // Hiệu ứng chờ lắc xúc xắc
            const userChoice = interaction.customId.split('_')[1]; // 'tai' or 'xiu'
            const choiceStr = userChoice === 'tai' ? '🔼 Tài' : '🔽 Xỉu';

            const suspenseEmbed = Embed.playing('TÀI XỈU 🎲', `Bạn chọn: **${choiceStr}**\n\n⏳ *Nhà cái đang lắc xúc xắc... lộc cộc lộc cộc...*`, betAmount);
            await interaction.editReply({ embeds: [suspenseEmbed], components: [] });
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Đợi 1.5 giây

            // Tính kết quả
            const dice1 = secureRandom(1, 6);
            const dice2 = secureRandom(1, 6);
            const dice3 = secureRandom(1, 6);
            const total = dice1 + dice2 + dice3;
            const diceResultStr = `${DICE_EMOJI[dice1 - 1]} ${DICE_EMOJI[dice2 - 1]} ${DICE_EMOJI[dice3 - 1]}`;

            let result;
            const isTriple = (dice1 === dice2 && dice2 === dice3);
            if (isTriple) {
                result = 'bão'; // Bão (bộ ba đồng nhất), nhà cái thắng
            } else if (total >= 4 && total <= 10) {
                result = 'xiu';
            } else { // 11-17
                result = 'tai';
            }

            const isWin = userChoice === result;
            const guildId = message.guild?.id;

            let resultLine = `Kết quả: ${diceResultStr} = **${total} điểm** → **${result.toUpperCase()}**`;
            if (isTriple) {
                resultLine = `Kết quả: ${diceResultStr} → **BỘ BA ĐỒNG NHẤT!** Nhà cái thắng.`;
            }

            const updated = await processTransaction(
                userData.userId, isWin ? betAmount : -betAmount,
                isWin ? 'BET_WIN' : 'BET_LOSS',
                `Tài Xỉu (${userChoice} -> ${total})`, { guildId }
            );

            await interaction.editReply({
                embeds: [
                    (isWin ? Embed.win : Embed.lose)(`Bạn ${isWin ? 'Thắng' : 'Thua'}! 🎲`, null, betAmount)
                        .setDescription(
                            `Bạn chọn: **${choiceStr}**\n${resultLine}\n\n` +
                            `${isWin ? '✅' : '❌'} **${isWin ? '+' : '-'}${fmt(betAmount)} xu**\n` +
                            balanceChange(userData.balance, updated.balance)
                        ),
                ],
                components: []
            });
        } finally {
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
        }
    },
};