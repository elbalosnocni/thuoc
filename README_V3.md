# QUẢN LÝ KHO THUỐC V3

## V3 chọn V2 làm nền tảng chính
- Không dùng fetch/CORS/JSONP.
- `index.html` chạy trực tiếp bằng Google Apps Script HTML Service.
- Frontend gọi backend bằng `google.script.run`.
- Giữ dữ liệu cũ, không reset/xóa sheet khi setup.

## Những gì V3 cải thiện
1. Loading toàn hệ thống khi đang gọi Apps Script.
2. Tự xử lý phiên đăng nhập hết hạn và đưa về màn hình đăng nhập.
3. Không chạy setup/format toàn bộ sheet ở mọi lần đăng nhập nếu hệ thống đã sẵn sàng.
4. Kiểm tra đủ sheet + header trước khi tự setup.
5. Cấp phát FEFO có LockService và hoàn nguyên `Số lượng còn` nếu bước ghi phiếu/chi tiết bị lỗi.
6. Admin có Reset MK cho tài khoản khác; tài khoản được reset sẽ phải đổi mật khẩu khi đăng nhập lại.
7. Giảm dữ liệu trả về cho vai trò CAP_PHAT: không tải toàn bộ tab Nhập kho.
8. Giữ phân quyền backend: ADMIN / KHO / CAP_PHAT.
9. Giữ khóa phiếu sau cấp phát, Audit Log, báo cáo, CRUD sản phẩm, nhập kho.
10. Cập nhật phiên bản Config lên V3 mà không xóa dữ liệu.

## Tài khoản ban đầu
- admin / Admin@12345
- kho / Kho@12345
- capphat / CapPhat@12345

Tất cả tài khoản mặc định phải đổi mật khẩu lần đầu.

## Cài đặt
1. Mở project Google Apps Script đang có quyền truy cập Spreadsheet.
2. Thay `Code.gs` và `index.html` bằng hai file trong ZIP.
3. Kiểm tra `SPREADSHEET_ID` trong `Code.gs`.
4. Chạy hàm `setupV2()` một lần trong Apps Script và cấp quyền.
5. Deploy > New deployment > Web app.
6. Execute as: Me.
7. Who has access: chọn phạm vi người dùng phù hợp.
8. Mở URL Web App của Apps Script.

## Quan trọng
V3 KHÔNG chạy theo mô hình GitHub Pages + fetch API của V1. Đây là chủ ý để loại bỏ lỗi CORS / Failed to fetch.
Nếu triển khai V3, hãy sử dụng URL Web App của Google Apps Script.

## Dữ liệu cũ
- Không reset dữ liệu.
- Tự tạo các sheet còn thiếu.
- Tự bổ sung cột khóa cho `Xuất kho`.
- `Chi tiết cấp phát` có thêm `Đơn giá`.
- Các phiếu `Xuất kho` cũ không có trạng thái sẽ được xem là LOCKED khi migration.

## Phân quyền
- ADMIN: toàn quyền.
- KHO: sản phẩm, nhập kho, tồn, báo cáo, lịch sử.
- CAP_PHAT: dashboard, tồn, cấp phát, báo cáo, lịch sử; nếu có Bộ phận thì chỉ được cấp phát cho đúng bộ phận.

## Ghi chú bảo mật
Mật khẩu không lưu dạng rõ; hệ thống lưu SHA-256(password + salt). Session token dùng Script Cache TTL 6 giờ.
