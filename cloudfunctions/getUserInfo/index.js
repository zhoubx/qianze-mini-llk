const { query, cloud } = require('./common/db')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
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

    return {
      success: true,
      data: rows.length > 0 ? rows[0] : null
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return {
      success: false,
      error: err.message || err
    }
  }
}
