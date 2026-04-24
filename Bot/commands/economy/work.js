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

        // Định nghĩa Role IDs và phần thưởng
        const ROLE_NAM_ID = '1495641257907716157';
        const ROLE_BABYGIRL_ID = '1495641330796331038';
        const ROLE_GIRL_ID = '1496390605373308938'; 
        const userRoles = message.member.roles.cache;
        const hasNamRole = userRoles.has(ROLE_NAM_ID);
        const hasBabyGirlRole = userRoles.has(ROLE_BABYGIRL_ID);
        const hasGirlRole = userRoles.has(ROLE_GIRL_ID);

        // Tạo Embed kết quả làm việc
        const workEmbed = Embed.economy('Kết Quả Làm Việc')
            .setDescription(`${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!`)
            .addFields({ name: '⏰ Làm việc lại sau', value: `**1 giờ**`, inline: true });

        // Tạo các nút bấm dựa trên role
        const row = new ActionRowBuilder();
        
        // Luôn hiển thị nút Làm Cave mặc định
        row.addComponents(
            new ButtonBuilder().setCustomId('work_cave').setLabel('Làm Cave').setEmoji('💃').setStyle(ButtonStyle.Danger)
        );

        if (hasNamRole) {
            row.addComponents(
                new ButtonBuilder().setCustomId('work_traibao').setLabel('Trai Bao').setEmoji('🕺').setStyle(ButtonStyle.Danger)
            );
        }
        if (hasBabyGirlRole || hasGirlRole) {
            row.addComponents(
                new ButtonBuilder().setCustomId('work_sugarbaby').setLabel('Sugar Baby').setEmoji('💅').setStyle(ButtonStyle.Primary)
            );
        }

        // Luôn hỏi tăng ca và thêm nút "Không"
        workEmbed.setDescription(
            `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n\n` +
            `🌙 Trời đã tối, bạn có muốn **tăng ca** không? (Còn 10s để chọn)`
        );
        row.addComponents(
            new ButtonBuilder().setCustomId('work_no').setLabel('Không').setStyle(ButtonStyle.Secondary)
        );

        const replyMsg = await message.reply({ embeds: [workEmbed], components: [row] });

        // Đợi người dùng nhấn nút trong 10 giây
        try {
            const interaction = await replyMsg.awaitMessageComponent({
                filter: i => i.user.id === message.author.id,
                time: 10000 // 10 giây
            });

            // Kiểm tra role một lần nữa trong interaction để đảm bảo an toàn
            const interactionRoles = interaction.member.roles.cache;

            if (interaction.customId === 'work_cave') {
                const extraEarned = secureRandom(100, 200); // Lương làm cave cơ bản
                const finalUpdated = await processTransaction(userData.userId, extraEarned, 'WORK', 'Tăng ca làm Cave', { guildId: message.guild?.id });

                workEmbed.setDescription(
                    `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n` +
                    `💃 Tối đến, bạn ra đường "tăng ca" và khách bo thêm được **+${fmt(extraEarned)} xu**!\n\n` +
                    balanceChange(userData.balance, finalUpdated.balance)
                );
                return interaction.update({ embeds: [workEmbed], components: [] });
            } else if (interaction.customId === 'work_traibao') {
                    if (!interactionRoles.has(ROLE_NAM_ID)) {
                        return interaction.reply({ content: '🚫 Bạn không có vai trò phù hợp để làm công việc này.', ephemeral: true });
                    }
                    const extraEarned = secureRandom(10000, 30000);
                    const finalUpdated = await processTransaction(userData.userId, extraEarned, 'WORK', 'Tăng ca làm Trai Bao', { guildId: message.guild?.id });

                    workEmbed.setDescription(
                        `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n` +
                        `🕺 Tối đến, bạn ra đường làm "Trai Bao" và được đại gia bo đậm **+${fmt(extraEarned)} xu**!\n\n` +
                        balanceChange(userData.balance, finalUpdated.balance)
                    );
                    return interaction.update({ embeds: [workEmbed], components: [] });
                } else if (interaction.customId === 'work_sugarbaby') {
                    if (interactionRoles.has(ROLE_BABYGIRL_ID)) {
                        const extraEarned = secureRandom(50000, 200000);
                        const finalUpdated = await processTransaction(userData.userId, extraEarned, 'WORK', 'Tăng ca làm Sugar Baby', { guildId: message.guild?.id });

                        workEmbed.setDescription(
                            `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n` +
                            `💅 Tối đến, bạn đi làm "Sugar Baby" và được chu cấp một khoản lớn **+${fmt(extraEarned)} xu**!\n\n` +
                            balanceChange(userData.balance, finalUpdated.balance)
                        );
                        return interaction.update({ embeds: [workEmbed], components: [] });
                    } else if (interactionRoles.has(ROLE_GIRL_ID)) {
                        return interaction.reply({
                            content: '💖 Ôi người con gái đáng iu, nàng hãy đăng ký nhận role **Baby Girl** để phù hợp với công việc này nhé!',
                            ephemeral: true,
                        });
                    } else {
                        return interaction.reply({ content: '🚫 Bạn không có vai trò phù hợp để làm công việc này.', ephemeral: true });
                    }
                } else { // work_no
                    await interaction.deferUpdate();
                    workEmbed.setDescription(
                        `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n\n` +
                        `🛌 Bạn từ chối tăng ca và quyết định về nhà ngủ sớm.\n\n` +
                        balanceChange(userData.balance, updated.balance)
                    );
                    await interaction.editReply({ embeds: [workEmbed], components: [] });
                }
            } catch (err) {
                workEmbed.setDescription(
                    `${job.emoji} Bạn làm **${job.name}** và kiếm được **+${fmt(earned)} xu**!\n` +
                    `⏰ Đã hết 10 giây, bạn mệt quá nên đi ngủ luôn.\n\n` +
                    balanceChange(userData.balance, updated.balance)
                );
                await replyMsg.edit({ embeds: [workEmbed], components: [] }).catch(() => {});
        }
    },
};
