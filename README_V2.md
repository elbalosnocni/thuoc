# Quản lý kho thuốc V2

## 1. Kiến trúc không CORS
V2 chạy bằng **Google Apps Script HTML Service**. `index.html` được Apps Script phục vụ trực tiếp và gọi backend bằng `google.script.run`.

Vì vậy V2 **không dùng `fetch()` tới `script.google.com`, không JSONP và không có CORS giữa GitHub Pages ↔ Apps Script**. URL GitHub Pages cũ không dùng cho V2.

## 2. Phân quyền
- **ADMIN**: toàn quyền; quản lý người dùng; CRUD sản phẩm; nhập kho; cấp phát; báo cáo; audit.
- **KHO**: CRUD sản phẩm (không xóa), nhập kho, xem tồn, báo cáo, lịch sử.
- **CAP_PHAT**: cấp phát, xem tồn/dashboard, lịch sử, báo cáo. Nếu tài khoản có Bộ phận thì chỉ được cấp phát cho đúng bộ phận đó.

Quyền được kiểm tra ở **backend**, không chỉ ẩn menu.

## 3. Đăng nhập
Tài khoản khởi tạo:
- `admin` / `Admin@12345`
- `kho` / `Kho@12345`
- `capphat` / `CapPhat@12345`

Tất cả tài khoản yêu cầu đổi mật khẩu lần đầu. Mật khẩu lưu dưới dạng SHA-256(password + salt). Session token nằm trong Script Cache, TTL 6 giờ.

> Nên đăng nhập `admin` và đổi mật khẩu ngay sau lần triển khai đầu tiên.

## 4. Khóa phiếu sau cấp phát
Khi xác nhận cấp phát:
1. Script lock chống cấp phát đồng thời.
2. FEFO chọn lô HSD gần nhất, tự tách nhiều lô nếu cần.
3. Trừ tồn.
4. Tạo phiếu `PX-...`.
5. Ghi `Trạng thái = LOCKED`, `Khóa lúc`, `Người khóa`.
6. Ghi chi tiết cấp phát.
7. Ghi Audit Log.

V2 **không cung cấp API sửa/xóa phiếu cấp phát** sau khi tạo. Các phiếu cũ không có cột trạng thái được migrate thành `LOCKED`.

## 5. Triển khai
1. Mở Google Apps Script project có quyền truy cập Spreadsheet hiện tại.
2. Thay `Code.gs` và `index.html` bằng hai file trong ZIP.
3. Kiểm tra `SPREADSHEET_ID` trong `Code.gs`.
4. Chạy `setupV2()` một lần.
5. Deploy → New deployment → Web app.
6. **Execute as:** Me.
7. **Who has access:** chọn phạm vi người dùng phù hợp. Nếu cần đăng nhập riêng của ứng dụng, có thể dùng `Anyone`; quyền Spreadsheet vẫn thuộc tài khoản triển khai.
8. Mở **URL Web App của Apps Script**.

## 6. Dữ liệu cũ
V2 không reset/xóa dữ liệu. `setupV2()` tự tạo các sheet thiếu và thêm 3 cột khóa vào `Xuất kho`.

Không chạy hàm reset/clear trên Spreadsheet đang có dữ liệu.
