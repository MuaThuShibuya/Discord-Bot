// database/models/User.js
// Schema tài khoản người chơi. Mỗi document là một user độc lập.
// Thiết kế cô lập CRUD: thao tác trên user A không thể ảnh hưởng đến user B.
// Sử dụng Optimistic Locking tích hợp sẵn của Mongoose (__v) + Atomic Operators ($inc, $set).

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
            index: true, // B-Tree index để lookup O(log n) thay vì O(n)
        },

        balance: {
            type: Number,
            default: 0,
            min: [0, 'Số dư không thể âm — lỗi nghiệp vụ nghiêm trọng'], // Guard cuối cùng chống âm tiền
        },

        // --- Timestamps cooldown (null = chưa dùng lần nào) ---
        lastWork:  { type: Date, default: null },
        lastDaily: { type: Date, default: null },
        lastClaim: { type: Date, default: null }, // Thu nhập thụ động qua !claim

        // --- Quản trị & Bảo mật ---
        isBlacklisted: { type: Boolean, default: false },

        // --- Mutex Lock cho Casino ---
        // isLocked: ngăn user mở nhiều ván bài song song (chống double-spend)
        // lockedAt: timestamp để tự động mở khóa nếu bot crash giữa chừng (stale lock recovery)
        isLocked:  { type: Boolean, default: false },
        lockedAt:  { type: Date,    default: null  },

        // --- Chống lạm dụng OwO Integration (Anti-Farm) ---
        owoDailyCount: { type: Number, default: 0  }, // Số lần nhận thưởng OwO trong ngày
        owoResetDate:  { type: Date,   default: null }, // Ngày cuối reset bộ đếm OwO
    },
    {
        timestamps: true, // Tự động thêm createdAt, updatedAt
        optimisticConcurrency: true, // Bật Optimistic Locking qua __v để phát hiện write conflict
    }
);

// Compound index: tăng tốc query lọc user chưa bị ban, thường dùng trong leaderboard
userSchema.index({ isBlacklisted: 1, balance: -1 });

module.exports = mongoose.model('User', userSchema);
