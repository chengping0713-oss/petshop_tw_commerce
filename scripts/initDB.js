require('dotenv').config();
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/pawpick.db';
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('🐾 初始化 PawPick 資料庫...');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    phone TEXT, address TEXT, points INTEGER DEFAULT 0, role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, brand TEXT NOT NULL, category_id INTEGER,
    description TEXT, ingredients TEXT, price INTEGER NOT NULL,
    original_price INTEGER, stock INTEGER DEFAULT 0, image TEXT,
    status TEXT DEFAULT 'active', pet_type TEXT DEFAULT 'both',
    sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL, member_id INTEGER,
    total INTEGER NOT NULL, shipping_fee INTEGER DEFAULT 0, discount INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', payment_method TEXT DEFAULT 'credit_card',
    payment_status TEXT DEFAULT 'unpaid',
    name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
    coupon_code TEXT, note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL, price INTEGER NOT NULL, quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL,
    min_amount INTEGER DEFAULT 0, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0,
    start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL, position TEXT DEFAULT 'topbar',
    start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, product_id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// 管理員
const adminPw = bcrypt.hashSync('admin1234', 10);
db.prepare('INSERT OR IGNORE INTO members (name,email,password,role) VALUES (?,?,?,?)').run('管理員','admin@pawpick.tw',adminPw,'admin');

// 測試會員
const userPw = bcrypt.hashSync('user1234', 10);
[['王小明','wang@example.com'],['李美花','li@example.com'],['陳志偉','chen@example.com']].forEach(([n,e]) => {
  db.prepare('INSERT OR IGNORE INTO members (name,email,password) VALUES (?,?,?)').run(n,e,userPw);
});

// 分類
[['腸胃保健','digestive','🫶',1],['關節守護','joint','🦴',2],['皮毛養護','skin','✨',3],['免疫保健','immune','🛡️',4],['零食點心','snack','🥩',5],['禮盒組合','gift','🎁',6]].forEach(([n,s,i,o]) => {
  db.prepare('INSERT OR IGNORE INTO categories (name,slug,icon,sort_order) VALUES (?,?,?,?)').run(n,s,i,o);
});

// 商品
[
  ['DR.ZOO 樂活腸胃 (狗狗專用)','DR.ZOO',1,'專利芽孢乳酸菌・水解蛋白調配・挑嘴狗難抵擋',680,850,245,'dog'],
  ['DR.ZOO 皮毛養護 (犬貓通用)','DR.ZOO',3,'水解蛋白打底・敏感體質專用',720,900,128,'both'],
  ['DR.ZOO 關節守護 (狗狗專用)','DR.ZOO',2,'Calcium+拮抗鈣・雙效配方',880,1100,63,'dog'],
  ['DR.ZOO 免疫保健 (貓咪專用)','DR.ZOO',4,'水解蛋白打底・貓咪專屬配方',720,900,89,'cat'],
  ['寶貝餌子 台灣鮮肉零食組合','寶貝餌子',5,'台灣肉品新鮮製作・無添加',450,560,320,'both'],
  ['DR.ZOO 舒Fun排毛 (貓咪專用)','DR.ZOO',1,'玉米仁多酚・幫助毛球排出',680,850,0,'cat'],
  ['DR.ZOO 泌尿呵護 (貓咪專用)','DR.ZOO',4,'蔓越莓萃取・維護泌尿健康',760,950,44,'cat'],
  ['PawPick 綜合保健禮盒組','PawPick',6,'多種保健一次入手・超值划算',1280,1600,15,'both'],
].forEach(([n,b,c,d,p,o,s,pt]) => {
  db.prepare('INSERT OR IGNORE INTO products (name,brand,category_id,description,price,original_price,stock,pet_type) VALUES (?,?,?,?,?,?,?,?)').run(n,b,c,d,p,o,s,pt);
});

// 優惠券
[['WELCOME85','percent',15,0,0,'2025-12-31'],['FREESHIP','freeship',0,500,100,'2025-06-30'],['SAVE100','fixed',100,800,50,'2025-04-30']].forEach(([c,t,v,m,mx,e]) => {
  db.prepare('INSERT OR IGNORE INTO coupons (code,type,value,min_amount,max_uses,end_date) VALUES (?,?,?,?,?,?)').run(c,t,v,m,mx,e);
});

// 公告
[['🚚 全館滿 NT$ 1,200 免運費！','topbar','2025-12-31'],['🎉 新會員專屬 85 折！','topbar','2025-06-30'],['🐾 DR.ZOO × 柴語錄 聯名新品！','banner','2025-04-30']].forEach(([c,p,e]) => {
  db.prepare('INSERT OR IGNORE INTO announcements (content,position,end_date) VALUES (?,?,?)').run(c,p,e);
});

db.close();
console.log('✅ 資料庫初始化完成！');
console.log('');
console.log('📧 管理員: admin@pawpick.tw / admin1234');
console.log('📧 測試會員: wang@example.com / user1234');
