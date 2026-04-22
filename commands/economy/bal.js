// commands/economy/bal.js
// Hiển thị số dư tài khoản dưới dạng embed đẹp kèm thứ hạng BXH.
// Alias: !balance

const User = require('../../database/models/User');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'bal',
    aliases: ['balance'],
    description: 'Xem số dư tài khoản của bạn.',

    async execute(message, args, client, userData) {
        // Tính thứ hạng: đếm số người chưa bị ban có balance cao hơn
        const rank = await User.countDocuments({
            isBlacklisted: false,
            balance: { $gt: userData.balance },
        }) + 1;

        const embed = Embed.economy('Tài Khoản')
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👤 Người chơi',   value: `${message.author.username}`,   inline: true },
                { name: '💰 Số dư',        value: `**${fmt(userData.balance)} xu**`, inline: true },
                { name: '🏆 Thứ hạng',     value: `**#${rank}** trên server`,        inline: true },
            );

        return message.reply({ embeds: [embed] });
    },
};
