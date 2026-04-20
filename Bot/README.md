# 🎰 CasinoPro Bot - Hệ thống Kinh tế & Casino Discord Chuyên nghiệp

Bot Discord chuyên nghiệp cung cấp hệ thống kinh tế hoàn chỉnh và các trò chơi casino phong phú. Bot được thiết kế với kiến trúc bảo mật cao, cô lập dữ liệu người dùng và có khả năng tích hợp/lắng nghe sự kiện từ các bot khác (như OwO, Mudae) để làm nhiệm vụ.

---

## 📋 Danh sách kiểm tra Tính năng (Feature Checklist)

### 👤 Chức năng Người dùng (User Features)
Hệ thống kinh tế cơ bản:
- [ ] `!balance / !bal` - Kiểm tra số dư cá nhân.
- [ ] `!work` - Làm việc kiếm tiền (có Cooldown).
- [ ] `!daily` - Nhận phần thưởng mỗi 24h.
- [ ] `!pay @user <amount>` - Chuyển tiền cho người chơi khác.
- [ ] `!leaderboard / !lb` - Bảng xếp hạng đại gia trong server/toàn cầu.

Hệ thống Casino (Core):
- [ ] `!coinflip / !cf <bet_amount>` - Lật đồng xu (Tỷ lệ 50/50).
- [ ] `!slots <bet_amount>` - Quay hũ xèng.
- [ ] `!blackjack / !bj <bet_amount>` - Chơi xì dách với Dealer (Bot) (Logic bốc bài, dừng, nhân đôi).
- [ ] `!roulette <bet_amount> <color/number>` - Chơi cò quay Nga (Red/Black/Green).

Chức năng Tích hợp (Integration/Tasks):
- [ ] Nhận diện tự động: Người dùng tương tác với Bot OwO (ví dụ làm lệnh `owo hunt`) sẽ nhận được thêm % tiền thưởng bên CasinoPro.
- [ ] `!claim` - Đổi vật phẩm từ bot khác thành tiền trong CasinoPro (Yêu cầu API hoặc webhook nếu có thể, hoặc qua hệ thống kiểm duyệt log).

### 🛡️ Chức năng Quản trị viên (Admin/Owner Features)
- [ ] `!addmoney @user <amount>` - Bơm tiền cho người dùng (Chỉ Owner/Admin).
- [ ] `!removemoney @user <amount>` - Trừ tiền người dùng vi phạm.
- [ ] `!reset @user` - Xóa trắng tài khoản người chơi.
- [ ] `!blacklist @user` - Cấm người dùng sử dụng bot (Ngăn chặn spam/hack).
- [ ] `!setcasinochannel #channel` - Giới hạn bot chỉ hoạt động trong một số kênh nhất định.
- [ ] `!stats` - Thống kê tổng số tiền đang lưu thông, tổng số người chơi.

---

## 🏗️ Kiến trúc & Logic Hoạt động

### 1. Kiến trúc Cơ sở dữ liệu (MongoDB & CRUD Cô lập)
Để đảm bảo thao tác CRUD không ảnh hưởng chéo, Database sẽ được chia thành các **Collections** độc lập:
- **Users Collection**: Lưu `userId`, `balance`, `lastDaily`, `lastWork`, `isBlacklisted`. (Chỉ cập nhật tài sản cá nhân, không đụng tới lịch sử).
- **Guilds Collection**: Lưu `guildId`, `allowedChannels`, `prefix`. (Cấu hình riêng cho từng server).
- **Transactions Collection**: Ghi log mọi giao dịch (Add, Remove, Bet, Pay) với `transactionId`, `userId`, `type`, `amount`, `timestamp`. (Dùng để admin audit, phát hiện hack/bug tiền).

*Quy tắc CRUD:* Khi chơi lệnh `!cf`, bot thực hiện `Read` (Kiểm tra tiền) -> Xử lý Logic (Thắng/Thua) -> `Update` (Cộng/Trừ tiền) bằng `findOneAndUpdate` để tránh lỗi Race Condition (spam click nhiều lần).

### 2. Quy trình & Logic Cốt lõi (Workflows)

#### A. Luồng Kiếm tiền (Economy Flow)
1. Người dùng gõ `!work` hoặc `!daily`.
2. Bot kiểm tra Database xem người dùng có bị `Blacklist` không.
3. Bot kiểm tra `Cooldown` (thời gian chờ). Nếu chưa hết giờ, báo lỗi.
4. Nếu hợp lệ, random số tiền thưởng -> `Update` balance -> Ghi log vào `Transactions`.
5. Gửi thông báo thành công.

#### B. Luồng Chơi Casino (Betting Flow)
1. Người dùng gõ lệnh cược (vd: `!blackjack 500`).
2. **Validate**:
   - Kiểm tra định dạng đầu vào (500 phải là số nguyên dương).
   - Kiểm tra số dư người dùng (Balance >= 500).
3. **Khóa tạm thời (Mutex/Lock)**: Đánh dấu user đang trong 1 ván bài để tránh việc họ gõ lệnh khác cùng lúc lấy tiền ra.
4. **Thực thi Game**: Khởi tạo bàn Blackjack, tương tác qua lại bằng Discord Buttons (Hit/Stand).
5. **Kết quả & Thanh toán**: Thắng/Thua -> Cập nhật Database -> Gỡ khóa (Unlock) tài khoản -> Ghi log.

#### C. Luồng Tích hợp Bot ngoài (OwO Integration Flow)
*Làm sao để kiếm tiền từ OwO rồi đem qua Casino?*
1. **Event Listener**: Bot lắng nghe sự kiện `messageCreate`.
2. **Condition**: Nếu `message.author.id` là ID của bot OwO và nội dung có nhắc đến `@User` đang làm nhiệm vụ.
3. **Reward**: Bot của chúng ta tự động "bắt" sự kiện đó, và tự động gọi hàm `addMoney(userId, bonus_amount)` vào Database của CasinoPro.
4. *Lưu ý*: Có hệ thống chống lạm dụng (anti-farm) bằng cách giới hạn số lần nhận thưởng từ bot ngoài mỗi ngày.

---

## 🚀 Cấu trúc Thư mục Dự kiến (Folder Structure)

```text
CasinoPro/
├── .env                  # Lưu Token và DB URI (Bảo mật)
├── index.js              # File khởi chạy chính
├── database/
│   ├── connect.js        # Kết nối MongoDB
│   └── models/           # Các Schema: User.js, Guild.js, Transaction.js
├── events/               # Xử lý sự kiện (messageCreate, ready)
├── commands/
│   ├── economy/          # bal.js, work.js, daily.js, pay.js
│   ├── casino/           # coinflip.js, slots.js, blackjack.js
│   └── admin/            # addmoney.js, blacklist.js, setconfig.js
└── utils/
    ├── cooldown.js       # Quản lý thời gian chờ
    └── rng.js            # Trình tạo số ngẫu nhiên an toàn cho Casino
```

---

## 🛠️ Hướng dẫn cài đặt cho Developer
1. Clone repository.
2. Chạy `npm install` để tải `discord.js` và `mongoose`.
3. Điền thông tin vào file `.env`.
4. Chạy `node index.js` hoặc cấu hình lên **Render/VPS** để chạy 24/7.
