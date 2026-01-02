const { cloud, ...db } = require('./common/db')

// cloud.init 在 common/db.js 加载配置时会自动调用，
// 但如果在 db 操作之前就要用 cloud (比如 getWXContext)，保险起见 common 应该已经保证了 init。
// 或者我们在这里显式 init 也无妨，cloud.init 是幂等的。
// 为了简化，我们直接使用 common 导出的 cloud 实例。

// 常量配置
const CONFIG = {
  INVALID_LEVEL: 999,
  SHARE_COUPON: {
    AMOUNT: 5,
    MAX_COUNT: 5
  }
}

/**
 * 提交游戏成绩云函数
 * 功能：
 * 1. 接收游戏成绩和用户信息
 * 2. 与历史成绩PK，保留最优成绩，其他设为expired
 * 3. 保存/更新用户信息
 * 4. 处理分享奖励逻辑
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return {
      success: false,
      msg: 'openid is missing'
    }
  }

  const {
    score,
    timeCost,
    difficulty,
    prizeName,
    prizeLevel,
    rankSnapshot,
    nickName,
    avatarUrl,
    inviteFrom
  } = event

  // 1. 准备当前记录数据
  const currentRecord = {
    _openid: openid,
    score,
    timeCost,
    difficulty,
    prizeName,
    prizeLevel,
    rankSnapshot,
    status: 'pending', // 初始状态，后续PK决定
    createdAt: new Date() // 使用 Date 对象便于比较，最后由 db.add 处理
  }

  try {
    const result = await db.transaction(async (connection) => {
      const normalizedPrizeLevel = prizeLevel ?? CONFIG.INVALID_LEVEL
      const normalizedRankSnapshot = rankSnapshot ?? 0

      // 加锁查询当前用户的 pending 记录
      const [oldRows] = await connection.query(
        'SELECT id, prize_level, score FROM game_score WHERE openid = ? AND status = ? FOR UPDATE',
        [openid, 'pending']
      )

      // 构建候选列表进行 PK
      const candidates = oldRows.map((r) => ({
        type: 'old',
        id: r.id,
        prizeLevel: r.prize_level ?? CONFIG.INVALID_LEVEL,
        score: r.score ?? 0
      }))

      candidates.push({
        type: 'new',
        id: null,
        prizeLevel: normalizedPrizeLevel,
        score: score ?? 0
      })

      // 排序：奖品等级优先（小的更好），分数其次（大的更好）
      candidates.sort((a, b) => {
        if (a.prizeLevel !== b.prizeLevel) return a.prizeLevel - b.prizeLevel
        return b.score - a.score
      })

      const best = candidates[0]
      const finalStatus = best.type === 'new' ? 'pending' : 'expired'

      // 将非最优的旧记录设为 expired
      if (oldRows.length > 0) {
        if (best.type === 'old') {
          await connection.query(
            'UPDATE game_score SET status = ? WHERE openid = ? AND status = ? AND id <> ?',
            ['expired', openid, 'pending', best.id]
          )
        } else {
          await connection.query(
            'UPDATE game_score SET status = ? WHERE openid = ? AND status = ?',
            ['expired', openid, 'pending']
          )
        }
      }

      // 插入新记录
      await connection.query(
        'INSERT INTO game_score (openid, score, time_cost, difficulty, prize_name, prize_level, rank_snapshot, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          openid,
          score ?? 0,
          timeCost ?? 0,
          difficulty ?? null,
          prizeName ?? null,
          normalizedPrizeLevel,
          normalizedRankSnapshot,
          finalStatus,
          new Date()
        ]
      )

      // 保存用户信息
      await saveUserInfoInternal(connection, openid, nickName, avatarUrl, score ?? 0)

      // 处理分享奖励
      await checkAndGrantShareCouponInternal(connection, inviteFrom, openid)

      return {
        success: true,
        status: finalStatus,
        pkResult: finalStatus === 'pending' ? 'win' : 'lose'
      }
    })

    return result
  } catch (err) {
    console.error('云函数 submitGameScore 错误:', err)
    return {
      success: false,
      error: err.message || err
    }
  }
}

// 内部函数：保存用户信息
async function saveUserInfoInternal(connection, openid, nickName, avatarUrl, currentScore) {
  try {
    await connection.query(
      `INSERT INTO user_info (openid, nick_name, avatar_url, best_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nick_name = VALUES(nick_name),
         avatar_url = VALUES(avatar_url),
         best_score = GREATEST(COALESCE(best_score, 0), VALUES(best_score)),
         updated_at = VALUES(updated_at)`,
      [openid, nickName ?? null, avatarUrl ?? null, currentScore ?? 0, new Date(), new Date()]
    )
  } catch (e) {
    console.error('保存用户信息失败:', e)
  }
}

// 内部函数：检查并发放分享奖励
async function checkAndGrantShareCouponInternal(connection, inviteFrom, currentOpenid) {
  try {
    if (!inviteFrom || !currentOpenid || inviteFrom === currentOpenid) return

    const [existsRows] = await connection.query(
      'SELECT 1 FROM share_records WHERE sharer_openid = ? AND invitee_openid = ? LIMIT 1',
      [inviteFrom, currentOpenid]
    )

    if (existsRows.length > 0) return

    const [scoreCntRows] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM game_score WHERE openid = ?',
      [currentOpenid]
    )

    if ((scoreCntRows[0]?.cnt || 0) > 1) return

    const [couponCntRows] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM share_coupons WHERE sharer_openid = ?',
      [inviteFrom]
    )

    if ((couponCntRows[0]?.cnt || 0) >= CONFIG.SHARE_COUPON.MAX_COUNT) return

    await connection.query(
      'INSERT IGNORE INTO share_records (sharer_openid, invitee_openid, created_at) VALUES (?, ?, ?)',
      [inviteFrom, currentOpenid, new Date()]
    )

    await connection.query(
      'INSERT INTO share_coupons (sharer_openid, invitee_openid, amount, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [inviteFrom, currentOpenid, CONFIG.SHARE_COUPON.AMOUNT, 'pending', new Date()]
    )
  } catch (e) {
    console.error('分享奖励处理失败:', e)
  }
}
