const { query, execute } = require('../common/mysqlAndWxCloud')

exports.getUserInfo = async (openid) => {
  const rows = await query(
    `SELECT
       openid AS _openid,
       nick_name AS nickName,
       avatar_url AS avatarUrl,
       best_score AS bestScore,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM user_info
     WHERE openid = ?
     LIMIT 1`,
    [openid]
  )
  return rows.length > 0 ? rows[0] : null
}

exports.saveUserInfo = async (openid, { nickName, avatarUrl, bestScoreCandidate }) => {
  if (!openid) return { success: false, msg: 'openid is missing' }

  const rows = await query(
    'SELECT openid, best_score FROM user_info WHERE openid = ? LIMIT 1',
    [openid]
  )

  if (rows.length > 0) {
    const record = rows[0]
    const serverBestScore = typeof record.best_score === 'number' ? record.best_score : null
    let newBestScore = serverBestScore
    if (bestScoreCandidate !== null && bestScoreCandidate !== undefined) {
      if (serverBestScore === null || bestScoreCandidate > serverBestScore) {
        newBestScore = bestScoreCandidate
      }
    }
    await execute(
      `UPDATE user_info 
       SET nick_name = ?, avatar_url = ?, best_score = ?, updated_at = ?
       WHERE openid = ?`,
      [nickName ?? null, avatarUrl ?? null, newBestScore, new Date(), openid]
    )
    return { success: true, type: 'update' }
  } else {
    await execute(
      `INSERT INTO user_info (openid, nick_name, avatar_url, best_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [openid, nickName ?? null, avatarUrl ?? null, bestScoreCandidate ?? null, new Date(), new Date()]
    )
    return { success: true, type: 'create' }
  }
}
