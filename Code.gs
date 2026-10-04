/*******************************************************
 * HỆ THỐNG QUẢN LÝ CẤP PHÁT THUỐC
 * Google Apps Script - Code.gs
 *
 * Mục đích:
 * 1. Tự tạo/chuẩn hóa các tab Google Sheets.
 * 2. Quản lý danh mục thuốc.
 * 3. Quản lý nhập kho theo từng lô.
 * 4. Cấp phát theo FEFO (hạn dùng gần nhất trước).
 * 5. Ghi lịch sử cấp phát + chi tiết từng lô.
 * 6. Dashboard lấy dữ liệu thật từ Google Sheets.
 *
 * LƯU Ý:
 * - Hàm setupThuocSheets() KHÔNG xóa dữ liệu cũ.
 * - Hàm resetThuocSheets() XÓA DỮ LIỆU của các tab hệ thống.
 *   Chỉ dùng khi muốn làm lại từ đầu.
 *******************************************************/

const SPREADSHEET_ID = '1ZT7EeWVtJ8WkUWy7voM8FWxqBfMekvoeCo53Q3p9bJg';

const SHEET_CONFIG = {
  'Sản phẩm': [
    'Mã SP',
    'Tên sản phẩm',
    'Hoạt chất',
    'Đơn vị',
    'Nhóm thuốc',
    'Giá nhập',
    'Giá xuất',
    'Tồn tối thiểu',
    'Trạng thái',
    'Ghi chú'
  ],

  'Nhập kho': [
    'Mã phiếu nhập',
    'Ngày nhập',
    'Mã SP',
    'Tên sản phẩm',
    'Số lô',
    'Số lượng nhập',
    'Số lượng còn',
    'Hạn sử dụng',
    'Đơn giá',
    'Nhà cung cấp',
    'Người nhập',
    'Ghi chú'
  ],

  'Xuất kho': [
    'Mã phiếu cấp phát',
    'Thời gian',
    'Mã SP',
    'Tên sản phẩm',
    'Tổng số lượng',
    'Người nhận',
    'Bộ phận',
    'Người thực hiện',
    'Ghi chú'
  ],

  'Chi tiết cấp phát': [
    'Mã phiếu cấp phát',
    'Mã SP',
    'Tên sản phẩm',
    'Số lô',
    'Hạn sử dụng',
    'Số lượng xuất'
  ],

  'Danh mục': [
    'Loại',
    'Mã',
    'Tên',
    'Trạng thái',
    'Ghi chú'
  ],

  'AuditLog': [
    'Thời gian',
    'Hành động',
    'Mã phiếu',
    'Mã SP',
    'Số lượng',
    'Người thực hiện',
    'Nội dung',
    'IP/UserAgent'
  ],

  'Config': [
    'Key',
    'Value',
    'Mô tả'
  ]
};

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Chạy hàm này 1 lần đầu tiên.
 * Không xóa dữ liệu hiện có.
 */
function setupThuocSheets() {
  const ss = getSpreadsheet_();
  const result = [];

  Object.keys(SHEET_CONFIG).forEach(name => {
    const headers = SHEET_CONFIG[name];
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
      result.push('Tạo tab: ' + name);
    } else {
      result.push('Đã có tab: ' + name);
    }

    ensureHeaders_(sh, headers);
    formatSheet_(sh, headers);
  });

  seedDanhMuc_(ss);
  seedConfig_(ss);

  SpreadsheetApp.flush();

  Logger.log(result.join('\n'));
  return result;
}

/**
 * XÓA DỮ LIỆU và tạo lại cấu trúc các tab hệ thống.
 * KHÔNG chạy hàm này nếu còn dữ liệu cần giữ.
 */
function resetThuocSheets() {
  const ss = getSpreadsheet_();

  Object.keys(SHEET_CONFIG).forEach(name => {
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
    }

    sh.clear();
    sh.clearFormats();
    ensureHeaders_(sh, SHEET_CONFIG[name]);
    formatSheet_(sh, SHEET_CONFIG[name]);
  });

  seedDanhMuc_(ss);
  seedConfig_(ss);

  SpreadsheetApp.flush();
  Logger.log('Đã reset và setup lại toàn bộ tab quản lý thuốc.');
}

