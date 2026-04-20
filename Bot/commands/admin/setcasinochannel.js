// commands/admin/setcasinochannel.js — Quản lý kênh được phép dùng lệnh casino.

const Guild = require('../../database/models/Guild');
const { Embed } = require('../../utils/embed');

module.exports = {
    name: 'setcasinochannel',
    description: 'Admin: Giới hạn kênh casino. Cú pháp: !setcasinochannel <add|remove|list|clear> [#kênh]',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const action  = args[0]?.toLowerCase();
        const channel = message.mentions.channels.first();
        const guildId = message.guild.id;

        const guildData = await Guild.findOneAndUpdate(
            { guildId },
            { $setOnInsert: { guildId } },
            { upsert: true, new: true }
        );

        if (action === 'list') {
            const list = guildData.casinoChannels;
            return message.reply({
                embeds: [
                    Embed.admin('Kênh Casino Hiện Tại')
                        .setDescription(
                            list.length
                                ? list.map(id => `• <#${id}>`).join('\n')
                                : '✅ Bot hoạt động ở **mọi kênh** (chưa giới hạn).'
                        ),
                ],
            });
        }

        if (action === 'clear') {
            await Guild.updateOne({ guildId }, { $set: { casinoChannels: [] } });
            return message.reply({
                embeds: [Embed.admin('Đã Xóa Giới Hạn').setDescription('✅ Bot sẽ hoạt động ở **mọi kênh**.')],
            });
        }

        if (!channel)
            return message.reply({
                embeds: [
                    Embed.info('Hướng Dẫn Setcasinochannel')
                        .setDescription(
                            '`!setcasinochannel add #kênh` — Thêm kênh\n' +
                            '`!setcasinochannel remove #kênh` — Xóa kênh\n' +
                            '`!setcasinochannel list` — Xem danh sách\n' +
                            '`!setcasinochannel clear` — Bỏ toàn bộ giới hạn'
                        ),
                ],
            });

        if (action === 'add') {
            if (guildData.casinoChannels.includes(channel.id))
                return message.reply({ embeds: [Embed.warning('Đã Tồn Tại', `<#${channel.id}> đã có trong danh sách.`)] });
            await Guild.updateOne({ guildId }, { $addToSet: { casinoChannels: channel.id } });
            return message.reply({
                embeds: [Embed.admin('Đã Thêm Kênh').setDescription(`✅ <#${channel.id}> đã được thêm vào danh sách kênh casino.`)],
            });
        }

        if (action === 'remove') {
            await Guild.updateOne({ guildId }, { $pull: { casinoChannels: channel.id } });
            return message.reply({
                embeds: [Embed.admin('Đã Xóa Kênh').setDescription(`✅ <#${channel.id}> đã được xóa khỏi danh sách.`)],
            });
        }

        return message.reply({ embeds: [Embed.error('Hành Động Không Hợp Lệ', 'Dùng: `add`, `remove`, `list`, `clear`.')] });
    },
};
