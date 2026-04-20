// events/ready.js
// Sự kiện kích hoạt MỘT LẦN khi bot đăng nhập Discord thành công và sẵn sàng hoạt động.
// Dùng để log thông tin khởi động và có thể set Activity/Status cho bot.

module.exports = {
    name: 'clientReady', // discord.js v14+: đổi từ 'ready' sang 'clientReady'
    once: true,
    execute(client) {
        console.log('─'.repeat(40));
        console.log(`🤖 [Bot] Đã online: ${client.user.tag}`);
        console.log(`📊 [Bot] Đang phục vụ ${client.guilds.cache.size} server(s)`);
        console.log('─'.repeat(40));

        // Set trạng thái hiển thị của bot trên Discord
        client.user.setActivity('🎰 !help | CasinoPro', { type: 3 }); // type 3 = "Watching"
    },
};
