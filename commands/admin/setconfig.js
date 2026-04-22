// commands/admin/setconfig.js — Cài đặt cấu hình bot (prefix).

const Guild = require('../../database/models/Guild');
const { Embed } = require('../../utils/embed');

module.exports = {
    name: 'setconfig',
    description: 'Admin: Đổi prefix bot. Cú pháp: !setconfig prefix <prefix_mới>',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator'))
            return message.reply({ embeds: [Embed.error('Không Có Quyền', 'Yêu cầu quyền **Administrator**.')] });

        const setting = args[0]?.toLowerCase();
        const value   = args[1];

        if (setting === 'prefix' && value) {
            if (value.length > 5)
                return message.reply({ embeds: [Embed.error('Không Hợp Lệ', 'Prefix tối đa **5 ký tự**.')] });

            await Guild.findOneAndUpdate(
                { guildId: message.guild.id },
                { $set: { prefix: value } },
                { upsert: true, returnDocument: 'after' }
            );
            return message.reply({
                embeds: [
                    Embed.admin('Prefix Đã Cập Nhật')
                        .setDescription(`✅ Prefix mới: **${value}**\nVí dụ: \`${value}bal\`, \`${value}help\``),
                ],
            });
        }

        return message.reply({
            embeds: [
                Embed.info('Hướng Dẫn Setconfig')
                    .setDescription(
                        '`!setconfig prefix <prefix_mới>` — Đổi prefix lệnh\n' +
                        '`!setcasinochannel` — Cấu hình kênh casino'
                    ),
            ],
        });
    },
};
