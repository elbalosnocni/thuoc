/*******************************************************
 * HỆ THỐNG QUẢN LÝ CẤP PHÁT THUỐC
 * Google Apps Script - quy trình khép kín:
 * Sản phẩm -> Nhập kho -> Tồn kho -> Cấp phát FEFO -> Báo cáo
 *******************************************************/
const SPREADSHEET_ID = '1ZT7EeWVtJ8WkUWy7voM8FWxqBfMekvoeCo53Q3p9bJg';

const SHEET_CONFIG = {
  'Sản phẩm': ['Mã SP','Tên sản phẩm','Hoạt chất','Đơn vị','Nhóm thuốc','Giá nhập','Giá xuất','Tồn tối thiểu','Trạng thái','Ghi chú'],
  'Nhập kho': ['Mã phiếu nhập','Ngày nhập','Mã SP','Tên sản phẩm','Số lô','Số lượng nhập','Số lượng còn','Hạn sử dụng','Đơn giá','Nhà cung cấp','Người nhập','Ghi chú'],
  'Xuất kho': ['Mã phiếu cấp phát','Thời gian','Mã SP','Tên sản phẩm','Tổng số lượng','Người nhận','Bộ phận','Người thực hiện','Ghi chú'],
  'Chi tiết cấp phát': ['Mã phiếu cấp phát','Mã SP','Tên sản phẩm','Số lô','Hạn sử dụng','Số lượng xuất','Đơn giá'],
  'Danh mục': ['Loại','Mã','Tên','Trạng thái','Ghi chú'],
  'AuditLog': ['Thời gian','Hành động','Mã phiếu','Mã SP','Số lượng','Người thực hiện','Nội dung','IP/UserAgent'],
  'Config': ['Key','Value','Mô tả']
};

function getSpreadsheet_(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }

function setupThuocSheets(){
  const ss=getSpreadsheet_(), result=[];
  Object.keys(SHEET_CONFIG).forEach(name=>{
    let sh=ss.getSheetByName(name);
    if(!sh){ sh=ss.insertSheet(name); result.push('Tạo tab: '+name); }
    else result.push('Đã có tab: '+name);
    ensureHeaders_(sh,SHEET_CONFIG[name]); formatSheet_(sh,SHEET_CONFIG[name]);
  });
  seedDanhMuc_(ss); seedConfig_(ss); SpreadsheetApp.flush(); return result;
}

function resetThuocSheets(){
  const ss=getSpreadsheet_();
  Object.keys(SHEET_CONFIG).forEach(name=>{
    let sh=ss.getSheetByName(name)||ss.insertSheet(name);
    sh.clear(); sh.clearFormats(); ensureHeaders_(sh,SHEET_CONFIG[name]); formatSheet_(sh,SHEET_CONFIG[name]);
  });
  seedDanhMuc_(ss); seedConfig_(ss); SpreadsheetApp.flush();
}

