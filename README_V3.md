# QUAN LY KHO THUOC V3 - GITHUB PAGES + GAS API

## 1. Kien truc
GitHub Pages -> JSONP -> Google Apps Script Web App -> Google Sheets

Frontend KHONG dung `google.script.run`.

## 2. Cai Code.gs
Mo Google Apps Script gan voi Google Sheet, thay toan bo Code.gs bang file `Code.gs` trong bo nay.

Chay `setupV2()` mot lan trong Apps Script de tao/cap nhat cac sheet va tai khoan mac dinh.

## 3. Deploy Web App - BAT BUOC
Trong Apps Script:
- Deploy -> New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone
- Deploy
- Copy URL co dang: https://script.google.com/macros/s/....../exec

Neu sua Code.gs sau nay: Deploy -> Manage deployments -> Edit -> New version -> Deploy.

KHONG dung URL /dev.

## 4. GitHub Pages
Upload `index.html` len GitHub Pages.

Tai man hinh dang nhap:
1. Dan URL Web App vao o `URL Google Apps Script Web App`.
2. Bam `Kiem tra API`.
3. Neu hien `API dang hoat dong` thi moi dang nhap.

URL duoc luu trong localStorage cua trinh duyet, lan sau khong can nhap lai.

## 5. Kiem tra API truc tiep
Mo URL Web App tren trinh duyet voi:
`?action=ping`

Ket qua dung phai la JSON gan nhu:
`{"status":"success","ok":true,...}`

Neu trinh duyet hien trang yeu cau dang nhap Google, HTML loi, hoac khong truy cap duoc thi deployment/quyen Web App dang sai.

## 6. Tai khoan mac dinh
- admin / Admin@12345
- kho / Kho@12345
- capphat / CapPhat@12345

Cac tai khoan phai doi mat khau o lan dang nhap dau tien.
