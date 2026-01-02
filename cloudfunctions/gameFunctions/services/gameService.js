const { cloud, query, transaction } = require('../common/mysqlAndWxCloud')

const CONFIG = {
  INVALID_LEVEL: 999,
  SHARE_COUPON: { AMOUNT: 5, MAX_COUNT: 5 }
}

exports.submitGameScore = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { success: false, msg: 'openid is missing' }

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
  } = event || {}

  const normalizedPrizeLevel = prizeLevel ?? CONFIG.INVALID_LEVEL
  const normalizedRankSnapshot = rankSnapshot ?? 0
  const s = score ?? 0
  const t = timeCost ?? 0

  try {
    const result = await transaction(async (connection) => {
      const [oldRows] = await connection.query(
        'SELECT id, prize_level, score FROM game_score WHERE openid = ? AND status = ? FOR UPDATE',
        [openid, 'pending']
      )
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
        score: s
      })
      candidates.sort((a, b) => {
        if (a.prizeLevel !== b.prizeLevel) return a.prizeLevel - b.prizeLevel
        return b.score - a.score
      })
      const best = candidates[0]
      const finalStatus = best.type === 'new' ? 'pending' : 'expired'

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

      await connection.query(
        'INSERT INTO game_score (openid, score, time_cost, difficulty, prize_name, prize_level, rank_snapshot, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          openid,
          s,
          t,
          difficulty ?? null,
          prizeName ?? null,
          normalizedPrizeLevel,
          normalizedRankSnapshot,
          finalStatus,
          new Date()
        ]
      )

      await saveUserInfoInternal(connection, openid, nickName, avatarUrl, s)
      await checkAndGrantShareCouponInternal(connection, inviteFrom, openid)

      return {
        success: true,
        status: finalStatus,
        pkResult: finalStatus === 'pending' ? 'win' : 'lose'
      }
    })
    return result
  } catch (err) {
    return { success: false, error: err.message || err }
  }
}

exports.getLeaderboard = async ({ limit = 50, timeLimit = 72, isAllTime = false }) => {
  const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200)
  const since = new Date(Date.now() - Number(timeLimit || 72) * 3600 * 1000)
  const whereSql = isAllTime ? '' : 'WHERE g.created_at >= ?'
  const params = isAllTime ? [safeLimit] : [since, safeLimit]

  const rows = await query(
    `WITH ranked AS (
       SELECT
         g.id, g.openid, g.score, g.time_cost, g.difficulty, g.created_at,
         g.prize_name, g.prize_level,
         ROW_NUMBER() OVER (
           PARTITION BY g.openid
           ORDER BY g.score DESC, g.prize_level ASC, g.created_at ASC, g.id ASC
         ) AS rn
       FROM game_score g
       ${whereSql}
     )
     SELECT
       r.openid AS _id,
       r.score AS score,
       r.time_cost AS timeCost,
       r.difficulty AS difficulty,
       r.created_at AS createdAt,
       r.prize_name AS prizeName,
       r.prize_level AS prizeLevel,
       r.openid AS _openid,
       u.nick_name AS nickName,
       u.avatar_url AS avatarUrl
     FROM ranked r
     LEFT JOIN user_info u ON r.openid = u.openid
     WHERE r.rn = 1
     ORDER BY r.score DESC, r.prize_level ASC, r.created_at ASC
     LIMIT ?`,
    params
  )

  return rows.map(r => ({
    _id: r._id,
    _openid: r._openid,
    score: r.score,
    timeCost: r.timeCost,
    difficulty: r.difficulty,
    createdAt: r.createdAt,
    prizeName: r.prizeName,
    prizeLevel: r.prizeLevel,
    nickName: r.nickName,
    avatarUrl: r.avatarUrl
  }))
}

async function saveUserInfoInternal(connection, openid, nickName, avatarUrl, currentScore) {
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
}

async function checkAndGrantShareCouponInternal(connection, inviteFrom, currentOpenid) {
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
}
