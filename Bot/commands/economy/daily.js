// commands/economy/daily.js
// Điểm danh hàng ngày nhận 500 xu — cooldown 24 giờ.

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { checkCooldown, formatCooldown } = require('../../utils/cooldown');
const { Embed, fmt, progressBar, balanceChange } = require('../../utils/embed');

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const REWARD      = 500;

module.exports = {
    name: 'daily',
    description: 'Điểm danh nhận 500 xu mỗi 24 giờ.',

    async execute(message, args, client, userData) {
        const cd = checkCooldown(userData.lastDaily, COOLDOWN_MS);

        if (cd.onCooldown) {
            const elapsed = COOLDOWN_MS - cd.remainingMs;
            const bar     = progressBar(elapsed, COOLDOWN_MS);
            return message.reply({
                embeds: [
                    Embed.warning('Đã Điểm Danh Hôm Nay')
                        .setDescription(
                            `Bạn chỉ có thể điểm danh **1 lần mỗi 24 giờ**.\n\n` +
                            `${bar}\n` +
                            `⏰ Còn **${formatCooldown(cd.hoursLeft, cd.minutesLeft)}** nữa.`
                        ),
                ],
            });
        }

        const updated = await processTransaction(userData.userId, REWARD, 'DAILY', 'Điểm danh hàng ngày', {
            guildId: message.guild?.id,
        });
        await User.updateOne({ userId: userData.userId }, { $set: { lastDaily: new Date() } });

        return message.reply({
            embeds: [
                Embed.economy('Điểm Danh Thành Công')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .setDescription(
                        `🎁 **+${fmt(REWARD)} xu** đã được cộng vào tài khoản!\n\n` +
                        balanceChange(userData.balance, updated.balance)
                    )
                    .addFields({
                        name: '⏰ Điểm danh lại sau',
                        value: '**24 giờ**',
                        inline: true,
                    }),
            ],
        });
    },
};
