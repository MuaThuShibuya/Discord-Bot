// utils/embed.js
// Bộ công cụ xây dựng Discord Embed dùng chung — đảm bảo UI/UX nhất quán toàn bộ bot.
// Tất cả command đều import từ đây thay vì tự tạo EmbedBuilder riêng lẻ.

const { EmbedBuilder } = require('discord.js');

// ── Bảng màu thống nhất ────────────────────────────────────────────────────────
const COLORS = Object.freeze({
    SUCCESS: 0x2ECC71,  // Xanh lá — thành công / thắng
    ERROR:   0xE74C3C,  // Đỏ      — lỗi / thua
    WARNING: 0xF39C12,  // Cam     — cảnh báo / cooldown
    INFO:    0x3498DB,  // Xanh da — thông tin
    CASINO:  0xFFD700,  // Vàng    — casino / jackpot
    ECONOMY: 0x1ABC9C,  // Ngọc lam— kinh tế
    ADMIN:   0x9B59B6,  // Tím     — quản trị
    NEUTRAL: 0x5865F2,  // Discord — trung tính
    PLAYING: 0x2C3E50,  // Tối     — đang trong game
});

// ── Tips ngẫu nhiên hiển thị ở footer ────────────────────────────────────────
const TIPS = [
    '💡 Dùng !daily mỗi ngày để nhận 500 xu miễn phí.',
    '💡 !claim tích lũy 10 xu/giờ, nhớ nhận trước khi đầy (tối đa 24h).',
    '💡 Blackjack Natural (21 ngay lá đầu) thắng x1.5 cược!',
    '💡 Roulette số cụ thể thắng x36 — rủi ro cao, lợi nhuận lớn.',
    '💡 Slots trúng 3 💎💎💎 nhân x5 tiền cược — Jackpot!',
    '💡 !pay để chuyển tiền cho bạn bè trong server.',
    '💡 Dùng !lb để xem bạn đang đứng thứ mấy trên BXH.',
    '💡 !work mỗi giờ để kiếm thêm thu nhập ổn định.',
    '💡 Chơi OwO Bot cùng server để nhận thêm xu thưởng tự động.',
    '💡 Double Down trong Blackjack để nhân đôi cược khi tự tin!',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format số theo chuẩn Việt Nam có dấu chấm phân cách hàng nghìn */
function fmt(n) {
    return Number(n).toLocaleString('vi-VN');
}

/** Thanh tiến trình bằng ký tự — hiển thị cooldown hoặc progress */
function progressBar(current, max, length = 12) {
    const pct    = Math.min(current / max, 1);
    const filled = Math.round(pct * length);
    const empty  = length - filled;
    const bar    = '█'.repeat(filled) + '░'.repeat(empty);
    return `\`${bar}\` ${Math.round(pct * 100)}%`;
}

/** Lấy tip ngẫu nhiên để hiển thị ở footer */
function randomTip() {
    return TIPS[Math.floor(Math.random() * TIPS.length)];
}

/** Mũi tên thay đổi số dư: 1.000 xu → 1.100 xu */
function balanceChange(before, after) {
    const diff   = after - before;
    const sign   = diff >= 0 ? '+' : '';
    const arrow  = diff >= 0 ? '📈' : '📉';
    return `${arrow} \`${fmt(before)} → ${fmt(after)} xu\` _(${sign}${fmt(diff)})_`;
}

// ── Base embed (gắn footer + timestamp vào mọi embed) ────────────────────────
function base(tip = true) {
    const embed = new EmbedBuilder().setTimestamp();
    if (tip) embed.setFooter({ text: randomTip(), iconURL: 'https://cdn.discordapp.com/emojis/1023032745195999282.webp' });
    return embed;
}

// ── Preset factories ──────────────────────────────────────────────────────────

const Embed = {
    /** Thành công (xanh lá) */
    success(title, description) {
        return base().setColor(COLORS.SUCCESS).setTitle(`✅  ${title}`).setDescription(description ?? null);
    },

    /** Lỗi (đỏ) */
    error(title, description) {
        return base(false).setColor(COLORS.ERROR).setTitle(`❌  ${title}`).setDescription(description ?? null);
    },

    /** Cảnh báo / cooldown (cam) */
    warning(title, description) {
        return base(false).setColor(COLORS.WARNING).setTitle(`⏳  ${title}`).setDescription(description ?? null);
    },

    /** Thông tin (xanh da) */
    info(title, description) {
        return base().setColor(COLORS.INFO).setTitle(`ℹ️  ${title}`).setDescription(description ?? null);
    },

    /** Casino — trung tính (vàng) */
    casino(title, description, betAmount) {
        const e = base().setColor(COLORS.CASINO).setTitle(`🎰  ${title}`).setDescription(description ?? null);
        if (betAmount !== undefined) e.setFooter({ text: `Cược: ${fmt(betAmount)} xu  •  ${randomTip()}` });
        return e;
    },

    /** Thắng casino (vàng sáng) */
    win(title, description, betAmount) {
        const e = base().setColor(COLORS.SUCCESS).setTitle(`🏆  ${title}`).setDescription(description ?? null);
        if (betAmount !== undefined) e.setFooter({ text: `Cược: ${fmt(betAmount)} xu  •  ${randomTip()}` });
        return e;
    },

    /** Thua casino (đỏ) */
    lose(title, description, betAmount) {
        const e = base().setColor(COLORS.ERROR).setTitle(`💀  ${title}`).setDescription(description ?? null);
        if (betAmount !== undefined) e.setFooter({ text: `Cược: ${fmt(betAmount)} xu  •  ${randomTip()}` });
        return e;
    },

    /** Kinh tế (ngọc lam) */
    economy(title, description) {
        return base().setColor(COLORS.ECONOMY).setTitle(`💰  ${title}`).setDescription(description ?? null);
    },

    /** Quản trị (tím) */
    admin(title, description) {
        return base(false).setColor(COLORS.ADMIN).setTitle(`🛡️  ${title}`).setDescription(description ?? null);
    },

    /** Đang chơi game (tối) */
    playing(title, description, betAmount) {
        const e = base(false).setColor(COLORS.PLAYING).setTitle(`🎮  ${title}`).setDescription(description ?? null);
        if (betAmount !== undefined) e.setFooter({ text: `Cược: ${fmt(betAmount)} xu  •  Chọn hành động bên dưới` });
        return e;
    },
};

module.exports = { COLORS, fmt, progressBar, randomTip, balanceChange, Embed };
