// events/messageCreate.js
// Bộ xử lý trung tâm (Command Router) cho mọi tin nhắn đến.
//
// LUỒNG XỬ LÝ:
//   1. OwO Integration: bắt tin nhắn từ bot OwO → thưởng xu cho người được mention (anti-farm tích hợp)
//   2. Prefix Check: lọc tin nhắn không phải lệnh
//   3. Channel Guard: chỉ cho phép lệnh trong kênh được cấu hình (nếu admin đã set)
//   4. Security Checks: blacklist → mutex lock
//   5. Dispatch: tìm command trong Collection và thực thi
//
// STALE LOCK RECOVERY: Nếu bot crash giữa ván bài, lockedAt > LOCK_TIMEOUT_MS sẽ tự mở khóa.

const User  = require('../database/models/User');
const Guild = require('../database/models/Guild');
const { processTransaction } = require('../utils/transaction');

const OWO_BOT_ID       = '408785106942164992'; // ID chính thức của bot OwO trên Discord
const OWO_MAX_PER_DAY  = 20;                   // Giới hạn số lần nhận thưởng OwO mỗi ngày (anti-farm)
const OWO_BONUS_AMOUNT = 50;                   // Xu thưởng mỗi lần OwO trigger
const LOCK_TIMEOUT_MS  = 2 * 60 * 1000;        // Stale lock tự động mở sau 2 phút

