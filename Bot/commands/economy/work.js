// commands/economy/work.js
// Làm việc kiếm tiền với job ngẫu nhiên — cooldown 1 giờ.

const User = require('../../database/models/User');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { processTransaction } = require('../../utils/transaction');
const { checkCooldown, formatCooldown } = require('../../utils/cooldown');
const { secureRandom } = require('../../utils/rng');
const { Embed, fmt, progressBar, balanceChange } = require('../../utils/embed');

const COOLDOWN_MS = 60 * 60 * 1000;
const REWARD_MIN  = 50;
const REWARD_MAX  = 149;

const JOBS = [
    { name: 'lập trình viên',  emoji: '👨‍💻' },
    { name: 'bác sĩ',          emoji: '👨‍⚕️' },
    { name: 'đầu bếp',         emoji: '👨‍🍳' },
    { name: 'tài xế taxi',     emoji: '🚖' },
    { name: 'giáo viên',       emoji: '👨‍🏫' },
    { name: 'kỹ sư xây dựng',  emoji: '👷' },
    { name: 'nhà thiết kế',    emoji: '🎨' },
    { name: 'streamer game',   emoji: '🎮' },
    { name: 'ca sĩ',           emoji: '🎤' },
    { name: 'thám tử',         emoji: '🕵️' },
    { name: 'phi công',        emoji: '✈️' },
    { name: 'nhà khoa học',    emoji: '🔬' },
    { name: 'vận động viên',   emoji: '⚽' },
    { name: 'blogger du lịch', emoji: '🌍' },
    { name: 'nông dân',        emoji: '🌾' },
];

module.exports = {
    name: 'work',
    description: 'Làm việc kiếm 50–149 xu (cooldown 1 giờ).',

    async execute(message, args, client, userData) {
        const cd = checkCooldown(userData.lastWork, COOLDOWN_MS);

        if (cd.onCooldown) {
            const elapsed   = COOLDOWN_MS - cd.remainingMs;
            const bar       = progressBar(elapsed, COOLDOWN_MS);
            return message.reply({
                embeds: [
                    Embed.warning('Đang Trong Thời Gian Hồi Phục')
                        .setDescription(
                            `Bạn cần nghỉ ngơi trước khi làm việc tiếp!\n\n` +
                            `${bar}\n` +
                            `⏰ Còn **${formatCooldown(cd.hoursLeft, cd.minutesLeft)}** nữa.`
                        ),
                ],
            });
        }

        const job    = JOBS[secureRandom(0, JOBS.length - 1)];
        const earned = secureRandom(REWARD_MIN, REWARD_MAX);

        const updated = await processTransaction(userData.userId, earned, 'WORK', 'Làm việc kiếm tiền', {
            guildId: message.guild?.id,
        });
        await User.updateOne({ userId: userData.userId }, { $set: { lastWork: new Date() } });

        // Tạo Embed kết quả làm việc cơ bản và hỏi tăng ca
        const workEmbed = Embed.economy('Kết Quả Làm Việc')
            .setDescription(
                `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n\n` +
                `🌙 Trời đã tối, bạn có muốn **tăng ca** làm "Cave" không? (Còn 10s để chọn)`
            )
            .addFields({ name: '⏰ Làm việc lại sau', value: `**1 giờ**`, inline: true });

        // Tạo 2 nút bấm
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('work_cave').setLabel('Làm Cave').setEmoji('💃').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('work_no').setLabel('Không').setStyle(ButtonStyle.Secondary)
        );

        const replyMsg = await message.reply({ embeds: [workEmbed], components: [row] });

        // Đợi người dùng nhấn nút trong 10 giây
        try {
            const interaction = await replyMsg.awaitMessageComponent({
                filter: i => i.user.id === message.author.id,
                time: 10000 // 10 giây
            });

            await interaction.deferUpdate();

            if (interaction.customId === 'work_cave') {
                const extraEarned = secureRandom(100, 200); // Lương làm cave: 100-200 xu
                const finalUpdated = await processTransaction(userData.userId, extraEarned, 'WORK', 'Tăng ca làm cave', { guildId: message.guild?.id });
                
                workEmbed.setDescription(
                    `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n` +
                    `💃 Tối đến, bạn ra đường "tăng ca" và khách bo thêm được **+${fmt(extraEarned)} xu**!\n\n` +
                    balanceChange(userData.balance, finalUpdated.balance)
                );
                await interaction.editReply({ embeds: [workEmbed], components: [] });
            } else {
                workEmbed.setDescription(
                    `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n\n` +
                    `🛌 Bạn từ chối tăng ca và quyết định về nhà ngủ sớm.\n\n` +
                    balanceChange(userData.balance, updated.balance)
                );
                await interaction.editReply({ embeds: [workEmbed], components: [] });
            }
        } catch (err) {
            workEmbed.setDescription(
                `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n\n` +
                `⏰ Đã hết 10 giây, bạn mệt quá nên đi ngủ luôn.\n\n` +
                balanceChange(userData.balance, updated.balance)
            );
            await replyMsg.edit({ embeds: [workEmbed], components: [] }).catch(() => {});
        }
    },
};