/**
 * Tạo header nếu tab chưa có.
 * Nếu tab đang có dữ liệu, không tự xóa dữ liệu.
 */
function ensureHeaders_(sh, headers) {
  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length - sh.getMaxColumns()
    );
  }

  const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  const isEmpty = firstRow.every(v => String(v).trim() === '');

  if (isEmpty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

/**
 * Định dạng chung.
 */
function formatSheet_(sh, headers) {
  const lastCol = headers.length;

  sh.setFrozenRows(1);

  const header = sh.getRange(1, 1, 1, lastCol);
  header
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  header.setWrap(true);

  if (sh.getMaxRows() > 1) {
    sh.getRange(2, 1, sh.getMaxRows() - 1, lastCol)
      .setVerticalAlignment('middle');
  }

  // Tự điều chỉnh độ rộng nhưng giới hạn để sheet không quá rộng.
  for (let c = 1; c <= lastCol; c++) {
    sh.autoResizeColumn(c);
    const width = sh.getColumnWidth(c);
    if (width < 90) sh.setColumnWidth(c, 90);
    if (width > 260) sh.setColumnWidth(c, 260);
  }

  // Định dạng ngày.
  const dateHeaders = [
    'Ngày nhập',
    'Hạn sử dụng',
    'Thời gian'
  ];

  headers.forEach((h, i) => {
    if (dateHeaders.indexOf(h) >= 0 && sh.getMaxRows() > 1) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setNumberFormat('dd/MM/yyyy HH:mm');
    }
  });

  // Định dạng số.
  const numberHeaders = [
    'Số lượng nhập',
    'Số lượng còn',
    'Số lượng xuất',
    'Tổng số lượng',
    'Giá nhập',
    'Giá xuất',
    'Đơn giá',
    'Tồn tối thiểu'
  ];

  headers.forEach((h, i) => {
    if (numberHeaders.indexOf(h) >= 0 && sh.getMaxRows() > 1) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1)
        .setNumberFormat('#,##0.##');
    }
  });
}

/**
 * Dữ liệu danh mục mặc định.
 */
function seedDanhMuc_(ss) {
  const sh = ss.getSheetByName('Danh mục');
  if (!sh) return;

  if (sh.getLastRow() > 1) return;

  const rows = [
    ['Trạng thái thuốc', 'ACTIVE', 'Đang sử dụng', 'ACTIVE', ''],
    ['Trạng thái thuốc', 'INACTIVE', 'Ngừng sử dụng', 'ACTIVE', ''],
    ['Nhóm thuốc', 'THUOC', 'Thuốc', 'ACTIVE', ''],
    ['Nhóm thuốc', 'VTYT', 'Vật tư y tế', 'ACTIVE', ''],
    ['Đơn vị', 'VIEN', 'Viên', 'ACTIVE', ''],
    ['Đơn vị', 'GOI', 'Gói', 'ACTIVE', ''],
    ['Đơn vị', 'CHAI', 'Chai', 'ACTIVE', ''],
    ['Đơn vị', 'ONG', 'Ống', 'ACTIVE', ''],
    ['Đơn vị', 'HOP', 'Hộp', 'ACTIVE', '']
  ];

  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Cấu hình mặc định.
 */
function seedConfig_(ss) {
  const sh = ss.getSheetByName('Config');
  if (!sh) return;

  if (sh.getLastRow() > 1) return;

  const rows = [
    ['APP_NAME', 'Quản lý cấp phát thuốc', 'Tên hệ thống'],
    ['STOCK_METHOD', 'FEFO', 'Xuất lô có hạn sử dụng gần nhất trước'],
    ['LOW_STOCK_DEFAULT', '10', 'Ngưỡng tồn tối thiểu mặc định'],
    ['TIMEZONE', Session.getScriptTimeZone(), 'Múi giờ Apps Script']
  ];

  sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

/**
 * Endpoint GET.
 */
function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : '';
    const ss = getSpreadsheet_();

    // Tự đảm bảo các tab tồn tại.
    ensureSystemSheets_(ss);

    if (action === 'setup') {
      return createJsonResponse({
        status: 'success',
        message: 'Các tab Google Sheets đã được setup.',
        sheets: Object.keys(SHEET_CONFIG)
      });
    }

    if (action === 'getProducts') {
      return createJsonResponse(getSheetData_(ss, 'Sản phẩm'));
    }

    if (action === 'getDashboard') {
      return createJsonResponse(getDashboard_(ss));
    }

    if (action === 'getStock') {
      return createJsonResponse(getStock_(ss));
    }

    if (action === 'getExportHistory') {
      return createJsonResponse(getSheetData_(ss, 'Xuất kho'));
    }

    return createJsonResponse({
      status: 'success',
      message: 'API quản lý cấp phát thuốc đang hoạt động.',
      actions: [
        'getProducts',
        'getDashboard',
        'getStock',
        'getExportHistory'
      ]
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.message
    });
  }
}

