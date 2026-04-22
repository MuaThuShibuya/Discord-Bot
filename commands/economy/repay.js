// commands/economy/repay.js
// Trả khoản nợ hiện tại để tránh bị siết nợ.
// Cú pháp: !repay

const User = require('../../database/models/User');
const { processTransaction } = require('../../utils/transaction');
const { Embed, fmt } = require('../../utils/embed');

module.exports = {
    name: 'repay',
    aliases: ['trano'],
    description: 'Trả khoản nợ đang vay. Cú pháp: !repay',

    async execute(message, args, client, userData) {
        if (!userData.loanAmountDue || userData.loanAmountDue <= 0) {
            return message.reply({ embeds: [Embed.success('Không Có Nợ', 'Tuyệt vời! Bạn không nợ xu nào.')] });
        }

        const amountDue = userData.loanAmountDue;
        const amountToPay = Math.min(userData.balance, amountDue);

        if (amountToPay <= 0) {
            return message.reply({ embeds: [Embed.error('Không Đủ Tiền', `Bạn không có đồng xu nào trong túi để trả nợ.`)] });
        }

        // Trừ tiền thanh toán nợ (trả toàn bộ hoặc trả một phần)
        await processTransaction(userData.userId, -amountToPay, 'LOAN_REPAY', 'Thanh toán nợ Casino', { guildId: message.guild?.id });
        
        const remainingDebt = amountDue - amountToPay;

        await User.updateOne({ userId: userData.userId }, { 
            $set: { 
                loanAmountDue: remainingDebt,
                ...(remainingDebt === 0 ? { loanDueDate: null } : {})
            } 
        });

        message.reply({ embeds: [Embed.success('Thanh Toán 💸', `Bạn đã thanh toán **${fmt(amountToPay)} xu**.\n` + (remainingDebt > 0 ? `Số nợ còn lại: **${fmt(remainingDebt)} xu**.` : `Bạn đã trả xong hoàn toàn khoản nợ. Cảm ơn!`))] });
    }
};