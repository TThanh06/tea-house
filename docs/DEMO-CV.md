# Nội dung CV và chuẩn bị phỏng vấn

Chỉ ghi những phần bạn đã trực tiếp chạy, hiểu và có thể giải thích. Điều chỉnh vai trò/mức đóng góp cho đúng thực tế của bạn.

## Mẫu mô tả dự án

**Tea House — Website đặt trà sữa và quản lý cửa hàng**  
**Công nghệ:** React.js, Node.js, Express.js, MySQL, REST API, CSS responsive.

- Xây dựng luồng tùy chỉnh đồ uống, giỏ hàng, đặt hàng, coupon và quản lý trạng thái đơn.
- Thiết kế API xác thực bằng session, phân quyền và tính giá tại máy chủ; sử dụng transaction để lưu đơn và lượt coupon nhất quán.
- Phát triển quản trị thực đơn/ảnh/khu vực giao hàng, báo cáo doanh thu, xuất CSV và phiếu thanh toán.
- Viết kiểm thử nghiệp vụ/API và migration giữ dữ liệu lịch sử khi nâng cấp schema.

Chưa có URL công khai thì không ghi “đã triển khai online”. Có thể ghi “demo local” và đính kèm video khi đã quay. Không ghi Tailwind, WebSocket, thanh toán online hoặc quản lý kho nếu chưa triển khai thêm.

## Các câu hỏi nên chuẩn bị

1. **Vì sao không dùng giá gửi từ frontend?** Trình duyệt có thể bị sửa request. Backend đọc dữ liệu hiện tại, xác minh tùy chọn và tính lại tổng.
2. **Bấm đặt hàng hai lần xử lý thế nào?** Request key duy nhất theo khách, nội dung có hash; cùng yêu cầu được trả lại đơn cũ, nội dung khác báo xung đột.
3. **Vì sao cần transaction?** Đơn, chi tiết, lịch sử và lượt coupon phải cùng thành công; lỗi giữa chừng rollback.
4. **Hai khách dùng lượt coupon cuối thì sao?** MySQL khóa bản ghi coupon khi kiểm tra/cập nhật trong transaction. SQLite demo tuần tự hóa transaction ghi.
5. **Thay giá món có sửa đơn cũ không?** Không, chi tiết đơn lưu snapshot tên, giá và topping lúc mua.
6. **Khách có thể gọi API quản trị trực tiếp không?** Request vẫn bị middleware kiểm tra session và role, không chỉ ẩn nút trên giao diện.
7. **Doanh thu tính theo ngày nào?** Theo completed_at ở UTC+7, chỉ đơn hoàn thành và đã thu tiền; tổng gồm phí giao, chưa trừ giá vốn.
8. **Vì sao cần hai database mode?** MySQL là mode sử dụng chính; SQLite giúp demo và kiểm thử độc lập, không đụng dữ liệu thật.
9. **Ảnh nằm ở đâu?** File JPEG trong data/uploads; database lưu đường dẫn. Khi chuyển máy/hosting phải giữ cả ảnh và database.
10. **Hạn chế hiện tại?** Một cửa hàng, tiền mặt, tối đa 100 đơn hiển thị ở danh sách, chưa có real-time, khôi phục mật khẩu và đo tải lớn.

## Khung thuyết trình 8 trang

1. Bài toán và mục tiêu.
2. Vai trò và phạm vi chức năng.
3. Kiến trúc React–Express–MySQL.
4. ERD và snapshot đơn hàng.
5. Luồng đặt hàng, transaction và chống trùng.
6. Giao diện khách và quản trị (ảnh chụp thực tế).
7. Kiểm thử và kết quả; nêu rõ phạm vi xác minh.
8. Hạn chế, hướng phát triển và demo.

Đây là khung nội dung, chưa phải file PowerPoint hoàn chỉnh.