module.exports = {
    name: 'messageCreate',
    once: false,

    async execute(message, client) {

        // ══════════════════════════════════════════
        // LUỒNG 1: OwO Bot Integration
        // ══════════════════════════════════════════
        if (message.author.bot) {
            if (message.author.id === OWO_BOT_ID) {
                const mentionedUser = message.mentions.users.first();
                if (mentionedUser && !mentionedUser.bot) {
                    const content = message.content.toLowerCase();
                    // Nhận diện các keyword khi OwO hoàn thành nhiệm vụ thành công
                    const isOwOSuccess = content.includes('found') || content.includes('caught') || content.includes('earned');

                    if (isOwOSuccess) {
                        try {
                            // Tải hoặc tạo user data, kiểm tra anti-farm
                            const now      = new Date();
                            const userData = await User.findOneAndUpdate(
                                { userId: mentionedUser.id },
                                { $setOnInsert: { userId: mentionedUser.id } },
                                { upsert: true, returnDocument: 'after' }
                            );

                            // Reset bộ đếm nếu đã sang ngày mới
                            const isNewDay = !userData.owoResetDate ||
                                userData.owoResetDate.toDateString() !== now.toDateString();
                            if (isNewDay) {
                                await User.updateOne(
                                    { userId: mentionedUser.id },
                                    { $set: { owoDailyCount: 0, owoResetDate: now } }
                                );
                                userData.owoDailyCount = 0;
                            }

                            // Kiểm tra giới hạn ngày
                            if (userData.owoDailyCount >= OWO_MAX_PER_DAY) {
                                return; // Đã đạt giới hạn — im lặng, không thưởng
                            }

                            // Cộng tiền + tăng bộ đếm (hai thao tác riêng vì $inc và processTransaction đã atomic)
                            await processTransaction(
                                mentionedUser.id,
                                OWO_BONUS_AMOUNT,
                                'OWO_BONUS',
                                `Thưởng OwO Integration (${userData.owoDailyCount + 1}/${OWO_MAX_PER_DAY})`,
                                { guildId: message.guild?.id }
                            );
                            await User.updateOne(
                                { userId: mentionedUser.id },
                                { $inc: { owoDailyCount: 1 } }
                            );

                            // React emoji xác nhận thay vì spam tin nhắn
                            await message.react('💰').catch(() => {});
                        } catch (err) {
                            console.error('[OwO Integration] Lỗi khi cộng thưởng:', err);
                        }
                    }
                }
            }
            return; // Bỏ qua tất cả tin nhắn từ bot (kể cả chính bot này)
        }

        // ══════════════════════════════════════════
        // LUỒNG 2: Command Router
        // ══════════════════════════════════════════

        // Load cấu hình guild (prefix + channel restrictions) — cache có thể thêm sau nếu cần scale
        let guildConfig = null;
        try {
            guildConfig = await Guild.findOne({ guildId: message.guild?.id });
        } catch (err) {
            console.error('[MessageCreate] Lỗi khi load guild config:', err);
        }
        const prefix = guildConfig?.prefix || process.env.PREFIX || '!';

        if (!message.content.startsWith(prefix)) return;

        // Channel Guard: từ chối lệnh nếu admin đã giới hạn kênh.
        // Admin (có quyền Administrator) luôn được phép dùng lệnh ở bất kỳ kênh nào.
        const allowedChannels = guildConfig?.casinoChannels ?? [];
        const isAdmin = message.member?.permissions.has('Administrator');
        if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id) && !isAdmin) {
            message.reply(
                '❌ Lệnh casino chỉ hoạt động trong các kênh được chỉ định. Hãy dùng đúng kênh!'
            ).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000)).catch(() => {});
            return;
        }

        // Parse command
        const args        = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command     = client.commands.get(commandName);
        if (!command) return;

        try {
            // Tải hoặc tạo user — upsert an toàn, không race condition vì upsert là atomic
            let userData = await User.findOneAndUpdate(
                { userId: message.author.id },
                { $setOnInsert: { userId: message.author.id } },
                { upsert: true, returnDocument: 'after' }
            );

            // Security: chặn user bị ban
            if (userData.isBlacklisted) {
                return message.reply('⛔ Tài khoản của bạn đã bị cấm sử dụng hệ thống.');
            }

            // ─── TÍNH NĂNG LOAN: TỰ ĐỘNG THU NỢ VÀ GIỚI HẠN CASINO NHẸ NHÀNG ────────
            if (userData.loanAmountDue > 0) {
                const isOverdue = userData.loanDueDate && Date.now() > userData.loanDueDate.getTime();
                
                if (isOverdue) {
                    // Thử tự động thu nợ nếu người chơi có xu trong ví
                    if (userData.balance > 0) {
                        const amountToTake = Math.min(userData.balance, userData.loanAmountDue);
                        await processTransaction(userData.userId, -amountToTake, 'LOAN_REPAY_AUTO', 'Tự động thu hồi nợ quá hạn', { guildId: message.guild?.id });
                        
                        const remainingDebt = userData.loanAmountDue - amountToTake;
                        userData = await User.findOneAndUpdate(
                            { userId: userData.userId },
                            { 
                                $set: { loanAmountDue: remainingDebt, ...(remainingDebt === 0 ? { loanDueDate: null } : {}) }
                            },
                            { returnDocument: 'after' }
                        );
                        message.channel.send(`🕴️ **SIẾT NỢ!** <@${userData.userId}> Đã quá thời hạn 1 tiếng trả nợ. Trùm Casino vừa phái đàn em tới lột sạch **${amountToTake.toLocaleString('en-US')} xu** từ túi của bạn!`);
                    }

                    // Nếu vẫn còn nợ sau khi thu -> Cấm chơi Casino nhưng cho phép dùng lệnh Kinh tế
                    if (userData.loanAmountDue > 0) {
                        const economyCmds = ['bal', 'balance', 'work', 'daily', 'claim', 'pay', 'lb', 'leaderboard', 'repay', 'help'];
                        if (!economyCmds.includes(commandName) && !isAdmin) {
                            return message.reply(`🛑 **BẠN ĐANG BỊ CẤM CỬA CASINO!**\nKhoản nợ của bạn đã quá thời hạn 1 tiếng và hiện vẫn còn thiếu **${userData.loanAmountDue.toLocaleString('en-US')} xu**.\nBảo vệ không cho phép bạn vào bàn chơi. Hãy ra ngoài gõ \`!work\` làm thuê rửa bát kiếm tiền và \`!repay\` trả nợ đi nhé! 🧹🍽️`);
                        }
                    }
                }
            }
            // ──────────────────────────────────────────────────────────────────────

            // Security: chặn user đang trong ván bài — tuy nhiên tự động mở khóa nếu stale
            if (userData.isLocked) {
                const staleLock = userData.lockedAt && (Date.now() - userData.lockedAt.getTime()) > LOCK_TIMEOUT_MS;
                if (staleLock) {
                    // Stale lock recovery: bot crash trước đó, giải phóng khóa
                    userData = await User.findOneAndUpdate(
                        { userId: userData.userId },
                        { $set: { isLocked: false, lockedAt: null } },
                        { returnDocument: 'after' }
                    );
                    console.warn(`[Mutex] Đã tự mở stale lock cho user ${userData.userId}`);
                } else {
                    return message.reply('⚠️ Bạn đang trong một ván game! Vui lòng chờ ván kết thúc.');
                }
            }

            // Dispatch lệnh — truyền guildConfig để các command biết cài đặt của server
            await command.execute(message, args, client, userData, guildConfig);

        } catch (error) {
            console.error(`[Command:${commandName}] Lỗi không xử lý được:`, error);
            message.reply('⚠️ Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.').catch(() => {});
        }
    },
};
