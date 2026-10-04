# Quản lý kho thuốc — V4.2 URL FIX

Bản V4.2 URL FIX lấy **V4.1 làm nền**, giữ kiến trúc GitHub Pages + Google Apps Script + Google Sheets, đồng thời siết lại các điểm nghiệp vụ và bảo mật.

## Kiến trúc

`GitHub Pages → JSONP → Google Apps Script Web App → Google Sheets`

## Cài backend

1. Mở Google Sheet dùng làm database.
2. Extensions → Apps Script.
3. Thay `Code.gs` bằng file `Code.gs` của V4.2 URL FIX.
4. Chạy `setupV2()` một lần để tạo/cập nhật các sheet.
5. Deploy → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Lấy URL `/exec`.
7. Trong GitHub Pages nhập URL tại ô **Kết nối Google Apps Script** và bấm **Kiểm tra API**.

> Không dùng URL `/dev`.

## Tài khoản khởi tạo

- `admin` / `Admin@12345`
- `kho` / `Kho@12345`
- `capphat` / `CapPhat@12345`

Tất cả tài khoản mẫu đều bắt buộc đổi mật khẩu lần đầu. Tài khoản `CAP_PHAT` phải được gán **Bộ phận**; tài khoản mẫu `capphat` cần ADMIN gán bộ phận trước khi sử dụng.

## Vai trò

- `ADMIN`: toàn quyền.
- `KHO`: sản phẩm + nhập kho.
- `CAP_PHAT`: cấp phát và xem dữ liệu cấp phát thuộc đúng bộ phận được gán.

## Các nâng cấp V4.2 URL FIX

### 1. Không còn hard-code deployment URL
Frontend không chứa URL Apps Script cố định. URL được lưu trong `localStorage` sau khi người dùng nhập và kiểm tra.

### 2. Khóa phạm vi CAP_PHAT
- CAP_PHAT bắt buộc có Bộ phận.
- Không thể cấp phát cho bộ phận khác.
- Không thể xem chi tiết phiếu của bộ phận khác.
- Báo cáo bị ép theo Bộ phận của tài khoản.
- Lịch sử cấp phát trên giao diện được lọc theo bộ phận.

### 3. Bảo toàn lịch sử Mã SP
Sau khi Mã SP đã phát sinh ở **Nhập kho / Xuất kho / Chi tiết cấp phát**, không được đổi Mã SP.

### 4. Không xóa sản phẩm đã có lịch sử
Sản phẩm đã từng phát sinh giao dịch không được xóa vật lý. Hãy chuyển `INACTIVE` để giữ lịch sử.

### 5. Rollback cấp phát đầy đủ
Khi cấp phát nhiều lô theo FEFO, nếu một bước sau thất bại, V4.2 URL FIX hoàn nguyên:
- Số lượng còn của các lô.
- Phiếu Xuất kho.
- Chi tiết cấp phát.

Toàn bộ giao dịch cấp phát vẫn nằm trong `ScriptLock` để tránh hai người đồng thời làm sai tồn kho.

### 6. FEFO
Thuốc còn hạn được sắp theo:
1. Hạn sử dụng gần nhất.
2. Nếu cùng HSD → ngày nhập trước.

Lô đã hết hạn hoặc không có HSD không được dùng cho cấp phát thuốc.

### 7. Audit
Các thao tác đăng nhập, đổi mật khẩu, user, sản phẩm, nhập kho và cấp phát tiếp tục được ghi vào `AuditLog`.

## Lưu ý triển khai

Sau khi thay `Code.gs`, hãy **Deploy → Manage deployments → Edit → chọn New version → Deploy**. Không tạo URL mới nếu không cần; nếu URL thay đổi thì nhập URL mới ở GitHub Pages.

Nếu nâng từ V4.1, dữ liệu các sheet hiện có được giữ lại. `setupV2()` chỉ bổ sung/cập nhật cấu trúc cần thiết.


## URL API
Frontend không chứa deployment URL cụ thể. Nhập URL Web App `/exec` tại màn hình đăng nhập và bấm **Lưu & kiểm tra API**. URL được lưu bằng localStorage trên thiết bị. Không dùng `/dev`.
