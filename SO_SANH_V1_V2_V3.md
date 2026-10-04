# SO SANH VA CHOT V3

| Hạng mục | V1 | V2 | V3 GitHub Pages |
|---|---|---|---|
| Frontend | GitHub Pages | Apps Script HTML Service | **GitHub Pages** |
| Giao tiếp | fetch/CORS | google.script.run | **JSONP API** |
| Đăng nhập | hạn chế | Có | **Có** |
| Phân quyền | hạn chế | Có | **Có** |
| Quản lý user | hạn chế | Có | **Có** |
| Nhập kho | Có | Có | **Có** |
| FEFO | Có | Có | **Có + LockService** |
| Hoàn nguyên tồn khi lỗi | chưa đầy đủ | Có | **Có** |
| Audit Log | Có | Có | **Có** |
| Báo cáo | Có | Có | **Có** |
| Chạy trực tiếp trên GitHub Pages | Có | **Không** | **Có** |
| Phụ thuộc `google.script.run` | Không | Có | **Không** |
| Tránh lỗi CORS | Chưa chắc | Có do cùng origin | **Có bằng JSONP** |

## Kết luận

V3 GitHub Pages lấy lõi nghiệp vụ của V2 nhưng trả frontend về đúng kiến trúc ban đầu: GitHub Pages gọi Apps Script Web API.

Điểm quan trọng nhất: **không còn `google is not defined`** vì frontend không sử dụng `google.script.run`.
