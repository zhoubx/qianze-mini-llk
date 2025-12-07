const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
    // 并行查询游戏奖品和分享代金券
    const [gameRes, shareRes] = await Promise.all([
      // 1. 查询游戏奖品
      db.collection('GameScore')
        .where({ _openid: openid })
        .orderBy('createdAt', 'desc')
        .limit(MAX_LIMIT)
        .get(),
      
      // 2. 查询分享代金券
      db.collection('ShareCoupons')
        .where({ sharerOpenid: openid })
        .orderBy('createdAt', 'desc')
        .limit(MAX_LIMIT)
        .get()
    ])

    return {
      success: true,
      gamePrizes: gameRes.data,
      shareCoupons: shareRes.data
    }

  } catch (err) {
    console.error('云函数 getUserPrizes 错误:', err)
    return {
      success: false,
      error: err
    }
  }
}

