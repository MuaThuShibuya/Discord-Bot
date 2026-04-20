// commands/general/help.js
// Lệnh trợ giúp tương tác với Discord StringSelectMenu.
// Người dùng chọn danh mục từ dropdown → bot cập nhật embed với danh sách lệnh chi tiết.
// Collector timeout 60 giây, sau đó vô hiệu hoá menu tránh "This interaction failed".

const {
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');
const { COLORS, fmt } = require('../../utils/embed');

// ── Định nghĩa danh mục lệnh ─────────────────────────────────────────────────
const CATEGORIES = {
    economy: {
        emoji:       '💰',
        label:       'Kinh Tế',
        description: 'Kiếm tiền, chuyển khoản, bảng xếp hạng',
        color:       COLORS.ECONOMY,
        commands: [
            { usage: '!bal / !balance',          desc: 'Xem số dư tài khoản' },
            { usage: '!work',                    desc: 'Làm việc kiếm **50–149 xu** (cooldown 1h)' },
            { usage: '!daily',                   desc: 'Điểm danh nhận **500 xu** (cooldown 24h)' },
            { usage: '!claim',                   desc: 'Thu nhập thụ động **10 xu/giờ**, tối đa 240 xu sau 24h' },
            { usage: '!pay @user <số_tiền>',     desc: 'Chuyển tiền cho người chơi khác (ACID transaction)' },
            { usage: '!lb / !leaderboard',       desc: 'Bảng xếp hạng **Top 10** đại gia server' },
        ],
    },
    casino: {
        emoji:       '🎰',
        label:       'Casino',
        description: 'Coinflip, Slots, Blackjack, Roulette',
        color:       COLORS.CASINO,
        commands: [
            { usage: '!cf / !coinflip <số>',                desc: 'Lật đồng xu — Tỷ lệ **50/50**, thắng **x2**' },
            { usage: '!slots <số>',                          desc: 'Quay hũ — 2 trùng **x1.5**, 3 trùng **x5** 🎯' },
            { usage: '!bj / !blackjack <số>',               desc: 'Xì Dách — Natural BJ thắng **x1.5**, có nút **Hit/Stand/Double**' },
            { usage: '!roulette <số> red/black/green/0–36', desc: 'Cò quay — Màu **x2**, Xanh **x14**, Số **x36**' },
        ],
        note: '> ⚠️ **Lưu ý:** Tài khoản bị khóa trong ván bài — không thể mở nhiều game cùng lúc.',
    },
    admin: {
        emoji:       '🛡️',
        label:       'Quản Trị',
        description: 'Chỉ dành cho Administrator',
        color:       COLORS.ADMIN,
        commands: [
            { usage: '!addmoney @user <số>',              desc: 'Bơm tiền vào tài khoản người chơi' },
            { usage: '!removemoney @user <số>',           desc: 'Trừ tiền người chơi vi phạm' },
            { usage: '!reset @user --confirm',            desc: 'Xóa trắng tài khoản (cần flag xác nhận)' },
            { usage: '!blacklist @user',                  desc: 'Toggle cấm/mở cấm người chơi' },
            { usage: '!setconfig prefix <prefix>',        desc: 'Đổi prefix lệnh của bot trên server này' },
            { usage: '!setcasinochannel add/remove/list/clear [#kênh]', desc: 'Giới hạn kênh được dùng lệnh casino' },
            { usage: '!stats',                            desc: 'Thống kê tổng quan hệ thống (aggregation)' },
        ],
        note: '> 🔒 Tất cả lệnh admin yêu cầu quyền **Administrator** trên Discord server.',
    },
};

// ── Builders ──────────────────────────────────────────────────────────────────

/** Embed tổng quan chính (trang chủ help) */
function buildOverviewEmbed(user, prefix) {
    return new EmbedBuilder()
        .setColor(COLORS.NEUTRAL)
        .setTitle('🎰  CasinoPro — Hướng Dẫn Sử Dụng')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setDescription(
            `Xin chào **${user.username}**! Chọn danh mục bên dưới để xem chi tiết lệnh.\n` +
            `Prefix hiện tại: \`${prefix}\``
        )
        .addFields(
            {
                name: '💰 Kinh Tế',
                value: '`!bal` `!work` `!daily` `!claim` `!pay` `!lb`',
                inline: true,
            },
            {
                name: '🎰 Casino',
                value: '`!cf` `!slots` `!bj` `!roulette`',
                inline: true,
            },
            {
                name: '🛡️ Quản Trị',
                value: '`!addmoney` `!removemoney` `!reset` `!blacklist` `!stats` ...',
                inline: true,
            },
            {
                name: '📊 Tỷ lệ thắng Casino',
                value: [
                    '🪙 **Coinflip** — 50% | thắng **x2**',
                    '🎰 **Slots** — 3 trùng 0.58% | thắng **x5**',
                    '🃏 **Blackjack** — ~42.2% | Natural thắng **x1.5**',
                    '🎡 **Roulette** — Số: 2.7% | thắng **x36**',
                ].join('\n'),
                inline: false,
            }
        )
        .setFooter({ text: `CasinoPro Bot  •  Gõ !help rồi chọn danh mục để xem chi tiết` })
        .setTimestamp();
}

/** Embed chi tiết từng danh mục */
function buildCategoryEmbed(catKey, prefix) {
    const cat = CATEGORIES[catKey];
    const commandList = cat.commands
        .map(c => `> \`${prefix}${c.usage.startsWith('!') ? c.usage.slice(1) : c.usage}\`\n> ↳ ${c.desc}`)
        .join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(cat.color)
        .setTitle(`${cat.emoji}  ${cat.label} — Danh Sách Lệnh`)
        .setDescription(commandList + (cat.note ? `\n\n${cat.note}` : ''))
        .setFooter({ text: `CasinoPro Bot  •  Prefix: ${prefix}` })
        .setTimestamp();

    return embed;
}

/** SelectMenu điều hướng danh mục */
function buildSelectMenu(selectedValue = null) {
    const options = Object.entries(CATEGORIES).map(([key, cat]) =>
        new StringSelectMenuOptionBuilder()
            .setValue(key)
            .setLabel(`${cat.emoji} ${cat.label}`)
            .setDescription(cat.description)
            .setDefault(key === selectedValue)
    );

    // Thêm tùy chọn "Tổng quan"
    options.unshift(
        new StringSelectMenuOptionBuilder()
            .setValue('overview')
            .setLabel('📋 Tổng Quan')
            .setDescription('Xem tất cả danh mục và tỷ lệ casino')
            .setDefault(selectedValue === null || selectedValue === 'overview')
    );

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 Chọn danh mục lệnh...')
            .addOptions(options)
    );
}

