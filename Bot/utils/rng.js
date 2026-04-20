// utils/rng.js
// Trình tạo số ngẫu nhiên an toàn sử dụng crypto module của Node.js
// Dùng thay thế cho Math.random() trong các trò chơi Casino để đảm bảo tính công bằng

const crypto = require('crypto');

/**
 * Trả về số nguyên ngẫu nhiên bảo mật trong khoảng [min, max] (bao gồm cả hai đầu).
 * Sử dụng crypto.randomBytes để tránh bias từ Math.random().
 */
function secureRandom(min, max) {
    const range = max - min + 1;
    // Tính số byte cần thiết để cover range, tránh modulo bias
    const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
    const maxUnbiased = Math.floor(256 ** bytesNeeded / range) * range;

    let value;
    do {
        const buf = crypto.randomBytes(bytesNeeded);
        value = buf.readUIntBE(0, bytesNeeded);
    } while (value >= maxUnbiased); // Loại bỏ các giá trị gây bias

    return min + (value % range);
}

/**
 * Xáo trộn mảng theo thuật toán Fisher-Yates sử dụng secureRandom.
 * Trả về mảng đã xáo trộn (in-place).
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = secureRandom(0, i);
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

module.exports = { secureRandom, shuffleArray };
