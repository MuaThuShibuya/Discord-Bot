// commands/economy/claim.js
// Thu nhập thụ động: 10 xu/giờ, tối đa 24 giờ (240 xu).
// Hiển thị thanh tiến trình thể hiện % kho đầy để khuyến khích user claim đúng lúc.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt, progressBar, balanceChange } = require('../../utils/embed');

const COINS_PER_HOUR = 10;
const MAX_HOURS      = 24;
const MAX_COINS      = COINS_PER_HOUR * MAX_HOURS; // 240 xu

module.exports = {
    name: 'claim',
    description: 'Thu nhập thụ động 10 xu/giờ, tối đa 240 xu sau 24h.',

    async execute(message, args, client, userData) {
        const now          = new Date();
        const fromTime     = userData.lastClaim ?? userData.createdAt ?? now;
        const elapsedMs    = now.getTime() - new Date(fromTime).getTime();
        const elapsedHours = Math.min(elapsedMs / 3_600_000, MAX_HOURS);
        const earned       = Math.floor(elapsedHours * COINS_PER_HOUR);

        // Thanh tiến trình kho thu nhập
        const bar        = progressBar(earned, MAX_COINS);
        const isFull     = elapsedHours >= MAX_HOURS;
        const statusText = isFull
            ? '⚠️ **Kho đã đầy!** Claim ngay để tránh lãng phí.'
            : `📦 Kho: **${fmt(earned)} / ${fmt(MAX_COINS)} xu**`;

        if (earned < 1) {
            const minutesLeft = Math.ceil(60 - (elapsedHours * 60));
            return message.reply({
                embeds: [
                    Embed.warning('Kho Chưa Đủ')
                        .setDescription(
                            `Thu nhập chưa đủ **1 xu**.\n\n` +
                            `${bar}\n` +
                            `⏰ Quay lại sau **${minutesLeft} phút** nữa.`
                        ),
                ],
            });
        }

        const updated = await processTransaction(
            userData.userId, earned, 'CLAIM',
            `Thu nhập thụ động (${elapsedHours.toFixed(1)}h × ${COINS_PER_HOUR} xu/h)`,
            { guildId: message.guild?.id }
        );
        await User.updateOne({ userId: userData.userId }, { $set: { lastClaim: now } });

        return message.reply({
            embeds: [
                Embed.economy('Thu Nhập Thụ Động')
                    .setDescription(
                        `${statusText}\n${bar}\n\n` +
                        `✅ Đã nhận **+${fmt(earned)} xu** sau **${elapsedHours.toFixed(1)} giờ** tích lũy.\n\n` +
                        balanceChange(userData.balance, updated.balance)
                    )
                    .addFields(
                        { name: '⚡ Tốc độ',    value: `${COINS_PER_HOUR} xu/giờ`,      inline: true },
                        { name: '📦 Sức chứa',  value: `Tối đa ${fmt(MAX_COINS)} xu`,   inline: true },
                    ),
            ],
        });
    },
};
