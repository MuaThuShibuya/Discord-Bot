// database/models/Guild.js
// Schema cấu hình riêng cho từng Discord Server (Guild).
// Mỗi server có một document độc lập — cài đặt của server A không ảnh hưởng server B.

const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema(
    {
        guildId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        prefix: {
            type: String,
            default: '!',
            maxlength: [5, 'Prefix tối đa 5 ký tự'],
        },

        // Danh sách channel được phép dùng lệnh Casino.
        // Mảng rỗng [] = không giới hạn (bot hoạt động ở mọi kênh).
        casinoChannels: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Guild', guildSchema);
