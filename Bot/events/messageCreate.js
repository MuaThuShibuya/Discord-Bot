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
                                { upsert: true, new: true }
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
        const guildConfig = await Guild.findOne({ guildId: message.guild?.id });
        const prefix = guildConfig?.prefix || process.env.PREFIX || '!';

        if (!message.content.startsWith(prefix)) return;

        // Channel Guard: từ chối lệnh nếu admin đã giới hạn kênh
        const allowedChannels = guildConfig?.casinoChannels ?? [];
        if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) {
            return message.reply(
                `❌ Lệnh casino chỉ hoạt động trong các kênh được chỉ định. Hãy dùng đúng kênh!`
            ).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000)); // Tự xóa sau 5s
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
                { upsert: true, new: true }
            );

            // Security: chặn user bị ban
            if (userData.isBlacklisted) {
                return message.reply('⛔ Tài khoản của bạn đã bị cấm sử dụng hệ thống.');
            }

            // Security: chặn user đang trong ván bài — tuy nhiên tự động mở khóa nếu stale
            if (userData.isLocked) {
                const staleLock = userData.lockedAt && (Date.now() - userData.lockedAt.getTime()) > LOCK_TIMEOUT_MS;
                if (staleLock) {
                    // Stale lock recovery: bot crash trước đó, giải phóng khóa
                    userData = await User.findOneAndUpdate(
                        { userId: userData.userId },
                        { $set: { isLocked: false, lockedAt: null } },
                        { new: true }
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
