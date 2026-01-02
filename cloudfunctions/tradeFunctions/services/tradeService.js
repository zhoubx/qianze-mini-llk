const { query, execute } = require('../common/mysqlAndWxCloud')

exports.getUserPrizes = async (openid) => {
  if (!openid) return { success: false, msg: 'openid is missing' }
  const MAX_LIMIT = 1000

  const [gameRows, shareRows] = await Promise.all([
    query(
      `SELECT id, openid, score, time_cost, difficulty,
              prize_name, prize_level, rank_snapshot, status, redeemed_time, created_at
       FROM game_score
       WHERE openid = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [openid, MAX_LIMIT]
    ),
    query(
      `SELECT id, sharer_openid, invitee_openid, amount, status, redeemed_time, created_at
       FROM share_coupons
       WHERE sharer_openid = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [openid, MAX_LIMIT]
    )
  ])

  return {
    success: true,
    gamePrizes: gameRows.map(r => ({
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
    })),
    shareCoupons: shareRows.map(r => ({
      _id: String(r.id),
      sharerOpenid: r.sharer_openid,
      inviteeOpenid: r.invitee_openid,
      amount: r.amount,
      status: r.status,
      redeemedTime: r.redeemed_time,
      createdAt: r.created_at
    }))
  }
}

exports.redeemPrize = async ({ id, collection, password }) => {
  const STAFF_PASSWORD = '999'
  if (password !== STAFF_PASSWORD) return { success: false, message: '核销密码错误' }
  if (!['GameScore', 'ShareCoupons'].includes(collection)) return { success: false, message: '非法操作' }
  const rowId = Number(id)
  if (!Number.isFinite(rowId)) return { success: false, message: 'ID非法' }
  const table = collection === 'GameScore' ? 'game_score' : 'share_coupons'

  const result = await execute(
    `UPDATE ${table} SET status = ?, redeemed_time = ? WHERE id = ?`,
    ['used', new Date(), rowId]
  )
  if ((result?.affectedRows || 0) === 0) return { success: false, message: '记录不存在' }
  return { success: true, message: '核销成功' }
}

exports.redeemShareCoupon = async ({ openid, couponId }) => {
  if (!couponId) return { success: false, message: '缺少代金券ID' }
  const id = Number(couponId)
  if (!Number.isFinite(id)) return { success: false, message: '代金券ID非法' }

  const rows = await query(
    'SELECT id, sharer_openid, status FROM share_coupons WHERE id = ? LIMIT 1',
    [id]
  )
  const coupon = rows[0]
  if (!coupon) return { success: false, message: '代金券不存在' }
  if (coupon.sharer_openid !== openid) return { success: false, message: '无权操作此代金券' }
  if (coupon.status !== 'pending') return { success: false, message: '代金券已被使用或已失效' }

  await execute(
    'UPDATE share_coupons SET status = ?, redeemed_time = ? WHERE id = ? AND status = ?',
    ['used', new Date(), id, 'pending']
  )
  return { success: true, message: '核销成功' }
}
