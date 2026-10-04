# Quản lý kho thuốc — GitHub Web App V4.1

Bộ này là bản hợp nhất từ 2 bộ code đã kiểm tra:

- **Frontend:** GitHub Pages → `index.html`
- **Backend:** Google Apps Script Web App → `Code.gs`
- **Database:** Google Sheets
- **Giao tiếp:** JSONP qua `doGet`, nên frontend GitHub Pages không phụ thuộc `google.script.run` và không cần CORS proxy.
- **Nghiệp vụ giữ lại từ bộ V4.1:** đăng nhập, phân quyền, quản lý user, sản phẩm, nhập kho theo lô, FEFO, khóa phiếu cấp phát, hoàn nguyên tồn khi lỗi, báo cáo, audit log.

## 1. Cài backend

1. Mở Google Sheet dùng làm database.
2. Extensions → Apps Script.
3. Thay `Code.gs` bằng file `Code.gs` trong thư mục này.
4. Trong Apps Script chạy hàm `setupV2()` một lần.
5. Kiểm tra các tab được tạo:
   - Sản phẩm
   - Nhập kho
   - Xuất kho
   - Chi tiết cấp phát
   - Danh mục
   - AuditLog
   - Config
   - Users
6. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Lấy URL dạng `https://script.google.com/macros/s/.../exec`.

> Không dùng URL `/dev`.

## 2. Kiểm tra backend

Mở URL Web App thêm `?action=ping`.

Kết quả cần có `status: "success"` và `ok: true`.

## 3. Deploy GitHub Pages

Upload `index.html` lên repository GitHub Pages.

Mở website → nhập URL Web App → **Kiểm tra API** → sau đó đăng nhập.

Frontend không còn hard-code URL deployment cũ. URL được lưu trong trình duyệt sau khi kiểm tra thành công.

## 4. Tài khoản khởi tạo

- `admin` / `Admin@12345`

Hệ thống yêu cầu đổi mật khẩu lần đầu.

## 5. Vai trò

- `ADMIN`: toàn quyền.
- `KHO`: sản phẩm + nhập kho.
- `CAP_PHAT`: cấp phát theo bộ phận được gán.

## 6. Luồng dữ liệu

`GitHub Pages → JSONP → Apps Script → Google Sheets`

Khi cấp phát:

`Xuất kho → FEFO theo hạn dùng → trừ tồn từng lô → Chi tiết cấp phát → AuditLog`

Nếu giao dịch lỗi sau khi đã trừ tồn, hệ thống cố gắng hoàn nguyên số lượng đã thay đổi.

## 7. Các điểm đã tối ưu khi hợp nhất

- Loại bỏ bộ API đơn giản bị giới hạn của bản cũ.
- Giữ lõi nghiệp vụ đầy đủ của V4.1.
- Loại bỏ **2 cụm input URL API trùng ID** trên màn hình đăng nhập.
- Loại bỏ URL Apps Script deployment cũ bị hard-code trong frontend.
- Chuẩn hóa tên phiên bản thành V4.1.
- Giữ JSONP để GitHub Pages gọi Apps Script mà không cần `google.script.run`.
- Thêm `appsscript.json` để backend có cấu hình runtime/timezone rõ ràng.
- Kiểm tra syntax JavaScript trước khi đóng gói.

## 8. Đã sửa lỗi web không chạy

Bản V4.1 sửa lỗi bootstrap frontend khiến JavaScript dừng ngay khi mở GitHub Pages:

- Bổ sung đúng `<form id="login-form">` cho màn hình đăng nhập.
- Không còn tham chiếu phần tử HTML không tồn tại.
- Nút đăng nhập có trạng thái đang xử lý để tránh bấm nhiều lần.
- Backend nâng phiên bản lên V4.1.0; nghiệp vụ FEFO/LOCKED không thay đổi.

## 9. Cảnh báo

Đây là hệ thống nội bộ dùng Google Sheets làm database. Không nên xem đây là hệ thống ERP/y tế có yêu cầu bảo mật cấp doanh nghiệp.

Đặc biệt:
- Không chia sẻ tài khoản Apps Script/Google Sheet.
- Sau khi đăng nhập lần đầu phải đổi mật khẩu.
- Chỉ cấp quyền Google Sheet cho người cần quản trị.
- Nếu deployment Apps Script được đổi version, cần cập nhật deployment hiện tại hoặc tạo deployment mới rồi thay URL trong GitHub Pages.