/**
 * Endpoint POST.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const action = payload.action;
    const ss = getSpreadsheet_();

    ensureSystemSheets_(ss);

    if (action === 'setupSheets') {
      setupThuocSheets();
      return createJsonResponse({
        status: 'success',
        message: 'Đã setup các tab Google Sheets.'
      });
    }

    if (action === 'exportFIFO' || action === 'exportFEFO') {
      return createJsonResponse(exportMedicine_(ss, payload));
    }

    return createJsonResponse({
      status: 'error',
      message: 'Action không được hỗ trợ.'
    });

  } catch (err) {
    return createJsonResponse({
      status: 'error',
      message: err.message
    });
  }
}

/**
 * Cấp phát thuốc theo FEFO.
 *
 * LockService giúp tránh 2 người cùng cấp phát
 * làm sai tồn kho khi thao tác đồng thời.
 */
function exportMedicine_(ss, payload) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const code = String(payload.code || '').trim();
    const quantity = Number(payload.quantity);
    const receiver = String(payload.receiver || '').trim();
    const department = String(payload.department || '').trim();
    const performer = String(payload.performer || 'Admin').trim();
    const note = String(payload.note || '').trim();

    if (!code) {
      return {
        status: 'error',
        message: 'Chưa nhập mã thuốc.'
      };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        status: 'error',
        message: 'Số lượng cấp phát phải lớn hơn 0.'
      };
    }

    if (!receiver) {
      return {
        status: 'error',
        message: 'Chưa nhập người nhận.'
      };
    }

    if (!department) {
      return {
        status: 'error',
        message: 'Chưa nhập bộ phận.'
      };
    }

    const productSheet = ss.getSheetByName('Sản phẩm');
    const importSheet = ss.getSheetByName('Nhập kho');
    const exportSheet = ss.getSheetByName('Xuất kho');
    const detailSheet = ss.getSheetByName('Chi tiết cấp phát');
    const auditSheet = ss.getSheetByName('AuditLog');

    const products = getSheetData_(ss, 'Sản phẩm');
    const product = products.find(p =>
      String(p['Mã SP']).trim() === code
    );

    if (!product) {
      return {
        status: 'error',
        message: 'Không tìm thấy mã thuốc: ' + code
      };
    }

    if (String(product['Trạng thái'] || 'ACTIVE').toUpperCase() === 'INACTIVE') {
      return {
        status: 'error',
        message: 'Thuốc đang ở trạng thái ngừng sử dụng.'
      };
    }

    const values = importSheet.getDataRange().getValues();
    const batches = [];

    // Cấu trúc Nhập kho:
    // A Mã phiếu
    // B Ngày nhập
    // C Mã SP
    // D Tên SP
    // E Số lô
    // F SL nhập
    // G SL còn
    // H HSD
    // I Đơn giá
    // J NCC
    // K Người nhập
    // L Ghi chú

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowCode = String(row[2] || '').trim();
      const remaining = Number(row[6]) || 0;

      if (rowCode !== code || remaining <= 0) continue;

      const expiry = row[7] instanceof Date
        ? row[7]
        : new Date(row[7]);

      // Không cấp phát lô đã hết hạn.
      if (isValidDate_(expiry) && expiry.getTime() < Date.now()) {
        continue;
      }

      batches.push({
        rowIndex: i + 1,
        importDate: row[1] instanceof Date ? row[1] : new Date(row[1]),
        lot: String(row[4] || ''),
        remaining: remaining,
        expiry: expiry,
        unitPrice: Number(row[8]) || 0
      });
    }

    if (!batches.length) {
      return {
        status: 'error',
        message: 'Không còn lô thuốc hợp lệ để cấp phát.'
      };
    }

    // FEFO: HSD gần nhất trước.
    // Nếu cùng HSD thì ngày nhập cũ hơn trước.
    batches.sort((a, b) => {
      const aExpiry = isValidDate_(a.expiry)
        ? a.expiry.getTime()
        : Number.MAX_SAFE_INTEGER;

      const bExpiry = isValidDate_(b.expiry)
        ? b.expiry.getTime()
        : Number.MAX_SAFE_INTEGER;

      if (aExpiry !== bExpiry) return aExpiry - bExpiry;

      const aImport = isValidDate_(a.importDate)
        ? a.importDate.getTime()
        : Number.MAX_SAFE_INTEGER;

      const bImport = isValidDate_(b.importDate)
        ? b.importDate.getTime()
        : Number.MAX_SAFE_INTEGER;

      return aImport - bImport;
    });

    const totalAvailable = batches.reduce(
      (sum, b) => sum + b.remaining,
      0
    );

    if (totalAvailable < quantity) {
      return {
        status: 'error',
        message:
          'Không đủ tồn kho. Tồn khả dụng: ' +
          totalAvailable +
          ', yêu cầu: ' +
          quantity
      };
    }

    let remainingToExport = quantity;
    const allocations = [];

    for (const batch of batches) {
      if (remainingToExport <= 0) break;

      const exportQty = Math.min(
        remainingToExport,
        batch.remaining
      );

      const newRemaining = batch.remaining - exportQty;

      // Cập nhật cột G - Số lượng còn.
      importSheet
        .getRange(batch.rowIndex, 7)
        .setValue(newRemaining);

      allocations.push({
        rowIndex: batch.rowIndex,
        lot: batch.lot,
        expiry: batch.expiry,
        quantity: exportQty,
        unitPrice: batch.unitPrice
      });

      remainingToExport -= exportQty;
    }

    if (remainingToExport > 0) {
      throw new Error('Không thể hoàn tất cấp phát do sai lệch tồn kho.');
    }

    const now = new Date();
    const exportId =
      'PX-' +
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'yyyyMMdd-HHmmss'
      ) +
      '-' +
      Math.floor(Math.random() * 1000);

    exportSheet.appendRow([
      exportId,
      now,
      code,
      product['Tên sản phẩm'] || '',
      quantity,
      receiver,
      department,
      performer,
      note
    ]);

    const detailRows = allocations.map(a => [
      exportId,
      code,
      product['Tên sản phẩm'] || '',
      a.lot,
      a.expiry,
      a.quantity
    ]);

    if (detailRows.length) {
      detailSheet
        .getRange(
          detailSheet.getLastRow() + 1,
          1,
          detailRows.length,
          detailRows[0].length
        )
        .setValues(detailRows);
    }

    auditSheet.appendRow([
      now,
      'CẤP PHÁT',
      exportId,
      code,
      quantity,
      performer,
      'Cấp phát thuốc cho ' + receiver + ' - ' + department,
      ''
    ]);

    SpreadsheetApp.flush();

    return {
      status: 'success',
      message: 'Cấp phát thuốc thành công.',
      exportId: exportId,
      code: code,
      quantity: quantity,
      allocations: allocations.map(a => ({
        lot: a.lot,
        expiry: formatDate_(a.expiry),
        quantity: a.quantity
      }))
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * Dashboard thực tế.
 */
function getDashboard_(ss) {
  const productRows = getSheetData_(ss, 'Sản phẩm');
  const importRows = getSheetData_(ss, 'Nhập kho');
  const exportRows = getSheetData_(ss, 'Xuất kho');

  let totalStock = 0;
  let stockValue = 0;
  let lowStock = 0;
  let expired = 0;
  let expiringSoon = 0;

  const stockByCode = {};

  importRows.forEach(r => {
    const code = String(r['Mã SP'] || '').trim();
    const remaining = Number(r['Số lượng còn']) || 0;
    const unitPrice = Number(r['Đơn giá']) || 0;

    if (!code) return;

    stockByCode[code] = (stockByCode[code] || 0) + remaining;
    totalStock += remaining;
    stockValue += remaining * unitPrice;

    const expiry = r['Hạn sử dụng'] instanceof Date
      ? r['Hạn sử dụng']
      : new Date(r['Hạn sử dụng']);

    if (remaining > 0 && isValidDate_(expiry)) {
      const diffDays =
        (expiry.getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);

      if (diffDays < 0) expired++;
      else if (diffDays <= 30) expiringSoon++;
    }
  });

  productRows.forEach(p => {
    const code = String(p['Mã SP'] || '').trim();
    const minimum = Number(p['Tồn tối thiểu']) || 0;
    const stock = stockByCode[code] || 0;

    if (minimum > 0 && stock <= minimum) {
      lowStock++;
    }
  });

  const today = new Date();
  const todayKey = Utilities.formatDate(
    today,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  let todayExportQty = 0;

  exportRows.forEach(r => {
    const d = r['Thời gian'] instanceof Date
      ? r['Thời gian']
      : new Date(r['Thời gian']);

    if (!isValidDate_(d)) return;

    const key = Utilities.formatDate(
      d,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    if (key === todayKey) {
      todayExportQty += Number(r['Tổng số lượng']) || 0;
    }
  });

  return {
    status: 'success',
    products: productRows.length,
    totalStock: totalStock,
    stockValue: stockValue,
    todayOrders: exportRows.filter(r => {
      const d = r['Thời gian'] instanceof Date
        ? r['Thời gian']
        : new Date(r['Thời gian']);

      if (!isValidDate_(d)) return false;

      return Utilities.formatDate(
        d,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ) === todayKey;
    }).length,
    todayExportQty: todayExportQty,
    lowStock: lowStock,
    expired: expired,
    expiringSoon: expiringSoon,
    recentActivities: exportRows.slice(-10).reverse(),
    // Trả thêm dữ liệu cho frontend để đồng bộ 7 tab Google Sheets.
    imports: importRows,
    catalog: getSheetData_(ss, 'Danh mục'),
    audit: getSheetData_(ss, 'AuditLog')
  };
}

/**
 * Tồn theo mã thuốc.
 */
function getStock_(ss) {
  const products = getSheetData_(ss, 'Sản phẩm');
  const imports = getSheetData_(ss, 'Nhập kho');

  const stock = {};

  imports.forEach(r => {
    const code = String(r['Mã SP'] || '').trim();
    if (!code) return;

    if (!stock[code]) {
      stock[code] = {
        code: code,
        name: r['Tên sản phẩm'] || '',
        quantity: 0,
        batches: 0
      };
    }

    stock[code].quantity += Number(r['Số lượng còn']) || 0;
    stock[code].batches++;
  });

  return products.map(p => ({
    code: p['Mã SP'],
    name: p['Tên sản phẩm'],
    unit: p['Đơn vị'],
    minimum: Number(p['Tồn tối thiểu']) || 0,
    quantity: stock[p['Mã SP']]
      ? stock[p['Mã SP']].quantity
      : 0,
    batches: stock[p['Mã SP']]
      ? stock[p['Mã SP']].batches
      : 0,
    status: p['Trạng thái'] || 'ACTIVE'
  }));
}

/**
 * Đảm bảo hệ thống luôn có đủ tab.
 */
function ensureSystemSheets_(ss) {
  Object.keys(SHEET_CONFIG).forEach(name => {
    let sh = ss.getSheetByName(name);

    if (!sh) {
      sh = ss.insertSheet(name);
    }

    ensureHeaders_(sh, SHEET_CONFIG[name]);
  });
}

/**
 * Đọc sheet thành array object.
 */
function getSheetData_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);

  if (!sh || sh.getLastRow() < 1) return [];

  const data = sh
    .getRange(1, 1, sh.getLastRow(), sh.getLastColumn())
    .getValues();

  if (!data.length) return [];

  const headers = data[0].map(h => String(h).trim());

  return data.slice(1)
    .filter(row => row.some(v => v !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i];
      });
      return obj;
    });
}

/**
 * Kiểm tra ngày hợp lệ.
 */
function isValidDate_(d) {
  return d instanceof Date &&
    !isNaN(d.getTime());
}

function formatDate_(d) {
  if (!isValidDate_(d)) return '';

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy'
  );
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data, (_, value) => {
        if (value instanceof Date) {
          return Utilities.formatDate(
            value,
            Session.getScriptTimeZone(),
            'yyyy-MM-dd HH:mm:ss'
          );
        }
        return value;
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}
