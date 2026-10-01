# Kết quả kiểm thử — cập nhật 02/10/2026

## Bản chạy local: kết quả mới nhất

`npm.cmd run verify` đạt **35/35** kiểm thử với SQLite trong bộ nhớ, build production thành công và kiểm tra HTTP bản build thành công (HTML, JavaScript/CSS, favicon, script in phiếu, health, thực đơn, đăng nhập quản trị, báo cáo và CSV). Ba kiểm thử mới xác minh dừng server nhiều lần an toàn, từ chối cổng đang dùng và từ chối giá trị cổng không hợp lệ.

Server chờ kết quả mở cổng trước khi thông báo sẵn sàng; lỗi khởi động đóng pool database và thoát. Ctrl+C/SIGTERM đóng HTTP và database, với giới hạn chờ kết nối HTTP. Có lệnh `verify` và file `KIEM-TRA-DU-AN.cmd` để chạy lại trước buổi demo.

Đã giải nén ZIP vào thư mục thử mới, cài đủ 97 package bằng `npm ci --offline` từ cache và chạy lại `verify`: 35/35 đạt, build và kiểm tra HTTP đạt. Archive có manifest SHA-256 và không chứa `.env`, database hoặc node_modules. Máy khác cần mạng nếu chưa có cache thư viện. Website làm việc đã khởi động lại với MySQL; `db:check` và `/api/health` thành công. Thử mở thêm server trên cổng 3000 báo trùng cổng, thoát mã 1 trong khoảng một giây và không dừng website đang chạy.

Lần kiểm thử MySQL riêng gần nhất đạt 32/32 trước khi thêm ba kiểm thử HTTP độc lập database. Không diễn giải kết quả này thành 35 kiểm thử đã chạy lại trên MySQL. Các mục dưới ghi lại các đợt kiểm tra trước đó; số bảng và chế độ database ở mỗi đợt là trạng thái tại thời điểm kiểm tra.

## Cập nhật ngày 02/10/2026: ảnh, cửa hàng và migration

32/32 kiểm thử đạt ở lượt SQLite và 32/32 ở lượt MySQL 8.0.41 thử riêng. Kiểm tra bổ sung bao gồm quyền quản trị ảnh/thông tin cửa hàng; từ chối ảnh sai định dạng/quá dung lượng; tải, đọc, xóa JPEG; tắt khu vực chặn báo giá mới nhưng giữ phí đơn cũ; migration lặp không làm mất dữ liệu.

Chrome đã chạy luồng sửa cửa hàng, thêm khu vực, chuyển ảnh qua canvas rồi tải lên, hiển thị ảnh tại thực đơn, địa chỉ nhận hàng và phí giao trong giỏ. Kiểm tra 390px không tràn ngang ở cửa hàng và cấu hình. Build thành công sau khi tách giao diện thành các module.

Đã sao lưu database MySQL đang sử dụng trong data/db-backups trước khi nâng cấp. Migration và chạy lại migration đã được so sánh: giá/tên món, toàn bộ trường đơn hàng, tài khoản và password_hash không thay đổi. Thử nghiệm MySQL riêng cũng xác minh nâng cấp từ schema cũ. Dịch vụ MySQL kiểm thử cổng 3307 đã tắt; website tiếp tục dùng database MySQL do người dùng cấu hình.

Hình minh họa mặc định vẫn được dùng cho món chưa tải ảnh. Không tự điền địa chỉ, số điện thoại hoặc giờ mở cửa thực của người dùng.

## Môi trường

Windows x64, Node 24.18.0, npm 11.16.0, Chrome 154, MySQL 8.0.41. Các thư viện được khóa trong package-lock.json.

## API / nghiệp vụ

17/17 test đạt trên SQLite in-memory và 17/17 test đạt trên MySQL 8.0.41.

MySQL kiểm thử là tiến trình tạm riêng tại 127.0.0.1:3307, database tea_house_test, data directory trong thư mục work. Đã tắt sau kiểm thử. Không dùng tài khoản hay thay dữ liệu của dịch vụ MySQL80 sẵn có tại cổng 3306. Vì vậy kết quả xác minh code tương thích MySQL, không xác minh tài khoản đăng nhập database hiện có của người dùng.

Các kiểm tra: catalog, session đăng nhập, mật khẩu sai, quyền quản trị, tính tiền và chống sửa giá client, tùy chọn không hợp lệ, coupon hết hạn/đơn tối thiểu, hết món/topping, giá thay đổi, request trùng đồng thời, quyền sở hữu đơn, chuyển trạng thái, snapshot giá cũ, doanh thu, hủy đơn, giới hạn coupon đồng thời, rollback transaction và logout/cross-origin.

