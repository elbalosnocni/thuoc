// Thay ID file Sheets của bạn vào đây nếu chạy độc lập, hoặc dùng Script đính kèm trực tiếp const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const SPREADSHEET_ID = '1ZT7EeWVtJ8WkUWy7voM8FWxqBfMekvoeCo53Q3p9bJg';

// Cấu hình Header cho API bảo mật
function doGet(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  if (action === "getProducts") {
    const data = getSheetData(sheet, "Sản phẩm");
    return createJsonResponse(data);
  }
  
  if (action === "getDashboard") {
    // Mock dữ liệu Dashboard trả về giống như biểu đồ của bạn
    const dashboardData = {
      revenue: 455000, profit: 185000, orders: 6, stockValue: 3020000,
      recentActivities: [
        { type: "Nhập", content: "Nhập 2 Sản phẩm", date: "10/9/2025", val: "60.000đ" },
        { type: "Xuất", content: "Xuất 3 Sản phẩm", date: "10/9/2025", val: "117.000đ" }
      ]
    };
    return createJsonResponse(dashboardData);
  }
}

function doPost(e) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const payload = JSON.parse(e.postData.contents);
  const action = payload.action;
  
  // LOGIC XUẤT KHO THEO THUẬT TOÁN FIFO
  if (action === "exportFIFO") {
    const { code, quantity, receiver, department } = payload;
    let qtyToExport = parseInt(quantity);
    
    const importSheet = sheet.getSheetByName("Nhập kho");
    const importData = importSheet.getDataRange().getValues();
    
    // Tìm các lô hàng của sản phẩm này, lọc những lô còn hàng (Cột số lượng còn lại > 0)
    // Giả định: Cột 2 (index 2) là Mã SP, Cột 3 (index 3) là Số lượng nhập, Cột 4 (index 4) là Số lượng còn lại, Cột 5 (index 5) là Hạn sử dụng
    let batches = [];
    for (let i = 1; i < importData.length; i++) {
      if (importData[i][2] === code && importData[i][4] > 0) {
        batches.push({
          rowIndex: i + 1, // Dòng thực tế trong Google Sheet
          remQty: parseInt(importData[i][4]),
          expiryDate: new Date(importData[i][5])
        });
      }
    }
    
    // Sắp xếp các lô hàng theo thứ tự Hạn Sử Dụng tăng dần (FIFO)
    batches.sort((a, b) => a.expiryDate - b.expiryDate);
    
    // Kiểm tra tổng tồn kho hiện tại của mặt hàng xem có đủ xuất không
    let totalAvailable = batches.reduce((sum, b) => sum + b.remQty, 0);
    if (totalAvailable < qtyToExport) {
      return createJsonResponse({ status: "error", message: "Không đủ hàng trong kho!" });
    }
    
    // Bắt đầu tiến trình trừ kho theo thứ tự FIFO
    for (let batch of batches) {
      if (qtyToExport <= 0) break;
      
      if (batch.remQty >= qtyToExport) {
        // Lô hiện tại thừa hoặc vừa đủ cho đơn xuất
        let newRemaining = batch.remQty - qtyToExport;
        importSheet.getRange(batch.rowIndex, 5).setValue(newRemaining); // Cập nhật số lượng còn lại ở Cột 5
        qtyToExport = 0;
      } else {
        // Lô hiện tại ít hơn số lượng cần xuất -> Trừ hết lô này và chuyển sang lô tiếp theo
        qtyToExport -= batch.remQty;
        importSheet.getRange(batch.rowIndex, 5).setValue(0); // Lô này hết sạch hàng
      }
    }
    
    // Ghi nhận lịch sử vào tab Xuất kho
    const exportSheet = sheet.getSheetByName("Xuất kho");
    exportSheet.appendRow([
      "PX-" + Date.now(), new Date(), code, quantity, receiver, department
    ]);
    
    return createJsonResponse({ status: "success", message: "Xuất kho FIFO thành công!" });
  }
}

// Hàm bổ trợ đọc dữ liệu sheet thành JSON
function getSheetData(sheet, sheetName) {
  const table = sheet.getSheetByName(sheetName).getDataRange().getValues();
  const headers = table[0];
  return table.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}