/** SelectMenu đã bị vô hiệu hoá (khi timeout) */
function buildDisabledMenu() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_menu_disabled')
            .setPlaceholder('⏰ Menu đã hết hạn — gõ !help để mở lại')
            .setDisabled(true)
            .addOptions(
                new StringSelectMenuOptionBuilder().setValue('_').setLabel('Hết hạn')
            )
    );
}

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
    name: 'help',
    aliases: ['h', 'hd'],
    description: 'Hiển thị hướng dẫn sử dụng bot với menu điều hướng.',

    async execute(message, args, client, userData, guildConfig) {
        const prefix = guildConfig?.prefix ?? process.env.PREFIX ?? '!';

        const reply = await message.reply({
            embeds:     [buildOverviewEmbed(message.author, prefix)],
            components: [buildSelectMenu('overview')],
        });

        // Collector lắng nghe interaction SelectMenu — chỉ từ người gọi lệnh
        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId === 'help_menu',
            time:   60_000, // 60 giây
        });

        collector.on('collect', async (interaction) => {
            const selected = interaction.values[0];
            const isOverview = selected === 'overview';

            await interaction.update({
                embeds: [
                    isOverview
                        ? buildOverviewEmbed(message.author, prefix)
                        : buildCategoryEmbed(selected, prefix),
                ],
                components: [buildSelectMenu(selected)],
            });
        });

        collector.on('end', () => {
            // Vô hiệu hoá menu sau khi hết thời gian — tránh "This interaction failed"
            reply.edit({ components: [buildDisabledMenu()] }).catch(() => {});
        });
    },
};
