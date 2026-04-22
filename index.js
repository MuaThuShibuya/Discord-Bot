// index.js
// Điểm khởi chạy chính (Entry Point) của CasinoPro Bot.
// Thứ tự: keepAlive (HTTP) → kết nối DB → nạp Events → nạp Commands → đăng nhập Discord.

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs        = require('fs');
const path      = require('path');
const connectDB  = require('./database/connect');
const keepAlive  = require('./utils/keepAlive'); // HTTP server để Render không ngủ đông

// --- Bước 0: Khởi động HTTP server TRƯỚC — Render cần nhận cổng sớm nhất có thể ---
keepAlive();

// --- Khởi tạo Discord Client ---
// Chỉ khai báo đúng các Intent cần thiết — tránh yêu cầu quyền thừa
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Cần để đọc nội dung tin nhắn (prefix commands)
    ],
});

// Collection lưu tất cả lệnh — key là tên lệnh hoặc alias
client.commands = new Collection();

// --- Bước 1: Kết nối Database ---
// Bot sẽ dừng (process.exit) nếu kết nối thất bại — xem database/connect.js
connectDB();

// --- Bước 2: Nạp Events ---
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`📡 [Events] Đã nạp: ${event.name}`);
    }
}

// --- Bước 3: Nạp Commands + Aliases ---
// Cấu trúc thư mục: commands/<category>/<command>.js
// Mỗi command có thể khai báo thêm mảng `aliases` để hỗ trợ lệnh viết tắt (ví dụ: !cf → coinflip)
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(path.join(folderPath, file));

            if (!('name' in command) || !('execute' in command)) {
                console.warn(`⚠️ [Commands] Bỏ qua ${file} — thiếu "name" hoặc "execute".`);
                continue;
            }

            // Đăng ký lệnh chính
            client.commands.set(command.name, command);

            // Đăng ký các alias (ví dụ: 'cf', 'bj', 'lb') trỏ vào cùng một command object
            if (Array.isArray(command.aliases)) {
                for (const alias of command.aliases) {
                    client.commands.set(alias, command);
                }
            }

            console.log(`⚙️  [Commands] Đã nạp: ${command.name}${command.aliases?.length ? ` (alias: ${command.aliases.join(', ')})` : ''}`);
        }
    }
}

// --- Bước 4: Đăng nhập ---
client.login(process.env.TOKEN);

// --- Bảo vệ process khỏi crash do unhandled rejection / uncaught exception ---
process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err);
});
