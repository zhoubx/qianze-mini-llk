// const cloud = require('wx-server-sdk')
const { cloud, query } = require('./common/mysqlDBPool/db')
// const { cloud, ...query } = require('common')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 获取排行榜数据（聚合查询版）
 * 1. 支持按 openid 去重
 * 2. 支持按最高分排序
 * 3. 解决小程序端 20 条限制
 */
exports.main = async (event, context) => {
  const { limit = 50, timeLimit = 72, isAllTime = false } = event

  try {
    const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200)
    const since = new Date(Date.now() - Number(timeLimit || 72) * 3600 * 1000)

    const whereSql = isAllTime ? '' : 'WHERE g.created_at >= ?'
    const params = isAllTime ? [safeLimit] : [since, safeLimit]

    const rows = await query(
      `WITH ranked AS (
         SELECT
           g.id,
           g.openid,
           g.score,
           g.time_cost,
           g.difficulty,
           g.created_at,
           g.prize_name,
           g.prize_level,
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
         r.openid AS _openid,
         u.nick_name AS nickName,
         u.avatar_url AS avatarUrl
       FROM ranked r
       LEFT JOIN user_info u ON u.openid = r.openid
       WHERE r.rn = 1
       ORDER BY r.score DESC
       LIMIT ?`,
      params
    )

    return {
      success: true,
      data: rows
    }
  } catch (err) {
    console.error('获取排行榜失败', err)
    return {
      success: false,
      error: err.message || err
    }
  }
}
