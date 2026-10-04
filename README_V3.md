# QUẢN LÝ KHO THUỐC V3 – GITHUB PAGES + APPS SCRIPT API

## Kiến trúc

```text
GitHub Pages (index.html)
        │
        │ JSONP API
        ▼
Google Apps Script Web App (Code.gs)
        │
        ▼
Google Sheets
```

Frontend **không dùng `google.script.run`**. Vì vậy `index.html` có thể chạy trực tiếp trên GitHub Pages.

Frontend dùng JSONP để tránh lỗi CORS/`Failed to fetch` khi gọi Apps Script từ domain GitHub Pages.

## Cài đặt

1. Mở Google Apps Script của hệ thống.
2. Thay toàn bộ `Code.gs` bằng file `Code.gs` trong bộ này.
3. Trong Apps Script chạy `setupV2()` một lần và cấp quyền.
4. Vào **Deploy → Manage deployments**.
5. Tạo/cập nhật **Web app**:
   - Execute as: **Me**
   - Who has access: tài khoản/người dùng phù hợp với hệ thống.
6. Lấy URL `/exec` của Web app.
7. Mở `index.html`, tìm:

```javascript
const GAS_API_URL='.../exec';
```

và đặt đúng URL Web app của Apps Script.
8. Đưa `index.html` lên GitHub Pages.

> Nếu cập nhật `Code.gs` trong cùng deployment, nhớ tạo **New version** và cập nhật deployment.

## Tài khoản khởi tạo

- `admin` / `Admin@12345`
- `kho` / `Kho@12345`
- `capphat` / `CapPhat@12345`

Các tài khoản khởi tạo yêu cầu đổi mật khẩu lần đầu.

## Các điểm đã sửa trong V3 GitHub Pages

- Loại bỏ hoàn toàn `google.script.run`.
- API trung tâm `dispatchApi_()` kiểm soát toàn bộ action từ frontend.
- JSONP callback được kiểm tra tên hợp lệ trước khi trả JavaScript.
- Có timeout 30 giây ở frontend.
- Có loading toàn hệ thống.
- API lỗi/phiên hết hạn được đưa về màn hình đăng nhập.
- Giữ đăng nhập, đổi/reset mật khẩu, người dùng, sản phẩm, nhập kho, FEFO, cấp phát, báo cáo, lịch sử, audit.
- Cấp phát dùng `LockService` và hoàn nguyên tồn nếu ghi phiếu thất bại.

## Lưu ý bảo mật

JSONP được chọn vì yêu cầu chạy trực tiếp trên GitHub Pages và không phụ thuộc CORS. Token phiên là chuỗi ngẫu nhiên và có thời hạn 6 giờ. Không chia sẻ URL API kèm token cho người khác.
