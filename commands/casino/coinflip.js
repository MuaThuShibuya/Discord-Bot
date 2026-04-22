// commands/casino/coinflip.js
// Lật đồng xu tỉ lệ 50/50 — dùng crypto RNG, mutex lock bảo vệ.
// Alias: !cf

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
            // 1. Tạo 2 nút bấm Sấp / Ngửa
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('cf_ngua')
                    .setLabel('Ngửa (Heads)')
                    .setEmoji('🌕')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('cf_sap')
                    .setLabel('Sấp (Tails)')
                    .setEmoji('🌑')
                    .setStyle(ButtonStyle.Secondary)
            );

            // 2. Gửi tin nhắn yêu cầu người chơi chọn
            const promptEmbed = Embed.playing(
                'Lật Đồng Xu 🪙', 
                `Bạn đã cược **${fmt(betAmount)} xu**.\nHãy chọn mặt đồng xu bạn muốn cược bên dưới!`,
                betAmount
            );

            const replyMsg = await message.reply({ embeds: [promptEmbed], components: [row] });

            // 3. Chờ người dùng nhấn nút (thời gian chờ: 30 giây)
            let interaction;
            try {
                interaction = await replyMsg.awaitMessageComponent({
                    filter: i => i.user.id === message.author.id, // Chỉ người gọi lệnh mới được bấm
                    time: 30_000,
                });
            } catch (err) {
                // Hết giờ mà không ai bấm, thông báo và huỷ giao dịch (tiền vẫn an toàn)
                const timeoutEmbed = Embed.error('Hết Thời Gian', 'Bạn đã không chọn mặt đồng xu. Giao dịch đã bị huỷ.');
                return replyMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }

            await interaction.deferUpdate();

            // 4. Hiệu ứng chờ lật xu
            const userChoice = interaction.customId === 'cf_ngua' ? 1 : 0; // 1: Ngửa, 0: Sấp
            const userChoiceStr = userChoice === 1 ? '🌕 Ngửa' : '🌑 Sấp';
            
            const suspenseEmbed = Embed.playing('Lật Đồng Xu 🪙', `Bạn chọn: **${userChoiceStr}**\n\n⏳ *Đồng xu đang xoay lơ lửng trên không...*`, betAmount);
            await interaction.editReply({ embeds: [suspenseEmbed], components: [] });
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Đợi 1.5 giây

            // 5. Xử lý kết quả giao dịch
            const coinResult = secureRandom(0, 1);                         // 1: Ngửa, 0: Sấp
            const isWin      = userChoice === coinResult;
            const guildId    = message.guild?.id;

            const resultStr = coinResult === 1 ? '🌕 **NGỬA**' : '🌑 **SẤP**';

            if (isWin) {
                const updated = await processTransaction(userData.userId, betAmount, 'BET_WIN', 'Thắng Coinflip', { guildId });
                await interaction.editReply({
                    embeds: [
                        Embed.win('Bạn Thắng! 🪙', null, betAmount)
                            .setDescription(
                                `Bạn chọn: **${userChoiceStr}**\n` +
                                `Đồng xu lật ra: ${resultStr}!\n\n` +
                                `✅ **+${fmt(betAmount)} xu**\n` +
                                balanceChange(userData.balance, updated.balance)
                            ),
                    ],
                    components: [] // Ẩn các nút đi
                });
            } else {
                const updated = await processTransaction(userData.userId, -betAmount, 'BET_LOSS', 'Thua Coinflip', { guildId });
                await interaction.editReply({
                    embeds: [
                        Embed.lose('Bạn Thua! 🪙', null, betAmount)
                            .setDescription(
                                `Bạn chọn: **${userChoiceStr}**\n` +
                                `Đồng xu lật ra: ${resultStr}!\n\n` +
                                `❌ **-${fmt(betAmount)} xu**\n` +
                                balanceChange(userData.balance, updated.balance)
                            ),
                    ],
                    components: [] // Ẩn các nút đi
                });
            }
        } finally {
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
        }
    },
};
