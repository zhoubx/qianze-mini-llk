const { cloud, query } = require('./common/db')

/**
 * 获取用户奖品列表（合并查询）
 * 解决小程序端 20 条限制问题
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

  const MAX_LIMIT = 1000

  try {
    const [gameRows, shareRows] = await Promise.all([
      query(
        `SELECT
           id, openid, score, time_cost, difficulty,
           prize_name, prize_level, rank_snapshot,
           status, redeemed_time, created_at
         FROM game_score
         WHERE openid = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [openid, MAX_LIMIT]
      ),
      query(
        `SELECT
           id, sharer_openid, invitee_openid,
           amount, status, redeemed_time, created_at
         FROM share_coupons
         WHERE sharer_openid = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [openid, MAX_LIMIT]
      )
    ])

    const gamePrizes = gameRows.map((r) => ({
      _id: String(r.id),
      _openid: r.openid,
      score: r.score,
      timeCost: r.time_cost,
      difficulty: r.difficulty,
      prizeName: r.prize_name,
      prizeLevel: r.prize_level,
      rankSnapshot: r.rank_snapshot,
      status: r.status,
      redeemedTime: r.redeemed_time,
      createdAt: r.created_at
    }))

    const shareCoupons = shareRows.map((r) => ({
      _id: String(r.id),
      sharerOpenid: r.sharer_openid,
      inviteeOpenid: r.invitee_openid,
      amount: r.amount,
      status: r.status,
      redeemedTime: r.redeemed_time,
      createdAt: r.created_at
    }))

    return {
      success: true,
      gamePrizes,
      shareCoupons
    }
  } catch (err) {
    console.error('云函数 getUserPrizes 错误:', err)
    return {
      success: false,
      error: err.message || err
    }
  }
}