Chạy lại SQLite: `npm.cmd test`. MySQL test chỉ chạy khi TEST_MYSQL=1 và DB_NAME=tea_house_test; cần tự chuẩn bị database thử sạch và DB_HOST/DB_PORT/DB_USER/DB_PASSWORD tương ứng. Không chạy vào database đang sử dụng.

## Giao diện

Đã dùng Chrome headless với Playwright để thực hiện:

- Desktop 1440px: tải 12 món, đăng nhập khách, chọn size L / 50% đường / ít đá / trân châu / 2 ly.
- Áp dụng CHAO10, xác minh tổng 88.000đ cho nhận tại quầy, tạo đơn và xem lịch sử.
- Đăng nhập quản trị, xác nhận → pha chế → chờ nhận → hoàn thành và thu tiền.
- Xác minh doanh thu cập nhật 88.000đ và chỉnh sửa món.
- Mobile 390px: không tràn ngang, mở/đóng bảng tùy chọn, tìm kiếm không có kết quả.
- Giỏ hàng: sửa size/mức đường của món đã thêm, kiểm tra báo giá cập nhật và xóa hết giỏ.
- Không có lỗi JavaScript trong các luồng đã chạy.

Một đơn mẫu có ghi chú kiểm thử được giữ trong SQLite local để minh họa báo cáo. Gói source ZIP không chứa dữ liệu SQLite hoặc session; khi chạy lần đầu sẽ tạo dữ liệu sạch.

## Xác minh kết nối MySQL trên máy người dùng

Sau khi người dùng hoàn tất trình cấu hình: `db:check` kết nối thành công MySQL 8.0.41, đủ 10 bảng và tài khoản. Website đã được khởi động lại, `/api/health` trả mode=mysql; catalog đọc được 12 đồ uống, 4 danh mục và 5 topping.

Đã tạo một tài khoản khách QA tạm để kiểm tra đăng ký, đăng nhập, session, chặn truy cập quản trị và đăng xuất trên database MySQL đã cấu hình. Tài khoản QA cùng session đã được xóa sau kiểm tra; không tạo đơn hàng. Chrome tải thực đơn từ MySQL, không còn thanh demo SQLite, biểu mẫu đăng nhập hiển thị và không có lỗi JavaScript.

## Giới hạn xác minh

## Bổ sung phiếu thanh toán và CSV

28/28 kiểm thử đạt: bổ sung quyền đọc phiếu của chủ đơn/admin, chặn người khác, quyền xuất CSV, tổng tiền CSV khớp doanh thu, HTML escape, định dạng CSV và chặn công thức, ngày không tồn tại và biên ngày UTC+7. Frontend production build thành công.

Chrome kiểm thử trên database SQLite tạm trong bộ nhớ: mở phiếu từ giao diện Đơn của tôi, tổng 88.000đ đúng giá đã chốt, trạng thái đã thanh toán, nút in gọi chức năng in của trình duyệt; chế độ print ẩn điều khiển, trang không tràn ngang ở 390px. Tải CSV từ giao diện quản trị thành công, có BOM UTF-8 và dòng tổng. Khi sửa bộ lọc nhưng chưa bấm Xem báo cáo, file vẫn dùng kỳ đang hiển thị. Không có lỗi JavaScript trong luồng này. Không in giấy vật lý hoặc kiểm tra hộp thoại lưu PDF của hệ điều hành.

Website MySQL được khởi động lại sau cập nhật. Kiểm thử trình duyệt tính năng mới không tạo đơn trong database đang dùng của người dùng.

## Giới hạn còn lại

Bổ sung trình cấu hình MySQL: 21/21 test đạt trên lần kiểm tra tiếp theo, gồm 17 test API và 4 test cấu hình: kiểm tra tên database/cổng, lưu chính xác mật khẩu có ký tự đặc biệt, sao lưu cấu hình, giữ thiết lập ngoài database và thông báo lỗi không lộ mật khẩu. `db:check` cũng xác nhận đúng chế độ demo hiện tại. Các test này chưa thay thế việc nhập tài khoản MySQL thật của người dùng.

Chưa kiểm thử tải lớn, nhiều tiến trình Node, trình duyệt Safari hoặc triển khai HTTPS công khai. Không có tích hợp thanh toán/giao hàng bên ngoài. Test đảm bảo các luồng đã nêu; không phải cam kết không còn lỗi.