function ensureHeaders_(sh,headers){
  if(sh.getMaxColumns()<headers.length) sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
  const row=sh.getRange(1,1,1,headers.length).getValues()[0];
  if(row.every(v=>String(v).trim()==='')) sh.getRange(1,1,1,headers.length).setValues([headers]);
}
function formatSheet_(sh,headers){
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  const dateHeaders=['Ngày nhập','Hạn sử dụng','Thời gian'];
  const numberHeaders=['Số lượng nhập','Số lượng còn','Số lượng xuất','Tổng số lượng','Giá nhập','Giá xuất','Đơn giá','Tồn tối thiểu'];
  headers.forEach((h,i)=>{
    if(sh.getMaxRows()>1 && dateHeaders.indexOf(h)>=0) sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat('dd/MM/yyyy HH:mm');
    if(sh.getMaxRows()>1 && numberHeaders.indexOf(h)>=0) sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat('#,##0.##');
    sh.autoResizeColumn(i+1); const w=sh.getColumnWidth(i+1); if(w<90)sh.setColumnWidth(i+1,90); if(w>260)sh.setColumnWidth(i+1,260);
  });
}
function seedDanhMuc_(ss){
  const sh=ss.getSheetByName('Danh mục'); if(!sh||sh.getLastRow()>1)return;
  sh.getRange(2,1,9,5).setValues([
    ['Trạng thái thuốc','ACTIVE','Đang sử dụng','ACTIVE',''],
    ['Trạng thái thuốc','INACTIVE','Ngừng sử dụng','ACTIVE',''],
    ['Nhóm thuốc','THUOC','Thuốc','ACTIVE',''],['Nhóm thuốc','VTYT','Vật tư y tế','ACTIVE',''],
    ['Đơn vị','VIEN','Viên','ACTIVE',''],['Đơn vị','GOI','Gói','ACTIVE',''],['Đơn vị','CHAI','Chai','ACTIVE',''],['Đơn vị','ONG','Ống','ACTIVE',''],['Đơn vị','HOP','Hộp','ACTIVE','']
  ]);
}
function seedConfig_(ss){
  const sh=ss.getSheetByName('Config'); if(!sh||sh.getLastRow()>1)return;
  sh.getRange(2,1,4,3).setValues([
    ['APP_NAME','Quản lý cấp phát thuốc','Tên hệ thống'],['STOCK_METHOD','FEFO','Xuất lô có hạn sử dụng gần nhất trước'],['LOW_STOCK_DEFAULT','10','Ngưỡng tồn tối thiểu mặc định'],['TIMEZONE',Session.getScriptTimeZone(),'Múi giờ Apps Script']
  ]);
}
function ensureSystemSheets_(ss){ Object.keys(SHEET_CONFIG).forEach(n=>{let sh=ss.getSheetByName(n)||ss.insertSheet(n);ensureHeaders_(sh,SHEET_CONFIG[n]);}); }

function doGet(e){
  try{
    const ss=getSpreadsheet_(); ensureSystemSheets_(ss);
    const a=e&&e.parameter?e.parameter.action:'';
    if(a==='setup') return json_({status:'success',message:'Đã setup các tab.',sheets:Object.keys(SHEET_CONFIG)});
    if(a==='getProducts') return json_(getSheetData_(ss,'Sản phẩm'));
    if(a==='getDashboard') return json_(getDashboard_(ss));
    if(a==='getStock') return json_(getStock_(ss));
    if(a==='getExportHistory') return json_(getSheetData_(ss,'Xuất kho'));
    if(a==='getReport') return json_(getReport_(ss,e.parameter||{}));
    return json_({status:'success',message:'API đang hoạt động.',actions:['getProducts','getDashboard','getStock','getExportHistory','getReport']});
  }catch(err){ return json_({status:'error',message:err.message}); }
}

function doPost(e){
  try{
    const payload=JSON.parse((e.postData&&e.postData.contents)||'{}'), a=payload.action, ss=getSpreadsheet_(); ensureSystemSheets_(ss);
    if(a==='setupSheets'){setupThuocSheets();return json_({status:'success',message:'Đã setup các tab.'});}
    if(a==='createProduct') return json_(createProduct_(ss,payload));
    if(a==='updateProduct') return json_(updateProduct_(ss,payload));
    if(a==='deleteProduct') return json_(deleteProduct_(ss,payload));
    if(a==='createImport') return json_(createImport_(ss,payload));
    if(a==='exportFIFO'||a==='exportFEFO') return json_(exportMedicine_(ss,payload));
    return json_({status:'error',message:'Action không được hỗ trợ.'});
  }catch(err){return json_({status:'error',message:err.message});}
}

