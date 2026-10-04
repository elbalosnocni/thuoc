/**
 * QUẢN LÝ KHO THUỐC - V4.1
 * Kiến trúc: GitHub Pages + Google Apps Script Web API.
 * Frontend dùng JSONP để không phụ thuộc CORS.
 */
const SPREADSHEET_ID = '1ZT7EeWVtJ8WkUWy7voM8FWxqBfMekvoeCo53Q3p9bJg';
const APP_VERSION = '4.2.0';
const SESSION_TTL = 21600; // 6 giờ

const SHEETS = {
  PRODUCTS: {name:'Sản phẩm', headers:['Mã SP','Tên sản phẩm','Hoạt chất','Đơn vị','Nhóm thuốc','Giá nhập','Giá xuất','Tồn tối thiểu','Trạng thái','Ghi chú']},
  IMPORTS: {name:'Nhập kho', headers:['Mã phiếu nhập','Ngày nhập','Mã SP','Tên sản phẩm','Số lô','Số lượng nhập','Số lượng còn','Hạn sử dụng','Đơn giá','Nhà cung cấp','Người nhập','Ghi chú']},
  EXPORTS: {name:'Xuất kho', headers:['Mã phiếu cấp phát','Thời gian','Mã SP','Tên sản phẩm','Tổng số lượng','Người nhận','Bộ phận','Người thực hiện','Ghi chú','Trạng thái','Khóa lúc','Người khóa']},
  DETAILS: {name:'Chi tiết cấp phát', headers:['Mã phiếu cấp phát','Mã SP','Tên sản phẩm','Số lô','Hạn sử dụng','Số lượng xuất','Đơn giá']},
  CATALOG: {name:'Danh mục', headers:['Loại','Mã','Tên','Trạng thái','Ghi chú']},
  AUDIT: {name:'AuditLog', headers:['Thời gian','Hành động','Mã phiếu','Mã SP','Số lượng','Người thực hiện','Nội dung','IP/UserAgent']},
  CONFIG: {name:'Config', headers:['Key','Value','Mô tả']},
  USERS: {name:'Users', headers:['Username','Họ tên','Vai trò','Bộ phận','PasswordHash','Salt','Hoạt động','Đổi mật khẩu','Lần đăng nhập','Tạo lúc']}
};
const ROLES = {ADMIN:'ADMIN', STORE:'KHO', DISPENSER:'CAP_PHAT'};

