// commands/economy/loan.js
// Cho người chơi vay tiền từ Casino (Chỉ Admin). Lãi suất % và số tiền có thể tuỳ chỉnh.
// Cú pháp: !loan @user <số_tiền> [lãi_suất]

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

const DEFAULT_INTEREST_RATE = 0.10; // Lãi suất mặc định 10%
const LOAN_MAX_AMOUNT = 100000; // Tối đa có thể vay 100k xu
const LOAN_DURATION_MS = 60 * 60 * 1000; // Thời hạn 1 giờ

module.exports = {
    name: 'loan',
    aliases: ['vay'],
    description: 'Cho người chơi vay tiền Casino (Admin). Thời hạn trả nợ: 1 giờ. Cú pháp: !loan @user <số_tiền> [lãi_suất]',

    async execute(message, args, client, userData) {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply({ embeds: [Embed.error('Thiếu Quyền', 'Chỉ Administrator mới có thể dùng lệnh này để cho vay.')] });
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', '`!loan @user <số_tiền> [lãi_suất]`\n*Ví dụ: !loan @Nam 50000 5*')] });
        }

        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) {
            return message.reply({ embeds: [Embed.error('Cú Pháp Sai', 'Số tiền vay không hợp lệ.')] });
        }

        if (amount > LOAN_MAX_AMOUNT) {
            return message.reply({ embeds: [Embed.error('Từ Chối', `Chỉ được cho vay tối đa **${fmt(LOAN_MAX_AMOUNT)} xu** mỗi lần để tránh rủi ro hệ thống.`)] });
        }

        let targetUserData = await User.findOne({ userId: targetUser.id });

        // Tính toán lãi và thời gian đáo hạn
        let interestRate = DEFAULT_INTEREST_RATE;
        if (args[2]) {
            const customRate = parseFloat(args[2]);
            if (!isNaN(customRate) && customRate >= 0) {
                interestRate = customRate / 100;
            } else {
                return message.reply({ embeds: [Embed.error('Cú Pháp Sai', 'Lãi suất phải là một số hợp lệ lớn hơn hoặc bằng 0 (VD: 5).')] });
            }
        }

        const currentDebt = targetUserData?.loanAmountDue || 0;
        const newDebtAddition = Math.floor(amount * (1 + interestRate));
        const totalAmountDue = currentDebt + newDebtAddition;
        const dueDate = new Date(Date.now() + LOAN_DURATION_MS);

        // Cộng tiền cho người chơi
        await processTransaction(targetUser.id, amount, 'LOAN_BORROW', `Vay tiền Casino (Admin: ${message.author.username})`, { guildId: message.guild?.id });
        
        // Cập nhật thông tin khoản vay vào DB
        await User.updateOne({ userId: targetUser.id }, { 
            $set: { loanAmountDue: totalAmountDue, loanDueDate: dueDate } 
        }, { upsert: true });

        const embed = Embed.success('Giải Ngân Thành Công 🏦', 
            `Đã giải ngân **${fmt(amount)} xu** cho <@${targetUser.id}>.\n` +
            (currentDebt > 0 ? `Nợ cũ: **${fmt(currentDebt)} xu**\n` : '') +
            `Lãi suất khoản mới: **${interestRate * 100}%** (+${fmt(newDebtAddition)} xu)\n` +
            `Tổng nợ phải trả: **${fmt(totalAmountDue)} xu**\n` +
            `Thời hạn: **<t:${Math.floor(dueDate.getTime() / 1000)}:R>** (sau 1 tiếng)\n\n` +
            `⚠️ *Lưu ý: Nếu quá hạn trả nợ, người chơi sẽ bị cấm dùng lệnh Casino cho đến khi trả đủ.*`);

        message.reply({ embeds: [embed] });
    }
};