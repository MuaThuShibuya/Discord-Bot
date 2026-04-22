// database/models/Transaction.js
// Bảng ghi chép (Audit Log) toàn bộ luồng tiền của hệ thống.
// Chỉ INSERT, không bao giờ UPDATE hay DELETE thủ công — đảm bảo tính toàn vẹn lịch sử.
// TTL Index tự xóa log sau 30 ngày để tiết kiệm dung lượng MongoDB Atlas (Free: 512MB).

const mongoose = require('mongoose');

// Danh sách các loại giao dịch hợp lệ — enum cứng để tránh data rác
const TRANSACTION_TYPES = Object.freeze([
    'WORK',          // Kiếm tiền từ lệnh !work
    'DAILY',         // Thưởng điểm danh !daily
    'CLAIM',         // Thu nhập thụ động qua !claim
    'OWO_BONUS',     // Thưởng tích hợp từ bot OwO
    'BET_WIN',       // Thắng cược casino
    'BET_LOSS',      // Thua cược casino
    'ADMIN_ADD',     // Admin bơm tiền
    'ADMIN_REMOVE',  // Admin trừ tiền
    'ADMIN_RESET',   // Admin xóa trắng tài khoản
    'TRANSFER_OUT',  // Chuyển tiền đi (người gửi)
    'TRANSFER_IN',   // Nhận tiền (người nhận)
    'LOAN_BORROW',   // Vay tiền từ Casino
    'LOAN_REPAY',    // Người chơi chủ động trả nợ
    'LOAN_REPAY_AUTO',// Hệ thống tự động siết nợ
]);

const transactionSchema = new mongoose.Schema({
    userId:  { type: String, required: true },
    guildId: { type: String, default: null }, // Ghi nhận server để phân tích per-guild

    type: {
        type: String,
        required: true,
        enum: TRANSACTION_TYPES,
    },

    amount:    { type: Number, required: true }, // Dương = nhận, Âm = mất
    balanceAfter: { type: Number, default: null }, // Snapshot số dư SAU giao dịch để audit dễ hơn
    reason:    { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }, // Không đặt index: true ở đây — đã có schema.index() bên dưới
});

// Index compound: admin thường query "lịch sử của userId X trong 7 ngày"
transactionSchema.index({ userId: 1, timestamp: -1 });

// TTL Index: tự động xóa document sau 30 ngày (2.592.000 giây) — do MongoDB Atlas background job xử lý
transactionSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2_592_000 });

// Xuất enum ra ngoài để các module khác dùng, tránh hard-code string
module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
