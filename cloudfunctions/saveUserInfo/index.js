const { cloud, query, execute } = require('./common/db')

/**
 * 保存用户信息云函数
 * 支持创建和更新用户信息
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { nickName, avatarUrl, bestScoreCandidate } = event

  if (!openid) {
    return { success: false, msg: 'openid is missing' }
  }

  try {
    // 查询是否已存在用户记录
    const rows = await query(
      'SELECT openid, best_score FROM user_info WHERE openid = ? LIMIT 1',
      [openid]
    )

    if (rows.length > 0) {
      // 更新现有记录
      const record = rows[0]
      const serverBestScore = typeof record.best_score === 'number' ? record.best_score : null

      // 计算新的最高分
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
      // 创建新记录
      await execute(
        `INSERT INTO user_info (openid, nick_name, avatar_url, best_score, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          openid,
          nickName ?? null,
          avatarUrl ?? null,
          bestScoreCandidate ?? null,
          new Date(),
          new Date()
        ]
      )

      return { success: true, type: 'create' }
    }
  } catch (err) {
    console.error('保存用户信息失败:', err)
    return { success: false, error: err.message || err }
  }
}
