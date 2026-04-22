// commands/casino/highlow.js
// RIDE THE BUS — Trò chơi vượt 4 chặng liên tiếp.
// Alias: !db, !doanbai, !rtb, !bus

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { shuffleArray } = require('../../utils/rng');
const { Embed, fmt, balanceChange } = require('../../utils/embed');

// --- Card Utilities ---
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function buildDeck() {
    const deck = [];
    for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
    return shuffleArray(deck);
}

function cardValue(card) {
    if (card.r === 'A') return 14;
    if (card.r === 'K') return 13;
    if (card.r === 'Q') return 12;
    if (card.r === 'J') return 11;
    return parseInt(card.r);
}

function fmtCard(card) { return `**[ ${card.r}${card.s} ]**`; }

module.exports = {
    name: 'doanbai',
    aliases: ['db', 'doanbai', 'rtb', 'bus'],
    description: 'Đoán bài (Ride the Bus) — Vượt qua 4 chặng đoán bài liên tiếp để x20 tiền cược. Cú pháp: !db <số_tiền>',

    async execute(message, args, client, userData) {
        const betAmount = parseInt(args[0]);

        if (isNaN(betAmount) || betAmount <= 0)
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!db <số_tiền>`')] });
        if (userData.balance < betAmount)
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Số dư: **${fmt(userData.balance)} xu**`)] });

        await User.updateOne({ userId: userData.userId }, { $set: { isLocked: true, lockedAt: new Date() } });

        try {
            const deck = buildDeck();
            const drawnCards = [];
            let step = 1;

            const getRow1 = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rtb_red').setLabel('Đỏ (♥️♦️)').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rtb_black').setLabel('Đen (♠️♣️)').setStyle(ButtonStyle.Secondary)
            );
            const getRow2 = (val) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rtb_high').setLabel('Cao hơn').setEmoji('🔼').setStyle(ButtonStyle.Primary).setDisabled(val === 14),
                new ButtonBuilder().setCustomId('rtb_low').setLabel('Thấp hơn').setEmoji('🔽').setStyle(ButtonStyle.Primary).setDisabled(val === 2),
                new ButtonBuilder().setCustomId('rtb_cashout').setLabel('Chốt (x2)').setEmoji('💸').setStyle(ButtonStyle.Success)
            );
            const getRow3 = (v1, v2) => {
                const minV = Math.min(v1, v2);
                const maxV = Math.max(v1, v2);
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('rtb_inside').setLabel('Trong khoảng').setEmoji('↔️').setStyle(ButtonStyle.Primary).setDisabled(maxV - minV <= 1),
                    new ButtonBuilder().setCustomId('rtb_outside').setLabel('Ngoài khoảng').setEmoji('🔀').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('rtb_cashout').setLabel('Chốt (x4)').setEmoji('💸').setStyle(ButtonStyle.Success)
                );
            };
            const getRow4 = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('rtb_spades').setEmoji('♠️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rtb_hearts').setEmoji('♥️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rtb_clubs').setEmoji('♣️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('rtb_diamonds').setEmoji('♦️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('rtb_cashout').setLabel('Chốt (x8)').setEmoji('💸').setStyle(ButtonStyle.Success)
            );

            const promptEmbed = Embed.playing(
                'RIDE THE BUS 🚌',
                `Bạn đã cược **${fmt(betAmount)} xu**.\n\n**Chặng 1:** Lá bài đầu tiên sẽ là màu **Đỏ** hay **Đen**?`,
                betAmount
            );

            const replyMsg = await message.reply({ embeds: [promptEmbed], components: [getRow1()] });
            
            const collector = replyMsg.createMessageComponentCollector({ filter: i => i.user.id === message.author.id, time: 60_000 });

            await new Promise((resolve) => {
                collector.on('collect', async (i) => {
                    await i.deferUpdate();
                    const choice = i.customId.split('_')[1];
                    
                    if (choice === 'cashout') return collector.stop('cashout');

                    // --- HIỆU ỨNG CHỜ (MỞ BÀI TỪ TỪ) ---
                    let suspenseDesc = '';
                    if (step === 1) suspenseDesc = `⏳ *Đang lật lá bài đầu tiên...*`;
                    if (step === 2) suspenseDesc = `Bài đang có: ${fmtCard(drawnCards[0])}\n\n⏳ *Đang lật lá bài thứ hai...*`;
                    if (step === 3) suspenseDesc = `Bài đang có: ${fmtCard(drawnCards[0])} ➔ ${fmtCard(drawnCards[1])}\n\n⏳ *Đang lật lá bài thứ ba...*`;
                    if (step === 4) suspenseDesc = `Bài đang có: ${fmtCard(drawnCards[0])} ➔ ${fmtCard(drawnCards[1])} ➔ ${fmtCard(drawnCards[2])}\n\n⏳ *Đang lật lá bài cuối cùng...*`;

                    promptEmbed.setDescription(suspenseDesc);
                    await i.editReply({ embeds: [promptEmbed], components: [] });
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Đợi 1.5 giây

                    const nextCard = deck.pop();
                    drawnCards.push(nextCard);

                    if (step === 1) {
                        const isRed = ['♥️', '♦️'].includes(nextCard.s);
                        const isWin = (choice === 'red' && isRed) || (choice === 'black' && !isRed);
                        if (!isWin) return collector.stop('lose_1');
                        
                        step = 2;
                        promptEmbed.setDescription(`**Vượt Chặng 1!**\nBài hiện tại: ${fmtCard(drawnCards[0])}\n\n**Chặng 2:** Lá tiếp theo sẽ **Cao hơn** hay **Thấp hơn**?\n*(Bạn có thể Chốt lời để nhận x2 ngay lúc này)*`);
                        await i.editReply({ embeds: [promptEmbed], components: [getRow2(cardValue(nextCard))] });
                        collector.resetTimer();
                    } 
                    else if (step === 2) {
                        const prevVal = cardValue(drawnCards[0]);
                        const nextVal = cardValue(nextCard);
                        const isWin = (choice === 'high' && nextVal > prevVal) || (choice === 'low' && nextVal < prevVal);
                        
                        if (!isWin) return collector.stop('lose_2');
                        
                        step = 3;
                        promptEmbed.setDescription(`**Vượt Chặng 2!**\nBài hiện tại: ${fmtCard(drawnCards[0])} ➔ ${fmtCard(drawnCards[1])}\n\n**Chặng 3:** Lá thứ 3 sẽ nằm **Trong** hay **Ngoài** khoảng giá trị của 2 lá trên?\n*(Bạn có thể Chốt lời để nhận x4)*`);
                        await i.editReply({ embeds: [promptEmbed], components: [getRow3(prevVal, nextVal)] });
                        collector.resetTimer();
                    }
                    else if (step === 3) {
                        const minV = Math.min(cardValue(drawnCards[0]), cardValue(drawnCards[1]));
                        const maxV = Math.max(cardValue(drawnCards[0]), cardValue(drawnCards[1]));
                        const nextVal = cardValue(nextCard);
                        
                        const isInside = nextVal > minV && nextVal < maxV;
                        const isOutside = nextVal < minV || nextVal > maxV;
                        
                        const isWin = (choice === 'inside' && isInside) || (choice === 'outside' && isOutside);
                        
                        if (!isWin) return collector.stop('lose_3');
                        
                        step = 4;
                        promptEmbed.setDescription(`**Vượt Chặng 3!**\nBài hiện tại: ${fmtCard(drawnCards[0])} ➔ ${fmtCard(drawnCards[1])} ➔ ${fmtCard(drawnCards[2])}\n\n**Chặng 4 (Cuối):** Đoán chính xác **Chất** của lá thứ 4?\n*(Bạn có thể Chốt lời an toàn để nhận x8)*`);
                        await i.editReply({ embeds: [promptEmbed], components: [getRow4()] });
                        collector.resetTimer();
                    }
                    else if (step === 4) {
                        const suitsMap = { spades: '♠️', hearts: '♥️', clubs: '♣️', diamonds: '♦️' };
                        const isWin = suitsMap[choice] === nextCard.s;
                        
                        if (!isWin) return collector.stop('lose_4');
                        return collector.stop('win');
                    }
                });

                collector.on('end', async (collected, reason) => {
                    const guildId = message.guild?.id;
                    const cardsLine = drawnCards.map(c => fmtCard(c)).join(' ➔ ');

                    let isWin = false;
                    let winMultiplier = 0;

                    if (reason === 'win') {
                        isWin = true;
                        winMultiplier = 20;
                    } else if (reason === 'cashout') {
                        isWin = true;
                        if (step === 2) winMultiplier = 2;
                        if (step === 3) winMultiplier = 4;
                        if (step === 4) winMultiplier = 8;
                    }

                    if (isWin) {
                        const winAmount = betAmount * winMultiplier;
                        const netWin = winAmount - betAmount; 
                        
                        const updated = await processTransaction(userData.userId, netWin, 'BET_WIN', `Thắng Ride the Bus x${winMultiplier}`, { guildId });
                        const title = reason === 'cashout' ? `💸 CHỐT LỜI THÀNH CÔNG — x${winMultiplier}!` : `🏆 RIDE THE BUS — THẮNG x${winMultiplier}!`;
                        const desc  = reason === 'cashout' ? `Bạn đã an toàn rút lui với số tiền nhân ${winMultiplier} lần!` : `Tuyệt đỉnh! Bạn đã qua trọn vẹn 4 chặng!`;

                        await replyMsg.edit({
                            embeds: [
                                Embed.win(title, null, betAmount)
                                    .setDescription(
                                        `${desc}\n\n` +
                                        `Bài đã mở: ${cardsLine}\n\n` +
                                        `✅ **+${fmt(winAmount)} xu**\n` +
                                        balanceChange(userData.balance, updated.balance)
                                    )
                            ],
                            components: []
                        }).catch(() => {});
                    } else {
                        const updated = await processTransaction(userData.userId, -betAmount, 'BET_LOSS', `Thua Ride the Bus (${reason})`, { guildId });
                        let loseText = `Rất tiếc, xe buýt đã tông bạn ở **chặng ${step}**.`;
                        if (reason === 'time') loseText = `⏰ Hết thời gian! Bạn đã bị tính là thua ở **chặng ${step}**.`;

                        await replyMsg.edit({
                            embeds: [
                                Embed.lose(`🚌 RIDE THE BUS — THUA`, null, betAmount)
                                    .setDescription(
                                        `${loseText}\n\n` +
                                        (drawnCards.length > 0 ? `Bài đã mở: ${cardsLine}\n\n` : '') +
                                        `❌ **-${fmt(betAmount)} xu**\n` +
                                        balanceChange(userData.balance, updated.balance)
                                    )
                            ],
                            components: []
                        }).catch(() => {});
                    }
                    resolve(); 
                });
            });
        } catch (error) {
            console.error('[RideTheBus] Lỗi:', error);
            message.reply('⚠️ Đã xảy ra lỗi, giao dịch có thể đã bị huỷ.').catch(() => {});
        } finally {
            await User.updateOne({ userId: userData.userId }, { $set: { isLocked: false, lockedAt: null } });
        }
    },
};