function validateProduct_(p){
  const code=String(p.code||'').trim(), name=String(p.name||'').trim(), unit=String(p.unit||'').trim(), group=String(p.group||'').trim();
  const cost=Number(p.cost||0), price=Number(p.price||0), minimum=Number(p.minimum||0);
  if(!code||!name) throw new Error('Mã SP và tên sản phẩm là bắt buộc.');
  if(!unit) throw new Error('Vui lòng chọn đơn vị.');
  if(!group) throw new Error('Vui lòng chọn nhóm thuốc.');
  if(!Number.isFinite(cost)||cost<0||!Number.isFinite(price)||price<0||!Number.isFinite(minimum)||minimum<0) throw new Error('Giá và tồn tối thiểu không hợp lệ.');
  return {code,name,activeIngredient:String(p.activeIngredient||'').trim(),unit,group,cost,price,minimum,status:String(p.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE',note:String(p.note||'').trim()};
}
function createProduct_(ss,p){
  const product=validateProduct_(p), sh=ss.getSheetByName('Sản phẩm'), rows=getSheetData_(ss,'Sản phẩm');
  if(rows.some(r=>String(r['Mã SP']).trim()===product.code)) throw new Error('Mã SP đã tồn tại.');
  sh.appendRow([product.code,product.name,product.activeIngredient,product.unit,product.group,product.cost,product.price,product.minimum,product.status,product.note]);
  audit_(ss,'TẠO SẢN PHẨM','',product.code,'',p.performer||'Admin','Tạo sản phẩm '+product.name);
  return {status:'success',message:'Đã tạo sản phẩm.',product:product};
}
function updateProduct_(ss,p){
  const product=validateProduct_(p), sh=ss.getSheetByName('Sản phẩm'), values=sh.getDataRange().getValues(), oldCode=String(p.oldCode||product.code).trim();
  let rowIndex=-1;
  for(let i=1;i<values.length;i++) if(String(values[i][0]).trim()===oldCode){rowIndex=i+1;break;}
  if(rowIndex<0) throw new Error('Không tìm thấy sản phẩm.');
  if(oldCode!==product.code && values.slice(1).some(r=>String(r[0]).trim()===product.code)) throw new Error('Mã SP mới đã tồn tại.');
  sh.getRange(rowIndex,1,1,10).setValues([[product.code,product.name,product.activeIngredient,product.unit,product.group,product.cost,product.price,product.minimum,product.status,product.note]]);
  audit_(ss,'CẬP NHẬT SẢN PHẨM','',product.code,'',p.performer||'Admin','Cập nhật sản phẩm');
  return {status:'success',message:'Đã cập nhật sản phẩm.'};
}
function deleteProduct_(ss,p){
  const code=String(p.code||'').trim(); if(!code)throw new Error('Thiếu mã SP.');
  const sh=ss.getSheetByName('Sản phẩm'), values=sh.getDataRange().getValues(); let idx=-1;
  for(let i=1;i<values.length;i++) if(String(values[i][0]).trim()===code){idx=i+1;break;}
  if(idx<0)throw new Error('Không tìm thấy sản phẩm.');
  const imports=getSheetData_(ss,'Nhập kho');
  if(imports.some(r=>String(r['Mã SP']).trim()===code && Number(r['Số lượng còn'])>0)) throw new Error('Không thể xóa: sản phẩm vẫn còn tồn kho. Hãy chuyển trạng thái INACTIVE.');
  sh.deleteRow(idx); audit_(ss,'XÓA SẢN PHẨM','',code,'',p.performer||'Admin','Xóa sản phẩm');
  return {status:'success',message:'Đã xóa sản phẩm.'};
}

function parseDate_(v){
  if(v instanceof Date && !isNaN(v))return v;
  if(v===null||v===undefined||v==='')return null;
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0));
  const d=new Date(s); return isNaN(d)?null:d;
}
function createImport_(ss,p){
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try{
    const code=String(p.code||'').trim(), lot=String(p.lot||'').trim(), supplier=String(p.supplier||'').trim(), performer=String(p.performer||'Admin').trim();
    const qty=Number(p.quantity), price=Number(p.price||0), importDate=parseDate_(p.importDate)||new Date(), expiry=parseDate_(p.expiry);
    if(!code||!lot)throw new Error('Mã SP và số lô là bắt buộc.');
    if(!Number.isFinite(qty)||qty<=0)throw new Error('Số lượng nhập phải lớn hơn 0.');
    if(!Number.isFinite(price)||price<0)throw new Error('Đơn giá không hợp lệ.');
    if(!expiry)throw new Error('Vui lòng nhập hạn sử dụng.');
    if(expiry.getTime()<importDate.getTime())throw new Error('Hạn sử dụng không được trước ngày nhập.');
    const products=getSheetData_(ss,'Sản phẩm'), product=products.find(r=>String(r['Mã SP']).trim()===code);
    if(!product)throw new Error('Không tìm thấy sản phẩm '+code+'. Hãy tạo sản phẩm trước.');
    if(String(product['Trạng thái']).toUpperCase()==='INACTIVE')throw new Error('Sản phẩm đang INACTIVE.');
    const imports=getSheetData_(ss,'Nhập kho');
    if(imports.some(r=>String(r['Mã SP']).trim()===code&&String(r['Số lô']).trim()===lot&&String(r['Hạn sử dụng'])===String(expiry))){}
    const now=new Date(), id=makeId_('PN',now);
    ss.getSheetByName('Nhập kho').appendRow([id,importDate,code,product['Tên sản phẩm']||'',lot,qty,qty,expiry,price,supplier,performer,String(p.note||'').trim()]);
    audit_(ss,'NHẬP KHO',id,code,qty,performer,'Nhập lô '+lot);
    SpreadsheetApp.flush();
    return {status:'success',message:'Nhập kho thành công.',importId:id};
  }finally{lock.releaseLock();}
}

