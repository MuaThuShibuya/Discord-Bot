📋 Danh sách lệnh Admin
Tất cả lệnh dưới đây yêu cầu quyền Administrator trên Discord Server.

Lệnh	                            Chức năng	            
!addmoney @user <số>	        | Bơm tiền vào tài khoản
!addmoney @Nam 5000

!removemoney @user <số>	        | Trừ tiền người vi phạm
!removemoney @Nam 1000

!reset @user --confirm	        | Xóa trắng tài khoản (cần --confirm)!reset @Nam --confirm

!blacklist @user	            | Toggle cấm/mở cấm dùng bot
!blacklist @Nam

!setconfig prefix <ký_tự>	    | Đổi prefix lệnh của server
!setconfig prefix $

!setcasinochannel add #kênh	    | Thêm kênh được phép dùng casino
!setcasinochannel add #casino

!setcasinochannel remove #kênh	| Xóa kênh khỏi danh sách
!setcasinochannel remove #casino

!setcasinochannel list	        | Xem danh sách kênh đang giới hạn
!setcasinochannel list

!setcasinochannel clear	        | Bỏ giới hạn, bot hoạt động mọi kênh
!setcasinochannel clear

!stats                          | Thống kê tổng quan hệ thống