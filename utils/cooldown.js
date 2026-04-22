// utils/cooldown.js
// Tiện ích quản lý thời gian chờ (Cooldown) dùng chung cho các lệnh economy và casino
// Giúp tránh lặp code cooldown check ở mỗi lệnh riêng lẻ

/**
 * Kiểm tra xem người dùng có đang trong thời gian cooldown không.
 * @param {Date|null} lastTimestamp - Thời điểm lần cuối sử dụng lệnh
 * @param {number} cooldownMs - Thời gian cooldown tính bằng milliseconds
 * @returns {{ onCooldown: boolean, hoursLeft?: number, minutesLeft?: number }}
 */
function checkCooldown(lastTimestamp, cooldownMs) {
    if (!lastTimestamp) return { onCooldown: false };

    const elapsed = Date.now() - new Date(lastTimestamp).getTime();
    if (elapsed >= cooldownMs) return { onCooldown: false };

    const remaining = cooldownMs - elapsed;
    return {
        onCooldown: true,
        remainingMs: remaining,
        hoursLeft: Math.floor(remaining / 3_600_000),
        minutesLeft: Math.floor((remaining % 3_600_000) / 60_000),
    };
}

/**
 * Format thời gian cooldown còn lại thành chuỗi tiếng Việt dễ đọc.
 * @param {number} hoursLeft
 * @param {number} minutesLeft
 * @returns {string}
 */
function formatCooldown(hoursLeft, minutesLeft) {
    if (hoursLeft > 0) return `${hoursLeft} giờ ${minutesLeft} phút`;
    if (minutesLeft > 0) return `${minutesLeft} phút`;
    return 'ít hơn 1 phút';
}

module.exports = { checkCooldown, formatCooldown };