function exportMedicine_(ss,p){
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try{
    const code=String(p.code||'').trim(), quantity=Number(p.quantity), receiver=String(p.receiver||'').trim(), department=String(p.department||'').trim(), performer=String(p.performer||'Admin').trim(), note=String(p.note||'').trim();
    if(!code)throw new Error('Chưa chọn sản phẩm.'); if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Số lượng cấp phát phải lớn hơn 0.'); if(!receiver)throw new Error('Chưa nhập người nhận.'); if(!department)throw new Error('Chưa nhập bộ phận.');
    const products=getSheetData_(ss,'Sản phẩm'), product=products.find(r=>String(r['Mã SP']).trim()===code);
    if(!product)throw new Error('Không tìm thấy sản phẩm.'); if(String(product['Trạng thái']).toUpperCase()==='INACTIVE')throw new Error('Sản phẩm đang INACTIVE.');
    const sh=ss.getSheetByName('Nhập kho'), values=sh.getDataRange().getValues(), batches=[];
    for(let i=1;i<values.length;i++){
      const row=values[i], rowCode=String(row[2]||'').trim(), remaining=Number(row[6])||0; if(rowCode!==code||remaining<=0)continue;
      const expiry=parseDate_(row[7]); if(!expiry||expiry.getTime()<Date.now())continue;
      batches.push({rowIndex:i+1,importDate:parseDate_(row[1])||new Date(8640000000000000),lot:String(row[4]||''),remaining,expiry,unitPrice:Number(row[8])||0});
    }
    batches.sort((a,b)=>a.expiry-b.expiry||a.importDate-b.importDate);
    const total=batches.reduce((s,b)=>s+b.remaining,0); if(total<quantity)throw new Error('Không đủ tồn kho. Tồn khả dụng: '+total+'.');
    let need=quantity; const allocations=[];
    for(const b of batches){if(need<=0)break;const q=Math.min(need,b.remaining);allocations.push({...b,quantity:q});need-=q;}
    allocations.forEach(a=>sh.getRange(a.rowIndex,7).setValue(a.remaining-a.quantity));
    const now=new Date(), id=makeId_('PX',now), out=ss.getSheetByName('Xuất kho'), detail=ss.getSheetByName('Chi tiết cấp phát');
    out.appendRow([id,now,code,product['Tên sản phẩm']||'',quantity,receiver,department,performer,note]);
    if(allocations.length) detail.getRange(detail.getLastRow()+1,1,allocations.length,7).setValues(allocations.map(a=>[id,code,product['Tên sản phẩm']||'',a.lot,a.expiry,a.quantity,a.unitPrice]));
    audit_(ss,'CẤP PHÁT',id,code,quantity,performer,'Cấp phát cho '+receiver+' - '+department);
    SpreadsheetApp.flush();
    return {status:'success',message:'Cấp phát thành công.',exportId:id,allocations:allocations.map(a=>({lot:a.lot,expiry:formatDate_(a.expiry),quantity:a.quantity}))};
  }finally{lock.releaseLock();}
}

