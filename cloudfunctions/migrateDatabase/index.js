
const cloud = require('wx-server-sdk');
const mysql = require('mysql2/promise');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// MySQL 配置
const mysqlConfig = {
  host: '10.16.111.106', 
  port: 3306,
  user: 'qianze',
  password: '112358fbnq!',
  database: 'cloud1-3g1qbw94a0df5dad',
  dateStrings: true 
};

// ==========================================
// 辅助函数：精确处理空值
// ==========================================
// 如果字段是 undefined 或 null，返回 null；否则返回原值
const exact = (value) => (value === undefined || value === null) ? null : value;

// ==========================================
// 字段映射定义 (Strict Mode)
// ==========================================

// 1. UserInfo 映射
const mapUserInfo = (item) => {
  return [
    item._openid,              // [必填] OpenID 必须存在
    exact(item.nickName),      // 原值或 NULL (去掉默认空字符串)
    exact(item.avatarUrl),     // 原值或 NULL
    exact(item.bestScore),     // 原值或 NULL (去掉默认0，MySQL中若定义为DEFAULT 0，插入NULL会变NULL)
    item.createTime ? new Date(item.createTime) : new Date() // 创建时间通常不能为NULL，若无则取当前
  ];
};

// 2. GameScore 映射
const mapGameScore = (item) => {
  // 注意：score 和 time_cost 在建表时通常是 NOT NULL，如果Mongo里真的是空，这里传 null 会报错。
  // 为了安全，这几个核心数值字段建议保留 ?? 0，或者确认你Mongo里这几个字段绝对有值。
  
  return [
    item._openid,              // [必填]
    item.score ?? 0,           // [必填] 分数不能为 NULL，兜底为 0
    item.timeCost ?? 0,        // [必填] 耗时不能为 NULL，兜底为 0
    exact(item.difficulty),    // 原值或 NULL (去掉了 'easy')
    exact(item.prizeName),     // 原值或 NULL
    exact(item.prizeLevel),    // 原值或 NULL (去掉了 999)
    0,                         // rank_snapshot 默认填0
    exact(item.status),        // 原值或 NULL (去掉了 'pending')
    item.createTime ? new Date(item.createTime) : new Date()
  ];
};

// 3. ShareCoupons 映射
const mapShareCoupons = (item) => {
  return [
    item._openid,               // [必填]
    exact(item.inviteeOpenid),  // 原值或 NULL
    exact(item.amount),         // 原值或 NULL (去掉了 5.00)
    exact(item.status),         // 原值或 NULL
    item.redeemedTime ? new Date(item.redeemedTime) : null, // 只有有值时才转时间
    item.createTime ? new Date(item.createTime) : new Date()
  ];
};

// 4. ShareRecords 映射
const mapShareRecords = (item) => {
  return [
    item.sharerOpenid || item._openid, // [必填]
    exact(item.inviteeOpenid),         // 原值或 NULL
    item.createTime ? new Date(item.createTime) : new Date()
  ];
};

// ==========================================
// 主函数
// ==========================================
exports.main = async (event, context) => {
  const connection = await mysql.createConnection(mysqlConfig);
  const report = { users: 0, scores: 0, coupons: 0, records: 0 };

  try {
    // 1. UserInfo
    const usersData = await db.collection('UserInfo').limit(1000).get();
    if (usersData.data.length > 0) {
      // 这里的 SQL 必须匹配 mapUserInfo 返回的字段数量和顺序
      const sql = `INSERT IGNORE INTO user_info (openid, nick_name, avatar_url, best_score, created_at) VALUES ?`;
      const [res] = await connection.query(sql, [usersData.data.map(mapUserInfo)]);
      report.users = res.affectedRows;
      console.log(`成功迁移UserInfo: ${report.users} 条`);
    }

    // 2. GameScore
    const scoresData = await db.collection('GameScore').limit(1000).get();
    if (scoresData.data.length > 0) {
      const sql = `INSERT INTO game_score (openid, score, time_cost, difficulty, prize_name, prize_level, rank_snapshot, status, created_at) VALUES ?`;
      const [res] = await connection.query(sql, [scoresData.data.map(mapGameScore)]);
      report.scores = res.affectedRows;
      console.log(`成功迁移GameScore: ${report.scores} 条`);
    }

    // 3. ShareCoupons
    try {
      const couponsData = await db.collection('ShareCoupons').limit(1000).get();
      if (couponsData.data.length > 0) {
        const sql = `INSERT INTO share_coupons (sharer_openid, invitee_openid, amount, status, redeemed_time, created_at) VALUES ?`;
        const [res] = await connection.query(sql, [couponsData.data.map(mapShareCoupons)]);
        report.coupons = res.affectedRows;
        console.log(`成功迁移ShareCoupons: ${report.coupons} 条`);
      }
    } catch (e) {}

    // 4. ShareRecords
    try {
      const recordsData = await db.collection('ShareRecords').limit(1000).get();
      if (recordsData.data.length > 0) {
        const sql = `INSERT IGNORE INTO share_records (sharer_openid, invitee_openid, created_at) VALUES ?`;
        const [res] = await connection.query(sql, [recordsData.data.map(mapShareRecords)]);
        report.records = res.affectedRows;
        console.log(`成功迁移ShareRecords: ${report.records} 条`);
      }
    } catch (e) {}

    return { success: true, report };

  } catch (err) {
    console.error('Migration Error:', err);
    return { success: false, error: err.message };
  } finally {
    if (connection) await connection.end();
  }
};
