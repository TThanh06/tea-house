# Nghiệm thu và demo local

## Trước buổi trình bày

1. Mở `KIEM-TRA-DU-AN.cmd`: chờ test, build, kiểm tra tài nguyên/API và kết nối database báo thành công.
2. Mở `CHAY-DU-AN.cmd` nếu website chưa chạy. Dùng một cửa sổ server; nếu báo trùng cổng, kiểm tra cửa sổ đang mở.
3. Truy cập http://127.0.0.1:3000. Đăng nhập bằng tài khoản và mật khẩu đã tạo cho database đang dùng.
4. Trong Quản trị → Cửa hàng, kiểm tra tên/địa chỉ/điện thoại/vùng giao. Trong Đồ uống, bổ sung ảnh nếu cần.
5. Kiểm tra món mẫu còn bán, topping còn hàng, mã CHAO10 còn hiệu lực và chưa hết lượt. Nếu thay giá, tính lại ví dụ demo.

## Kịch bản 5–7 phút

| Thời gian | Thao tác | Điểm giải thích |
|---|---|---|
| 0:00–0:45 | Giới thiệu thực đơn, tìm kiếm, giao diện điện thoại | React responsive và API catalog |
| 0:45–1:30 | Chọn size L, 50% đường, ít đá, trân châu, 2 ly | Mỗi dòng giỏ là một cấu hình món |
| 1:30–2:15 | Nhận tại quầy, áp mã, đặt đơn | Backend tính giá, kiểm tra coupon, transaction |
| 2:15–3:00 | Xem chi tiết và tiến độ | Snapshot giá/topping, quyền sở hữu đơn |
| 3:00–4:15 | Đăng nhập quản trị và xử lý đến hoàn thành | Kiểm tra chuyển trạng thái; xác nhận thu tiền |
| 4:15–5:00 | Xem doanh thu và tải CSV | Khoảng ngày UTC+7, chỉ đơn đã hoàn thành/thu tiền |
| 5:00–5:45 | Mở phiếu thanh toán và in/lưu PDF | Quyền truy cập, HTML escape |
| 5:45–7:00 | Minh họa thay ảnh hoặc tắt một vùng giao | Quản trị dữ liệu, kiểm tra tại server |

Với dữ liệu seed gốc: 2 ly trà sữa trân châu size L + topping trân châu đen có tiền món 98.000đ; CHAO10 giảm 10.000đ; nhận tại quầy tổng 88.000đ. Đây là ví dụ theo giá seed, không phải giá bắt buộc nếu bạn đã chỉnh món.

## Checklist thao tác thủ công

- [ ] Đăng nhập khách và quản trị bằng mật khẩu đã đặt trên MySQL.
- [ ] Thêm hai ly cùng món nhưng khác đường/topping; kiểm tra hai dòng riêng.
- [ ] Sửa món trong giỏ, kiểm tra báo giá cập nhật.
- [ ] Thử coupon sai, thiếu số điện thoại và địa chỉ quá ngắn.
- [ ] Đặt đơn hợp lệ, tải lại trang, đơn vẫn còn.
- [ ] Khách chỉ xem được đơn của mình; không vào được API quản trị.
- [ ] Hủy một đơn còn chờ xác nhận và ghi lý do.
- [ ] Hoàn thành một đơn khác, kiểm tra doanh thu/CSV khớp.
- [ ] Mở phiếu đơn và hộp thoại in; lưu PDF nếu cần cho báo cáo.
- [ ] Tắt món hoặc vùng giao, kiểm tra khách không đặt mới được lựa chọn đó.
- [ ] Kiểm tra ảnh tải lên trên điện thoại và nội dung nhận tại quầy.

Checklist này để bạn đánh dấu khi tự nghiệm thu trên bộ dữ liệu thực tế; không phải tuyên bố mọi mục đã chạy với tài khoản của bạn. Bộ test tự động và kiểm tra Chrome đã thực hiện được ghi riêng ở TEST-RESULTS.md.

## Nếu demo gặp lỗi

- Trình duyệt không kết nối: mở cửa sổ server và kiểm tra dòng địa chỉ.
- Cổng đang dùng: không mở thêm nhiều cửa sổ. Dùng website đang chạy hoặc dừng đúng cửa sổ cũ bằng Ctrl+C.
- MySQL không kết nối: chạy `npm.cmd run db:check`, kiểm tra dịch vụ và thông tin Workbench.
- Quên mật khẩu web: không nhầm với mật khẩu MySQL; seed không tự đặt lại mật khẩu tài khoản cũ.
- Mã giảm giá không áp dụng: kiểm tra số tiền tối thiểu, hạn và lượt; không sửa trực tiếp tổng tiền từ client.

## Chuyển sang máy khác

Mã nguồn ZIP không chứa `.env`, dữ liệu, ảnh tải lên hoặc thư viện. Máy mới cần Node.js 24+, MySQL nếu dùng dữ liệu thật, sau đó `npm ci`, cấu hình database, seed/migrate và build. Dữ liệu/cấu hình/ảnh được chuyển riêng nếu muốn giữ nội dung; không đưa chúng vào repository công khai.