function getDashboard_(ss){
  const products=getSheetData_(ss,'Sản phẩm'), imports=getSheetData_(ss,'Nhập kho'), exports=getSheetData_(ss,'Xuất kho'), stockMap={};
  let totalStock=0,stockValue=0,lowStock=0,expired=0,expiringSoon=0;
  imports.forEach(r=>{const c=String(r['Mã SP']||'').trim(),q=Number(r['Số lượng còn'])||0,price=Number(r['Đơn giá'])||0;if(!c)return;stockMap[c]=(stockMap[c]||0)+q;totalStock+=q;stockValue+=q*price;const ex=parseDate_(r['Hạn sử dụng']);if(q>0&&ex){const days=(ex-Date.now())/86400000;if(days<0)expired++;else if(days<=30)expiringSoon++;}});
  products.forEach(p=>{const min=Number(p['Tồn tối thiểu'])||0;if(min>0&&(stockMap[String(p['Mã SP']).trim()]||0)<=min)lowStock++;});
  const todayKey=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');
  const todayExports=exports.filter(r=>{const d=parseDate_(r['Thời gian']);return d&&Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd')===todayKey;});
  return {status:'success',products:products.length,totalStock,stockValue,todayOrders:todayExports.length,todayExportQty:todayExports.reduce((s,r)=>s+(Number(r['Tổng số lượng'])||0),0),lowStock,expired,expiringSoon,recentActivities:exports.slice(-10).reverse(),imports,catalog:getSheetData_(ss,'Danh mục'),audit:getSheetData_(ss,'AuditLog')};
}
function getStock_(ss){
  const products=getSheetData_(ss,'Sản phẩm'), imports=getSheetData_(ss,'Nhập kho'), stock={};
  imports.forEach(r=>{const c=String(r['Mã SP']||'').trim();if(!c)return;if(!stock[c])stock[c]={quantity:0,batches:0};stock[c].quantity+=Number(r['Số lượng còn'])||0;stock[c].batches++;});
  return products.map(p=>{const c=String(p['Mã SP']).trim(),s=stock[c]||{quantity:0,batches:0};return {code:p['Mã SP'],name:p['Tên sản phẩm'],unit:p['Đơn vị'],minimum:Number(p['Tồn tối thiểu'])||0,quantity:s.quantity,batches:s.batches,status:p['Trạng thái']||'ACTIVE'};});
}
function getReport_(ss,p){
  const exports=getSheetData_(ss,'Xuất kho'), products=getSheetData_(ss,'Sản phẩm'), details=getSheetData_(ss,'Chi tiết cấp phát');
  const month=String(p.month||Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM')), dept=String(p.department||'').trim(), code=String(p.code||'').trim();
  const start=new Date(month+'-01T00:00:00'), end=new Date(start); end.setMonth(end.getMonth()+1);
  const rows=exports.filter(r=>{const d=parseDate_(r['Thời gian']);return d&&d>=start&&d<end&&(!dept||String(r['Bộ phận']).trim()===dept)&&(!code||String(r['Mã SP']).trim()===code);});
  const byDept={},byProduct={}; rows.forEach(r=>{const d=String(r['Bộ phận']||'Không xác định'),c=String(r['Mã SP']||'');const q=Number(r['Tổng số lượng'])||0;byDept[d]=(byDept[d]||0)+q;byProduct[c]=(byProduct[c]||0)+q;});
  const detailMap={}; details.forEach(r=>{const id=String(r['Mã phiếu cấp phát']);detailMap[id]=(detailMap[id]||0)+(Number(r['Số lượng xuất'])||0);});
  const productName={};products.forEach(r=>productName[String(r['Mã SP'])]=r['Tên sản phẩm']);
  return {status:'success',month,department:dept,product:code,orders:rows.length,quantity:rows.reduce((s,r)=>s+(Number(r['Tổng số lượng'])||0),0),departments:Object.keys(byDept).sort().map(k=>({department:k,quantity:byDept[k]})),products:Object.keys(byProduct).sort((a,b)=>byProduct[b]-byProduct[a]).map(k=>({code:k,name:productName[k]||k,quantity:byProduct[k]})),rows:rows.slice().reverse()};
}
function getSheetData_(ss,name){
  const sh=ss.getSheetByName(name); if(!sh||sh.getLastRow()<2)return [];
  const data=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues(), headers=data[0].map(h=>String(h).trim());
  return data.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]);return o;});
}
function audit_(ss,action,id,code,qty,performer,note){ss.getSheetByName('AuditLog').appendRow([new Date(),action,id,code,qty,performer,note,'']);}
function makeId_(prefix,d){return prefix+'-'+Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,6).toUpperCase();}
function formatDate_(d){return d?Utilities.formatDate(d,Session.getScriptTimeZone(),'dd/MM/yyyy'):'';}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data,(_,v)=>v instanceof Date?Utilities.formatDate(v,Session.getScriptTimeZone(),'yyyy-MM-dd HH:mm:ss'):v)).setMimeType(ContentService.MimeType.JSON);}
