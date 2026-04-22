// utils/transaction.js
// Lớp xử lý giao dịch tài chính cốt lõi của hệ thống.
//
// THIẾT KẾ CHỐNG TRANH CHẤP DỮ LIỆU (Race Condition Safety):
//   - Dùng $inc (atomic operator) thay vì read-then-write để tránh lost update.
//   - Hỗ trợ MongoDB Session để bọc nhiều thao tác trong một Transaction ACID
//     (quan trọng khi chuyển tiền giữa 2 user: debit A + credit B phải atomically).
//   - balanceAfter được ghi vào Transaction log để admin audit mà không cần join.

const mongoose = require('mongoose');
const User        = require('../database/models/User');
const Transaction = require('../database/models/Transaction');

/**
 * Thực hiện một giao dịch tài chính an toàn cho một user.
 *
 * @param {string}  userId   - Discord User ID
 * @param {number}  amount   - Số tiền (dương = cộng, âm = trừ)
 * @param {string}  type     - Loại giao dịch (xem TRANSACTION_TYPES trong Transaction.js)
 * @param {string}  [reason] - Mô tả giao dịch để admin audit
 * @param {object}  [opts]   - Tuỳ chọn: { session, guildId }
 * @returns {Promise<object>} Document User sau khi cập nhật
 */
async function processTransaction(userId, amount, type, reason = '', opts = {}) {
    const { session = null, guildId = null } = opts;

    // findOneAndUpdate với $inc là atomic: không có khoảng hở giữa read và write
    const updatedUser = await User.findOneAndUpdate(
        { userId },
        { $inc: { balance: amount } },
        {
            returnDocument: 'after', // Trả về document sau khi update (để lấy balanceAfter)
            upsert:  true,    // Tự tạo user nếu chưa tồn tại (first-time player)
            session,          // Truyền session vào để tham gia transaction ACID nếu có
            runValidators: true, // Chạy validator Schema (chống balance < 0)
        }
    );

    // Ghi audit log — thực hiện trong cùng session để đảm bảo tính nhất quán
    await Transaction.create(
        [{ userId, guildId, type, amount, balanceAfter: updatedUser.balance, reason }],
        { session }
    );

    return updatedUser;
}

/**
 * Bọc một hàm async trong MongoDB Session + Transaction (ACID).
 * Dùng cho các thao tác multi-document cần all-or-nothing (ví dụ: !pay giữa 2 user).
 *
 * @param {Function} fn - Hàm async nhận (session) làm tham số
 * @returns {Promise<any>} Kết quả trả về từ fn
 *
 * @example
 * await withDbTransaction(async (session) => {
 *     await processTransaction(senderId, -amount, 'TRANSFER_OUT', reason, { session });
 *     await processTransaction(receiverId, amount, 'TRANSFER_IN', reason, { session });
 * });
 */
async function withDbTransaction(fn) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await fn(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        // Rollback toàn bộ nếu bất kỳ bước nào thất bại
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

module.exports = { processTransaction, withDbTransaction };
