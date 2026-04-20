OwO gõ !owo hunt
  → OwO Bot phản hồi: "@User found a 🐺 wolf!"
  → CasinoPro nhận messageCreate event
  → Kiểm tra: message.author.id === '408785106942164992' ✓
  → Kiểm tra: content có chứa "found/caught/earned" ✓
  → Tự động cộng 50 xu cho @User (anti-farm: tối đa 20 lần/ngày)


2. Hướng dẫn setup & test bot
Bước 1 — Bật Intents trên Discord Developer Portal
Vào discord.com/developers/applications → chọn app → Bot → bật 3 toggle:

PRESENCE INTENT
SERVER MEMBERS INTENT
MESSAGE CONTENT INTENT ← bắt buộc để đọc nội dung lệnh

Bước 2 — Setup MongoDB Atlas (miễn phí)
Vào cloud.mongodb.com → tạo cluster Free (M0)
Database Access → tạo user/password
Network Access → Add IP → 0.0.0.0/0 (cho phép mọi IP, đơn giản khi dev)
Connect → Drivers → copy chuỗi URI dạng:

mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/casinopro?retryWrites=true&w=majority
Bước 3 — Điền .env

TOKEN=token_bot_của_bạn_từ_developer_portal
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/casinopro?retryWrites=true&w=majority
PREFIX=!
Lưu ý: Token hiện trong .env của bạn trông như là token thật — hãy giữ bí mật và không commit file .env lên GitHub.

Bước 4 — Chạy bot

npm install
npm start
# hoặc để auto-reload khi sửa code:
npm install -g nodemon
npm run dev
Bước 5 — Test từng tính năng
Lệnh	Kiểm tra gì
!bal	Bot phản hồi + tạo user trong MongoDB
!daily	Nhận 500 xu, gõ lại → thông báo cooldown
!work	Nhận 50–149 xu ngẫu nhiên
!claim	Thu nhập thụ động (cần chờ >1h hoặc test bằng cách sửa COINS_PER_HOUR tạm thời)
!cf 100	Coinflip — kiểm tra lock trong MongoDB sau khi gửi
!bj 100	Blackjack — thử nhấn các nút Hit/Stand/Double
!slots 100	Kiểm tra hiển thị 3 ô kết quả
!roulette 100 red	Đặt cược màu đỏ
!pay @user 50	Chuyển tiền — xác nhận ACID transaction (kiểm tra cả 2 tài khoản)
!lb	Leaderboard top 10
!addmoney @user 1000	Admin: bơm tiền (cần quyền Administrator)
!stats	Admin: thống kê tổng hệ thống
Test OwO integration
Mời OwO bot vào server
Dùng lệnh owo hunt hoặc owo battle
Khi OwO phản hồi có mention bạn → CasinoPro sẽ react 💰 và cộng 50 xu
Lưu ý quan trọng: MongoDB Atlas Free tier yêu cầu replica set để dùng ACID sessions (lệnh !pay). Atlas M0 có sẵn replica set nên hoạt động bình thường. Nếu tự host MongoDB local thì cần cấu hình thêm.