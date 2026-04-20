// commands/casino/blackjack.js
// Xì Dách với Discord Buttons — Hit / Stand / Double Down.
// Alias: !bj

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { shuffleArray } = require('../../utils/rng');
const { COLORS, fmt, balanceChange } = require('../../utils/embed');

// ── Bộ bài ───────────────────────────────────────────────────────────────────
const SUITS = ['♠️','♥️','♦️','♣️'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
    return shuffleArray(deck);
}
function pts(card) {
    if (card.r === 'A') return 11;
    if (['J','Q','K'].includes(card.r)) return 10;
    return parseInt(card.r);
}
function total(hand) {
    let t = hand.reduce((s, c) => s + pts(c), 0);
    let a = hand.filter(c => c.r === 'A').length;
    while (t > 21 && a-- > 0) t -= 10;
    return t;
}
function fmtHand(hand) { return hand.map(c => `\`${c.r}${c.s}\``).join(' '); }

// ── Embed builder ─────────────────────────────────────────────────────────────
function gameEmbed(ph, dh, showFull, color, bet, statusLine) {
    const dVal = showFull ? `${fmtHand(dh)} = **${total(dh)}**` : `${fmtHand([dh[0]])} \`🂠\` = **${pts(dh[0])} + ?**`;
    return new EmbedBuilder()
        .setColor(color)
        .setTitle('🃏  BLACKJACK')
        .addFields(
            { name: `👤 Bạn (${total(ph)})`,       value: fmtHand(ph) },
            { name: `🤖 Dealer (${showFull ? total(dh) : '?'})`, value: dVal },
        )
        .setDescription(statusLine ?? null)
        .setFooter({ text: `Cược: ${fmt(bet)} xu` })
        .setTimestamp();
}

// ── Buttons ───────────────────────────────────────────────────────────────────
function activeButtons(canDouble) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit')   .setLabel('👆 Hit')        .setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand') .setLabel('✋ Stand')       .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bj_double').setLabel('💥 Double Down').setStyle(ButtonStyle.Danger).setDisabled(!canDouble),
    );
}
function offButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit')   .setLabel('👆 Hit')        .setStyle(ButtonStyle.Primary)  .setDisabled(true),
        new ButtonBuilder().setCustomId('bj_stand') .setLabel('✋ Stand')       .setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('bj_double').setLabel('💥 Double Down').setStyle(ButtonStyle.Danger)   .setDisabled(true),
    );
}

// ── Command ───────────────────────────────────────────────────────────────────
module.exports = {
    name: 'blackjack',
    aliases: ['bj'],
    description: 'Xì Dách với Dealer — Natural BJ thắng x1.5. Cú pháp: !bj <số_tiền>',

    async execute(message, args, client, userData) {
        let bet = parseInt(args[0]);

        if (isNaN(bet) || bet <= 0)
            return message.reply({ embeds: [gameEmbed([], [], false, COLORS.ERROR, 0, '❌ Cú pháp: `!bj <số_tiền>`')] });
        if (userData.balance < bet)
            return message.reply({ embeds: [gameEmbed([], [], false, COLORS.ERROR, bet, `❌ Không đủ tiền! Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        const fresh = await User.findOne({ userId: userData.userId }).lean();
        const guildId = message.guild?.id;
        const deck = buildDeck();
        const ph = [deck.pop(), deck.pop()];
        const dh = [deck.pop(), deck.pop()];

        // Hàm kết thúc ván
        async function finish(reply, color, statusLine, net) {
            const updated = await processTransaction(
                userData.userId, net,
                net >= 0 ? 'BET_WIN' : 'BET_LOSS',
                `Blackjack: ${statusLine}`, { guildId }
            );
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
            await reply.edit({
                embeds: [
                    gameEmbed(ph, dh, true, color, bet, `${statusLine}\n\n${balanceChange(userData.balance, updated.balance)}`),
                ],
                components: [offButtons()],
            });
        }

        // Natural Blackjack
        if (total(ph) === 21) {
            const prize = Math.floor(bet * 1.5);
            const upd   = await processTransaction(userData.userId, prize, 'BET_WIN', 'Natural Blackjack x1.5', { guildId });
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
            return message.reply({
                embeds: [gameEmbed(ph, dh, true, COLORS.CASINO, bet,
                    `🌟 **NATURAL BLACKJACK!** +${fmt(prize)} xu (x1.5)\n\n${balanceChange(userData.balance, upd.balance)}`)],
                components: [offButtons()],
            });
        }

        const reply = await message.reply({
            embeds: [gameEmbed(ph, dh, false, COLORS.PLAYING, bet, '🎮 Lượt của bạn — chọn hành động bên dưới')],
            components: [activeButtons(fresh.balance >= bet * 2)],
        });

        const collector = reply.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 30_000,
        });

        let ended = false;

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'bj_hit') {
                ph.push(deck.pop());
                if (total(ph) > 21) {
                    ended = true;
                    collector.stop();
                    return finish(reply, COLORS.ERROR, `💀 Quá 21 điểm! Thua **-${fmt(bet)} xu**`, -bet);
                }
                if (total(ph) === 21) { collector.stop(); return; }
                await reply.edit({
                    embeds: [gameEmbed(ph, dh, false, COLORS.PLAYING, bet, '🎮 Rút thêm hay dừng?')],
                    components: [activeButtons(false)], // Double chỉ cho phép ở 2 lá đầu
                });
            }

            if (i.customId === 'bj_double') {
                bet *= 2;
                ph.push(deck.pop());
                ended = total(ph) > 21;
                collector.stop();
                if (ended) return finish(reply, COLORS.ERROR, `💀 Double Down — Quá 21! Thua **-${fmt(bet)} xu**`, -bet);
            }

            if (i.customId === 'bj_stand') collector.stop();
        });

        collector.on('end', async (_, reason) => {
            if (ended) return;
            // Dealer rút đến >= 17
            while (total(dh) < 17) dh.push(deck.pop());
            const p = total(ph), d = total(dh);

            if (reason === 'time')
                return finish(reply, COLORS.ERROR, `⏰ Hết giờ! Auto Stand — Dealer: ${d} | Bạn: ${p}. Thua **-${fmt(bet)} xu**`, -bet);

            if (d > 21 || p > d)
                return finish(reply, COLORS.SUCCESS, `🏆 Thắng! Dealer: ${d} | Bạn: ${p}. **+${fmt(bet)} xu**`, bet);
            if (p === d)
                return finish(reply, COLORS.WARNING, `🤝 Hòa! Dealer: ${d} | Bạn: ${p}. Hoàn tiền cược.`, 0);

            return finish(reply, COLORS.ERROR, `💀 Thua! Dealer: ${d} | Bạn: ${p}. **-${fmt(bet)} xu**`, -bet);
        });
    },
};
