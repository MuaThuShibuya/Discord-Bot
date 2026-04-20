// database/connect.js
// Module kết nối MongoDB Atlas sử dụng Mongoose.
// Bot sẽ dừng hoàn toàn (process.exit) nếu không kết nối được DB,
// tránh bot chạy mà không có dữ liệu — gây hành vi không xác định.

const mongoose = require('mongoose');

async function connectDB() {
    try {
        // strictQuery: false cho phép query với các field không khai báo trong Schema (linh hoạt hơn khi debug)
        mongoose.set('strictQuery', false);

        await mongoose.connect(process.env.MONGO_URI, {
            // Tự động reconnect — cần thiết cho môi trường production 24/7
            serverSelectionTimeoutMS: 5000, // Timeout 5s nếu không tìm được server
        });

        console.log('✅ [Database] Kết nối MongoDB Atlas thành công!');
    } catch (error) {
        console.error('❌ [Database] Lỗi kết nối MongoDB:', error.message);
        process.exit(1); // Dừng toàn bộ bot — không cho chạy không có DB
    }

    // Lắng nghe sự kiện mất kết nối sau khi đã connect thành công (ví dụ: mạng chập chờn)
    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ [Database] Mất kết nối MongoDB — đang thử reconnect...');
    });
    mongoose.connection.on('reconnected', () => {
        console.log('✅ [Database] Reconnect MongoDB thành công!');
    });
}

module.exports = connectDB;