function ss_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function tz_(){return Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';}
function now_(){return new Date();}

/**
 * Web API cho GitHub Pages.
 * Dùng JSONP để tránh CORS khi frontend chạy ngoài Apps Script.
 * payload = {action:'login', args:[...]}
 */
function doGet(e){
  const p=(e&&e.parameter)||{};
  const callback=String(p.callback||'').trim();
  let result;
  try{
    let req={};
    if(p.payload) req=JSON.parse(p.payload);
    const action=String(req.action||p.action||'').trim();
    const args=Array.isArray(req.args)?req.args:[];
    if(action==='ping'){
      result={status:'success',ok:true,version:APP_VERSION,message:'Google Apps Script Web API dang hoat dong.',time:now_()};
    }else if(action==='setup'){
      result=setupV2();
    }else{
      result=dispatchApi_(action,args);
    }
    if(!result || typeof result!=='object') result={status:'success',data:result};
  }catch(err){
    result={status:'error',message:err&&err.message?err.message:String(err)};
  }
  if(callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)){
    return ContentService.createTextOutput(callback+'('+JSON.stringify(result)+');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** POST vẫn được giữ để có thể dùng cho các client khác. */
function doPost(e){
  try{
    const body=e&&e.postData&&e.postData.contents?JSON.parse(e.postData.contents):{};
    const action=String(body.action||'').trim();
    const args=Array.isArray(body.args)?body.args:[];
    return ContentService.createTextOutput(JSON.stringify(dispatchApi_(action,args)))
      .setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({status:'error',message:err&&err.message?err.message:String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function dispatchApi_(action,args){
  ensureReady_();
  switch(action){
    case 'login': return login(args[0],args[1]);
    case 'logout': return logout(args[0]);
    case 'me': return me(args[0]);
    case 'changePassword': return changePassword(args[0],args[1],args[2]);
    case 'listUsers': return listUsers(args[0]);
    case 'saveUser': return saveUser(args[0],args[1]||{});
    case 'setUserStatus': return setUserStatus(args[0],args[1],args[2]);
    case 'resetUserPassword': return resetUserPassword(args[0],args[1],args[2]);
    case 'getApp': return getApp(args[0]);
    case 'getProducts': return getProducts(args[0]);
    case 'getStock': return getStock(args[0]);
    case 'getReport': return getReport(args[0],args[1]||{});
    case 'getAudit': return getAudit(args[0]);
    case 'createProduct': return createProduct(args[0],args[1]||{});
    case 'updateProduct': return updateProduct(args[0],args[1]||{});
    case 'deleteProduct': return deleteProduct(args[0],args[1]||{});
    case 'createImport': return createImport(args[0],args[1]||{});
    case 'createIssue': return createIssue(args[0],args[1]||{});
    case 'getIssueDetails': return getIssueDetails(args[0],args[1]);
    default: throw new Error('API action không được hỗ trợ: '+action);
  }
}

function setupV2(){setupV2_(); return {status:'success',version:APP_VERSION,message:'Đã cập nhật cấu trúc V4.'};}
function ensureReady_(){
  const book=ss_();
  const ready=Object.keys(SHEETS).every(k=>{
    const sh=book.getSheetByName(SHEETS[k].name);
    if(!sh)return false;
    const last=Math.max(sh.getLastColumn(),SHEETS[k].headers.length);
    const first=sh.getRange(1,1,1,last).getValues()[0].map(v=>String(v||'').trim());
    return SHEETS[k].headers.every((h,i)=>first[i]===h);
  });
  if(!ready) setupV2_();
}
function setupV2_(){
  const book=ss_();
  Object.keys(SHEETS).forEach(k=>ensureSheet_(book,SHEETS[k].name,SHEETS[k].headers));
  seedCatalog_(book); seedConfig_(book); seedAdmin_(book); migrateExportLockColumns_(book); formatSheets_(book);
  SpreadsheetApp.flush();
}

function ensureSheet_(book,name,headers){
  let sh=book.getSheetByName(name); if(!sh) sh=book.insertSheet(name);
  if(sh.getMaxColumns()<headers.length) sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
  const first=sh.getRange(1,1,1,Math.max(headers.length,sh.getLastColumn()||headers.length)).getValues()[0];
  headers.forEach((h,i)=>{if(String(first[i]||'').trim()!==h) sh.getRange(1,i+1).setValue(h);});
  sh.setFrozenRows(1);
}
function migrateExportLockColumns_(book){
  const sh=book.getSheetByName(SHEETS.EXPORTS.name); const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  ['Trạng thái','Khóa lúc','Người khóa'].forEach(x=>{if(h.indexOf(x)<0)sh.getRange(1,sh.getLastColumn()+1).setValue(x);});
  const map=headerMap_(sh), lr=sh.getLastRow();
  if(lr>1 && map['Trạng thái']){
    const vals=sh.getRange(2,map['Trạng thái'],lr-1,1).getValues();
    vals.forEach((r,i)=>{if(!String(r[0]||'').trim()) r[0]='LOCKED';});
    sh.getRange(2,map['Trạng thái'],lr-1,1).setValues(vals);
  }
}
function formatSheets_(book){
  Object.keys(SHEETS).forEach(k=>{
    const cfg=SHEETS[k],sh=book.getSheetByName(cfg.name); if(!sh) return;
    const n=cfg.headers.length; sh.getRange(1,1,1,n).setFontWeight('bold').setBackground('#eef2ff').setWrap(true);
    if(sh.getMaxRows()>1){
      ['Ngày nhập','Hạn sử dụng','Thời gian','Khóa lúc','Lần đăng nhập','Tạo lúc'].forEach(h=>{const i=cfg.headers.indexOf(h);if(i>=0)sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat('dd/MM/yyyy HH:mm:ss');});
      ['Số lượng nhập','Số lượng còn','Số lượng xuất','Tổng số lượng','Giá nhập','Giá xuất','Đơn giá','Tồn tối thiểu'].forEach(h=>{const i=cfg.headers.indexOf(h);if(i>=0)sh.getRange(2,i+1,sh.getMaxRows()-1,1).setNumberFormat('#,##0.##');});
    }
  });
}
function seedCatalog_(book){
  const sh=book.getSheetByName(SHEETS.CATALOG.name); if(sh.getLastRow()>1)return;
  sh.getRange(2,1,9,5).setValues([
    ['Trạng thái thuốc','ACTIVE','Đang sử dụng','ACTIVE',''],['Trạng thái thuốc','INACTIVE','Ngừng sử dụng','ACTIVE',''],
    ['Nhóm thuốc','THUOC','Thuốc','ACTIVE',''],['Nhóm thuốc','VTYT','Vật tư y tế','ACTIVE',''],
    ['Đơn vị','VIEN','Viên','ACTIVE',''],['Đơn vị','GOI','Gói','ACTIVE',''],['Đơn vị','CHAI','Chai','ACTIVE',''],['Đơn vị','ONG','Ống','ACTIVE',''],['Đơn vị','HOP','Hộp','ACTIVE','']
  ]);
}
function seedConfig_(book){
  const sh=book.getSheetByName(SHEETS.CONFIG.name);
  if(sh.getLastRow()<=1){
    sh.getRange(2,1,5,3).setValues([
      ['APP_NAME','Quản lý kho thuốc V4.2','Tên hệ thống'],['APP_VERSION',APP_VERSION,'Phiên bản'],['STOCK_METHOD','FEFO','Xuất hạn dùng gần nhất trước'],['LOW_STOCK_DEFAULT','10','Ngưỡng tồn thấp mặc định'],['TIMEZONE',tz_(),'Múi giờ']
    ]);
  }else{
    const vals=sh.getDataRange().getValues();
    for(let i=1;i<vals.length;i++){
      const key=String(vals[i][0]||'').trim();
      if(key==='APP_VERSION')sh.getRange(i+1,2).setValue(APP_VERSION);
      if(key==='APP_NAME' && !String(vals[i][1]||'').trim())sh.getRange(i+1,2).setValue('Quản lý kho thuốc V4.2');
    }
  }
}
function seedAdmin_(book){
  const sh=book.getSheetByName(SHEETS.USERS.name); if(sh.getLastRow()>1)return;
  const salt=Utilities.getUuid();
  // Mật khẩu khởi tạo: Admin@12345. Bắt buộc đổi ngay lần đầu đăng nhập.
  sh.getRange(2,1,1,10).setValues([['admin','Quản trị hệ thống',ROLES.ADMIN,'',hashPassword_('Admin@12345',salt),salt,'ACTIVE','YES','',now_()]]);
  sh.getRange(3,1,2,10).setValues([
    ['kho','Nhân viên kho',ROLES.STORE,'',hashPassword_('Kho@12345',salt+'KHO'),salt+'KHO','ACTIVE','YES','',now_()],
    ['capphat','Người cấp phát',ROLES.DISPENSER,'',hashPassword_('CapPhat@12345',salt+'CAP'),salt+'CAP','ACTIVE','YES','',now_()]
  ]);
}

function login(username,password){
  ensureReady_(); username=String(username||'').trim().toLowerCase(); password=String(password||'');
  if(!username||!password)throw new Error('Vui lòng nhập tài khoản và mật khẩu.');
  const users=rows_(SHEETS.USERS.name), u=users.find(x=>String(x.Username).toLowerCase()===username);
  if(!u||String(u['Hoạt động']).toUpperCase()!=='ACTIVE')throw new Error('Tài khoản không tồn tại hoặc đã bị khóa.');
  if(hashPassword_(password,String(u.Salt))!==String(u.PasswordHash))throw new Error('Sai tài khoản hoặc mật khẩu.');
  const token=Utilities.getUuid()+'-'+Utilities.getUuid();
  const user={username:u.Username,name:u['Họ tên'],role:u['Vai trò'],department:u['Bộ phận']||'',forceChange:String(u['Đổi mật khẩu']).toUpperCase()==='YES'};
  CacheService.getScriptCache().put('SESSION_'+token,JSON.stringify(user),SESSION_TTL);
  updateUserLogin_(username);
  audit_(null,'ĐĂNG NHẬP','', '', '', username,'Đăng nhập thành công');
  return {status:'success',token,user};
}
function logout(token){if(token)CacheService.getScriptCache().remove('SESSION_'+token);return {status:'success'};}
function me(token){const user=requireAuth_(token);return {status:'success',user};}
function changePassword(token,oldPassword,newPassword){
  const user=requireAuth_(token), username=user.username; if(String(newPassword).length<8)throw new Error('Mật khẩu mới tối thiểu 8 ký tự.');
  const book=ss_(),sh=book.getSheetByName(SHEETS.USERS.name),vals=sh.getDataRange().getValues();let row=-1;
  for(let i=1;i<vals.length;i++)if(String(vals[i][0]).toLowerCase()===username){row=i+1;break;} if(row<0)throw new Error('Không tìm thấy tài khoản.');
  if(hashPassword_(String(oldPassword||''),String(vals[row-1][5]))!==String(vals[row-1][4]))throw new Error('Mật khẩu cũ không đúng.');
  const salt=Utilities.getUuid();sh.getRange(row,5,1,4).setValues([[hashPassword_(newPassword,salt),salt,'ACTIVE','NO']]);
  audit_(user,'ĐỔI MẬT KHẨU','', '', '',username,'Đổi mật khẩu');
  return {status:'success',message:'Đã đổi mật khẩu.'};
}
function hashPassword_(password,salt){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,password+salt);return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');}
function updateUserLogin_(username){const sh=ss_().getSheetByName(SHEETS.USERS.name),m=headerMap_(sh),vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++){if(String(vals[i][m.Username-1]).toLowerCase()===username){sh.getRange(i+1,m['Lần đăng nhập']).setValue(now_());break;}}}

function listUsers(token){requireRole_(token,[ROLES.ADMIN]);return {status:'success',users:rows_(SHEETS.USERS.name).map(u=>({username:u.Username,name:u['Họ tên'],role:u['Vai trò'],department:u['Bộ phận'],active:u['Hoạt động'],forceChange:u['Đổi mật khẩu'],lastLogin:u['Lần đăng nhập']}))};}
function saveUser(token,p){
  const actor=requireRole_(token,[ROLES.ADMIN]); setupV2_(); const sh=ss_().getSheetByName(SHEETS.USERS.name); const users=rows_(SHEETS.USERS.name);
  const username=String(p.username||'').trim().toLowerCase(), name=String(p.name||'').trim(), role=String(p.role||'').trim(), dept=String(p.department||'').trim(), active=p.active===false?'INACTIVE':'ACTIVE';
  if(!/^[a-z0-9._-]{3,30}$/.test(username))throw new Error('Tên đăng nhập chỉ gồm a-z, 0-9, ., _, - và dài 3-30 ký tự.');
  if(!name||![ROLES.ADMIN,ROLES.STORE,ROLES.DISPENSER].includes(role))throw new Error('Thông tin tài khoản không hợp lệ.');
  if(role===ROLES.DISPENSER && !dept)throw new Error('Tài khoản CAP_PHAT bắt buộc phải được gán Bộ phận.');
  const exists=users.find(u=>String(u.Username).toLowerCase()===username);
  if(exists)throw new Error('Tên đăng nhập đã tồn tại.');
  const pwd=String(p.password||''); if(pwd.length<8)throw new Error('Mật khẩu tối thiểu 8 ký tự.');
  const salt=Utilities.getUuid();sh.appendRow([username,name,role,dept,hashPassword_(pwd,salt),salt,active,'YES','',now_()]);
  audit_(actor,'TẠO TÀI KHOẢN','', '', '',actor.username,'Tạo tài khoản '+username);return {status:'success'};
}
function setUserStatus(token,username,active){const actor=requireRole_(token,[ROLES.ADMIN]);username=String(username).trim().toLowerCase();if(username===actor.username)throw new Error('Không thể tự khóa tài khoản đang đăng nhập.');const sh=ss_().getSheetByName(SHEETS.USERS.name),m=headerMap_(sh),vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++){if(String(vals[i][m.Username-1]).toLowerCase()===username){sh.getRange(i+1,m['Hoạt động']).setValue(active?'ACTIVE':'INACTIVE');audit_(actor,'ĐỔI TRẠNG THÁI TÀI KHOẢN','', '', '',actor.username,(active?'Mở khóa ':'Khóa ')+username);return {status:'success'};}}throw new Error('Không tìm thấy tài khoản.');}

function resetUserPassword(token,username,newPassword){
  const actor=requireRole_(token,[ROLES.ADMIN]);
  username=String(username||'').trim().toLowerCase();
  newPassword=String(newPassword||'');
  if(newPassword.length<8) throw new Error('Mật khẩu mới tối thiểu 8 ký tự.');
  if(username===actor.username) throw new Error('Hãy dùng chức năng Đổi mật khẩu cho chính tài khoản của bạn.');
  const sh=ss_().getSheetByName(SHEETS.USERS.name), m=headerMap_(sh), vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][m.Username-1]).toLowerCase()===username){
      const salt=Utilities.getUuid();
      sh.getRange(i+1,m.PasswordHash,1,4).setValues([[hashPassword_(newPassword,salt),salt,'ACTIVE','YES']]);
      audit_(actor,'RESET MẬT KHẨU','', '', '',actor.username,'Reset mật khẩu '+username);
      return {status:'success'};
    }
  }
  throw new Error('Không tìm thấy tài khoản.');
}

function getApp(token){
  const user=requireAuth_(token); const book=ss_();
  if(user.role===ROLES.DISPENSER && !user.department) throw new Error('Tài khoản CAP_PHAT chưa được gán Bộ phận. Vui lòng liên hệ ADMIN.');
  const products=getProducts_(), stock=getStock_(), dash=getDashboard_();
  let exports=getExports_();
  if(user.role===ROLES.DISPENSER) exports=exports.filter(r=>String(r['Bộ phận']||'').trim()===String(user.department||'').trim());
  return {status:'success',version:APP_VERSION,user,products,stock,dashboard:dash,exports,
    catalog:rows_(SHEETS.CATALOG.name),
    imports:(user.role===ROLES.ADMIN||user.role===ROLES.STORE)?rows_(SHEETS.IMPORTS.name):[],
    audit:user.role===ROLES.ADMIN?rows_(SHEETS.AUDIT.name):[]};
}
function getProducts(token){requireAuth_(token);return {status:'success',products:getProducts_()};}
function getStock(token){requireAuth_(token);return {status:'success',stock:getStock_()};}
function getReport(token,filters){
  const user=requireAuth_(token); filters=filters||{};
  if(user.role===ROLES.DISPENSER){
    if(!user.department) throw new Error('Tài khoản CAP_PHAT chưa được gán Bộ phận.');
    filters=Object.assign({},filters,{department:user.department});
  }
  return {status:'success',report:getReport_(filters)};
}
function getAudit(token){requireRole_(token,[ROLES.ADMIN]);return {status:'success',audit:rows_(SHEETS.AUDIT.name)};}

function createProduct(token,p){const user=requireRole_(token,[ROLES.ADMIN,ROLES.STORE]);const x=validateProduct_(p),sh=ss_().getSheetByName(SHEETS.PRODUCTS.name);if(getProducts_().some(r=>r.code===x.code))throw new Error('Mã SP đã tồn tại.');sh.appendRow([x.code,x.name,x.activeIngredient,x.unit,x.group,x.cost,x.price,x.minimum,x.status,x.note]);audit_(user,'TẠO SẢN PHẨM','',x.code,'',user.username,'Tạo sản phẩm '+x.name);return {status:'success',product:x};}
function updateProduct(token,p){
  const user=requireRole_(token,[ROLES.ADMIN,ROLES.STORE]);
  const x=validateProduct_(p),sh=ss_().getSheetByName(SHEETS.PRODUCTS.name),m=headerMap_(sh),vals=sh.getDataRange().getValues(),old=String(p.oldCode||x.code).trim().toUpperCase();
  let row=-1; for(let i=1;i<vals.length;i++) if(String(vals[i][m['Mã SP']-1]).trim().toUpperCase()===old){row=i+1;break;}
  if(row<0)throw new Error('Không tìm thấy sản phẩm.');
  if(old!==x.code && getProducts_().some(r=>r.code===x.code))throw new Error('Mã SP mới đã tồn tại.');
  if(old!==x.code && hasProductHistory_(old))throw new Error('Không thể đổi Mã SP vì sản phẩm đã phát sinh giao dịch. Hãy giữ nguyên Mã SP và chỉ cập nhật thông tin khác.');
  sh.getRange(row,1,1,10).setValues([[x.code,x.name,x.activeIngredient,x.unit,x.group,x.cost,x.price,x.minimum,x.status,x.note]]);
  audit_(user,'CẬP NHẬT SẢN PHẨM','',x.code,'',user.username,'Cập nhật sản phẩm');
  return {status:'success'};
}
function deleteProduct(token,p){
  const user=requireRole_(token,[ROLES.ADMIN]);
  const code=String(p.code||'').trim().toUpperCase(),sh=ss_().getSheetByName(SHEETS.PRODUCTS.name),m=headerMap_(sh),vals=sh.getDataRange().getValues();
  let row=-1; for(let i=1;i<vals.length;i++) if(String(vals[i][m['Mã SP']-1]).trim().toUpperCase()===code){row=i+1;break;}
  if(row<0)throw new Error('Không tìm thấy sản phẩm.');
  if(hasProductHistory_(code))throw new Error('Không thể xóa sản phẩm đã phát sinh giao dịch. Hãy chuyển trạng thái INACTIVE để giữ nguyên lịch sử.');
  sh.deleteRow(row); audit_(user,'XÓA SẢN PHẨM','',code,'',user.username,'Xóa sản phẩm chưa phát sinh giao dịch'); return {status:'success'};
}
function hasProductHistory_(code){
  code=String(code||'').trim().toUpperCase();
  const sheets=[SHEETS.IMPORTS.name,SHEETS.EXPORTS.name,SHEETS.DETAILS.name];
  return sheets.some(name=>rows_(name).some(r=>String(r['Mã SP']||'').trim().toUpperCase()===code));
}

function createImport(token,p){const user=requireRole_(token,[ROLES.ADMIN,ROLES.STORE]);const lock=LockService.getScriptLock();lock.waitLock(30000);try{const code=String(p.code||'').trim(),lot=String(p.lot||'').trim(),supplier=String(p.supplier||'').trim(),qty=Number(p.quantity),price=Number(p.price||0),importDate=parseDate_(p.importDate)||now_(),expiry=parseDate_(p.expiry);if(!code||!lot)throw new Error('Mã SP và số lô là bắt buộc.');if(!Number.isFinite(qty)||qty<=0)throw new Error('Số lượng nhập phải > 0.');if(!Number.isFinite(price)||price<0)throw new Error('Đơn giá không hợp lệ.');if(!expiry)throw new Error('Vui lòng nhập hạn sử dụng.');if(expiry<importDate)throw new Error('Hạn sử dụng không được trước ngày nhập.');const product=getProducts_().find(x=>x.code===code);if(!product)throw new Error('Không tìm thấy sản phẩm.');if(product.status==='INACTIVE')throw new Error('Sản phẩm đang INACTIVE.');const id=makeId_('PN');ss_().getSheetByName(SHEETS.IMPORTS.name).appendRow([id,importDate,code,product.name,lot,qty,qty,expiry,price,supplier,user.username,String(p.note||'').trim()]);audit_(user,'NHẬP KHO',id,code,qty,user.username,'Nhập lô '+lot);SpreadsheetApp.flush();return {status:'success',importId:id};}finally{lock.releaseLock();}}

function createIssue(token,p){const user=requireRole_(token,[ROLES.ADMIN,ROLES.DISPENSER]);const lock=LockService.getScriptLock();lock.waitLock(30000);try{return createIssueLocked_(user,p);}finally{lock.releaseLock();}}
function createIssueLocked_(user,p){
  const code=String(p.code||'').trim(),qty=Number(p.quantity),receiver=String(p.receiver||'').trim(),dept=String(p.department||'').trim(),note=String(p.note||'').trim();
  if(!code||!Number.isFinite(qty)||qty<=0||!receiver||!dept)throw new Error('Sản phẩm, số lượng, người nhận và bộ phận là bắt buộc.');
  if(user.role===ROLES.DISPENSER){
    if(!user.department)throw new Error('Tài khoản CAP_PHAT chưa được gán Bộ phận. Vui lòng liên hệ ADMIN.');
    if(user.department!==dept)throw new Error('Bạn chỉ được cấp phát cho bộ phận '+user.department+'.');
  }
  const product=getProducts_().find(x=>x.code===code);
  if(!product||product.status==='INACTIVE')throw new Error('Sản phẩm không tồn tại hoặc đang INACTIVE.');

  const sh=ss_().getSheetByName(SHEETS.IMPORTS.name),m=headerMap_(sh),vals=sh.getDataRange().getValues(),batches=[];
  for(let i=1;i<vals.length;i++){
    const r=vals[i],c=String(r[m['Mã SP']-1]||'').trim(),remaining=Number(r[m['Số lượng còn']-1])||0;
    if(c!==code||remaining<=0)continue;
    const expiry=parseDate_(r[m['Hạn sử dụng']-1]);
    if(!expiry||expiry.getTime()<Date.now())continue;
    batches.push({row:i+1,lot:String(r[m['Số lô']-1]||''),remaining,expiry,importDate:parseDate_(r[m['Ngày nhập']-1])||new Date(0),unitPrice:Number(r[m['Đơn giá']-1])||0});
  }
  batches.sort((a,b)=>a.expiry-b.expiry||a.importDate-b.importDate);
  const available=batches.reduce((s,b)=>s+b.remaining,0);
  if(available<qty)throw new Error('Không đủ tồn khả dụng. Hiện còn '+available+'.');

  let need=qty;const alloc=[];
  for(const b of batches){if(need<=0)break;const q=Math.min(need,b.remaining);alloc.push({...b,quantity:q});need-=q;}
  if(need>0)throw new Error('Không thể phân bổ đủ số lượng theo FEFO.');

  const changed=[]; let issueRow=0; let detailStart=0; let detailCount=0;
  try{
    alloc.forEach(a=>{
      sh.getRange(a.row,m['Số lượng còn']).setValue(a.remaining-a.quantity);
      changed.push(a);
    });

    const id=makeId_('PX'),now=now_(),out=ss_().getSheetByName(SHEETS.EXPORTS.name);
    const row=[id,now,code,product.name,qty,receiver,dept,user.username,note,'LOCKED',now,user.username];
    issueRow=out.getLastRow()+1;
    out.getRange(issueRow,1,1,row.length).setValues([row]);

    const detail=ss_().getSheetByName(SHEETS.DETAILS.name);
    detailStart=detail.getLastRow()+1; detailCount=alloc.length;
    if(detailCount) detail.getRange(detailStart,1,detailCount,7).setValues(alloc.map(a=>[id,code,product.name,a.lot,a.expiry,a.quantity,a.unitPrice]));

    audit_(user,'CẤP PHÁT - KHÓA PHIẾU',id,code,qty,user.username,'Phiếu đã khóa ngay sau khi cấp phát cho '+receiver+' - '+dept);
    SpreadsheetApp.flush();
    return {status:'success',issueId:id,status:'LOCKED',allocations:alloc.map(a=>({lot:a.lot,expiry:formatDateTime_(a.expiry),quantity:a.quantity}))};
  }catch(err){
    try{
      if(detailCount){ const detail=ss_().getSheetByName(SHEETS.DETAILS.name); if(detail.getLastRow()>=detailStart) detail.deleteRows(detailStart,Math.min(detailCount,detail.getLastRow()-detailStart+1)); }
      if(issueRow){ const out=ss_().getSheetByName(SHEETS.EXPORTS.name); if(out.getLastRow()>=issueRow) out.deleteRow(issueRow); }
    }catch(rollbackDocsErr){}
    changed.forEach(a=>sh.getRange(a.row,m['Số lượng còn']).setValue(a.remaining));
    SpreadsheetApp.flush();
    throw new Error('Không thể hoàn tất cấp phát; phiếu, chi tiết và tồn kho đã được hoàn nguyên. '+err.message);
  }
}

function getIssueDetails(token,issueId){
  const user=requireAuth_(token); issueId=String(issueId||'').trim(); if(!issueId)throw new Error('Thiếu mã phiếu.');
  const order=getExports_().find(r=>String(r['Mã phiếu cấp phát']||'').trim()===issueId);
  if(!order)throw new Error('Không tìm thấy phiếu cấp phát.');
  if(user.role===ROLES.DISPENSER){
    if(!user.department)throw new Error('Tài khoản CAP_PHAT chưa được gán Bộ phận.');
    if(String(order['Bộ phận']||'').trim()!==String(user.department||'').trim())throw new Error('Bạn không có quyền xem phiếu của bộ phận khác.');
  }
  const rows=rows_(SHEETS.DETAILS.name).filter(r=>String(r['Mã phiếu cấp phát'])===issueId); return {status:'success',rows,order};
}

function validateProduct_(p){const code=String(p.code||'').trim().toUpperCase(),name=String(p.name||'').trim(),unit=String(p.unit||'').trim(),group=String(p.group||'').trim(),cost=Number(p.cost||0),price=Number(p.price||0),minimum=Number(p.minimum||0);if(!code||!name||!unit||!group)throw new Error('Mã SP, tên, đơn vị và nhóm thuốc là bắt buộc.');if(![cost,price,minimum].every(Number.isFinite)||cost<0||price<0||minimum<0)throw new Error('Giá và tồn tối thiểu không hợp lệ.');return {code,name,activeIngredient:String(p.activeIngredient||'').trim(),unit,group,cost,price,minimum,status:String(p.status||'ACTIVE').toUpperCase()==='INACTIVE'?'INACTIVE':'ACTIVE',note:String(p.note||'').trim()};}
function parseDate_(v){if(v instanceof Date&&!isNaN(v))return v;if(v===null||v===undefined||v==='')return null;const s=String(v).trim(),m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]||0),Number(m[5]||0));const d=new Date(s);return isNaN(d)?null:d;}
function makeId_(prefix){return prefix+'-'+Utilities.formatDate(now_(),tz_(),'yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,6).toUpperCase();}

function getProducts_(){return rows_(SHEETS.PRODUCTS.name).map(r=>({code:String(r['Mã SP']||''),name:String(r['Tên sản phẩm']||''),activeIngredient:String(r['Hoạt chất']||''),unit:String(r['Đơn vị']||''),group:String(r['Nhóm thuốc']||''),cost:Number(r['Giá nhập'])||0,price:Number(r['Giá xuất'])||0,minimum:Number(r['Tồn tối thiểu'])||0,status:String(r['Trạng thái']||'ACTIVE'),note:String(r['Ghi chú']||'')}));}
function getStock_(){const products=getProducts_(),imports=rows_(SHEETS.IMPORTS.name),map={};imports.forEach(r=>{const c=String(r['Mã SP']||'').trim();if(!c)return;if(!map[c])map[c]={quantity:0,batches:0};map[c].quantity+=Number(r['Số lượng còn'])||0;map[c].batches++;});return products.map(p=>{const s=map[p.code]||{quantity:0,batches:0};return {...p,quantity:s.quantity,batches:s.batches};});}
function getExports_(){return rows_(SHEETS.EXPORTS.name).map(r=>({...r,['Trạng thái']:String(r['Trạng thái']||'LOCKED')}));}
function getDashboard_(){const products=getProducts_(),imports=rows_(SHEETS.IMPORTS.name),exports=getExports_(),stockMap={};let total=0,value=0,low=0,expired=0,soon=0;imports.forEach(r=>{const c=String(r['Mã SP']||'').trim(),q=Number(r['Số lượng còn'])||0,p=Number(r['Đơn giá'])||0;if(!c)return;stockMap[c]=(stockMap[c]||0)+q;total+=q;value+=q*p;const e=parseDate_(r['Hạn sử dụng']);if(q>0&&e){const days=(e-Date.now())/86400000;if(days<0)expired++;else if(days<=30)soon++;}});products.forEach(p=>{if(p.minimum>0&&(stockMap[p.code]||0)<=p.minimum)low++;});const key=Utilities.formatDate(now_(),tz_(),'yyyy-MM-dd'),today=exports.filter(r=>{const d=parseDate_(r['Thời gian']);return d&&Utilities.formatDate(d,tz_(),'yyyy-MM-dd')===key;});return {products:products.length,totalStock:total,stockValue:value,todayOrders:today.length,todayExportQty:today.reduce((s,r)=>s+(Number(r['Tổng số lượng'])||0),0),lowStock:low,expired,expiringSoon:soon,recentActivities:exports.slice(-10).reverse()};}
function getReport_(p){const exports=getExports_(),products=getProducts_(),month=String(p.month||Utilities.formatDate(now_(),tz_(),'yyyy-MM')),dept=String(p.department||'').trim(),code=String(p.code||'').trim(),start=new Date(month+'-01T00:00:00'),end=new Date(start);end.setMonth(end.getMonth()+1);const rows=exports.filter(r=>{const d=parseDate_(r['Thời gian']);return d&&d>=start&&d<end&&(!dept||String(r['Bộ phận']).trim()===dept)&&(!code||String(r['Mã SP']).trim()===code);}),bd={},bp={};rows.forEach(r=>{const d=String(r['Bộ phận']||'Không xác định'),c=String(r['Mã SP']||''),q=Number(r['Tổng số lượng'])||0;bd[d]=(bd[d]||0)+q;bp[c]=(bp[c]||0)+q;});const names={};products.forEach(p=>names[p.code]=p.name);return {month,department:dept,product:code,orders:rows.length,quantity:rows.reduce((s,r)=>s+(Number(r['Tổng số lượng'])||0),0),departments:Object.keys(bd).sort().map(k=>({department:k,quantity:bd[k]})),products:Object.keys(bp).sort((a,b)=>bp[b]-bp[a]).map(k=>({code:k,name:names[k]||k,quantity:bp[k]})),rows:rows.slice().reverse()};}

function rows_(sheetName){const sh=ss_().getSheetByName(sheetName);if(!sh||sh.getLastRow()<2)return [];const data=sh.getDataRange().getValues(),headers=data[0].map(x=>String(x).trim());return data.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{const o={};headers.forEach((h,i)=>o[h]=serialize_(r[i]));return o;});}
function serialize_(v){return v instanceof Date?Utilities.formatDate(v,tz_(),'yyyy-MM-dd HH:mm:ss'):v;}
function headerMap_(sh){const a=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],m={};a.forEach((h,i)=>{if(String(h).trim())m[String(h).trim()]=i+1;});return m;}
function audit_(actor,action,id,code,qty,performer,note){const sh=ss_().getSheetByName(SHEETS.AUDIT.name);sh.appendRow([now_(),action,id,code,qty,performer,note,'']);}
function requireAuth_(token){if(!token)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');const raw=CacheService.getScriptCache().get('SESSION_'+token);if(!raw)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');return JSON.parse(raw);}
function requireRole_(token,roles){const u=requireAuth_(token);if(roles.indexOf(u.role)<0)throw new Error('Bạn không có quyền thực hiện thao tác này.');return u;}
function formatDateTime_(d){return d?Utilities.formatDate(d,tz_(),'dd/MM/yyyy HH:mm'):'';}
