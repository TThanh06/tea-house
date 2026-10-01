# API Tea House

Tiền dùng số nguyên VNĐ. Request/response là JSON. Lỗi trả `{ "error": "Thông báo" }`; 400 dữ liệu sai, 401 chưa đăng nhập, 403 thiếu quyền, 404 không tìm thấy, 409 xung đột, 429 quá nhiều lần đăng nhập. Cookie `tea_session` HttpOnly, SameSite=Lax, thời hạn 7 ngày. Mật khẩu băm bcrypt; token ngẫu nhiên 256 bit, chỉ lưu hash trong DB.

| Method | Endpoint | Quyền / công dụng |
|---|---|---|
| GET | /api/health | Tình trạng database và mode |
| GET | /api/catalog | Món đang kinh doanh, danh mục, topping và vùng giao |
| GET | /api/media/:filename | Ảnh JPEG đã tải của sản phẩm |
| GET | /api/auth/me | Người dùng hiện tại hoặc null |
| POST | /api/auth/register | Đăng ký: name, email, password (ít nhất 10 ký tự) |
| POST | /api/auth/login | email, password |
| POST | /api/auth/logout | Xóa session hiện tại |
| POST | /api/checkout/quote | Báo giá; không bắt buộc đăng nhập |
| POST | /api/orders | Đăng nhập; tạo đơn trong transaction |
| GET | /api/orders | Đơn của chính tài khoản, có items và history |
| GET | /api/orders/:id/receipt | Chủ đơn hoặc admin; trả HTML để in, có kiểm tra quyền, không cache |
| POST | /api/orders/:id/cancel | Chủ đơn, chỉ pending; body note |
| GET | /api/admin/orders | Admin; 100 đơn gần nhất |
| PATCH | /api/admin/orders/:id/status | Admin; status, note |
| GET | /api/admin/catalog | Admin; toàn bộ sản phẩm/danh mục/topping/mã |
| POST | /api/admin/products | Admin; thêm món |
| PUT | /api/admin/products/:id | Admin; sửa đầy đủ món |
| PUT | /api/admin/products/:id/image | Admin; body JPEG nhị phân, Content-Type image/jpeg, tối đa 2 MB |
| DELETE | /api/admin/products/:id/image | Admin; bỏ ảnh sản phẩm, dùng lại hình minh họa |
| GET / PUT | /api/admin/store | Admin; name, address, phone, hours, announcement |
| POST / PUT | /api/admin/zones[/:id] | Admin; name, fee (VNĐ), active (0/1) |
| POST / PUT | /api/admin/categories[/:id] | Admin; thêm/sửa name |
| POST / PUT | /api/admin/toppings[/:id] | Admin; name, price, available |
| POST / PUT | /api/admin/coupons[/:id] | Admin; code, discount, min_total, max_uses, expires_at, active |
| GET | /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD | Admin; revenue, completed, created, best, daily |
| GET | /api/admin/reports/export.csv?from=YYYY-MM-DD&to=YYYY-MM-DD | Admin; tải CSV UTF-8 BOM, đơn hoàn thành đã thu tiền, cùng quy tắc ngày với báo cáo |

Payload báo giá:

```json
{
  "items": [{"productId":1,"size":"L","sugar":50,"ice":"less","toppingIds":[1],"quantity":2,"note":"Để topping riêng"}],
  "deliveryType":"pickup",
  "zoneId":1,
  "couponCode":"CHAO10"
}
```

Tạo đơn dùng payload trên và thêm:

```json
{
  "requestKey":"uuid-duy-nhat-cho-mot-yeu-cau",
  "recipient":"Nguyễn An",
  "phone":"0901234567",
  "address":"123 đường Mẫu, phường Mẫu",
  "note":"Gọi khi đến nơi",
  "expectedTotal":88000
}
```

`requestKey` được client tạo bằng `crypto.randomUUID()`. Server trả `{id, reused}`; 201 đơn mới, 200 gửi lại cùng yêu cầu. `expectedTotal` phát hiện giá thay đổi so với báo giá; server luôn tự tính lại. `zoneId` chỉ có hiệu lực khi deliveryType=delivery. Điện thoại chấp nhận 0 + 9 số hoặc +84 + 9 số.

Payload sản phẩm: `name`, `description`, `category_id`, `price_m`, `price_l`, `color` (#rrggbb), `active`, `available`, `featured`. Ngừng bán bằng active=0, không xóa lịch sử. Topping áp dụng chung cho các món trong bản này.

`/api/catalog` còn trả `store` và `products[].image_path`; danh sách `zones` chỉ gồm khu vực đang hoạt động. Máy chủ tự sinh tên ảnh, kiểm tra JPEG/kích thước và lưu trong data/uploads. Không nhận URL ảnh bên ngoài hoặc đường dẫn file từ người dùng. Cập nhật món thông thường không thay đổi ảnh; sử dụng endpoint ảnh riêng.

Trạng thái: pending → confirmed → preparing → delivering/ready → completed. pending → cancelled; delivering → failed; ready → uncollected. Trạng thái cuối không được đổi tiếp. cancelled/failed/uncollected cần lý do. completed đồng thời ghi paid=1 và completed_at.

Lượt dùng coupon không được hoàn lại sau khi hủy. Báo cáo sử dụng ngày ở UTC+7; dữ liệu timestamp được lưu ISO UTC.
