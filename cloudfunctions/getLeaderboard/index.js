const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

/**
 * 获取排行榜数据（聚合查询版）
 * 1. 支持按 openid 去重
 * 2. 支持按最高分排序
 * 3. 解决小程序端 20 条限制
 */
exports.main = async (event, context) => {
  const { limit = 50, timeLimit = 72, isAllTime = false } = event

  try {
    // 构建聚合管道
    let pipeline = db.collection('GameScore').aggregate()

    // 1. 时间筛选 (如果 isAllTime 为 false，则启用时间筛选)
    if (!isAllTime) {
      let date = new Date()
      date.setHours(date.getHours() - timeLimit)
      pipeline = pipeline.match({
        createdAt: _.gte(date)
      })
    }

    // 2. 预排序：先按分数倒序，确保分组时 $first 取到的是该用户最高分那条
    pipeline = pipeline.sort({
      score: -1
    })

    // 3. 分组去重
    pipeline = pipeline.group({
      _id: '$_openid', // 按 openid 分组
      score: { $first: '$score' },      // 取最高分
      timeCost: { $first: '$timeCost' }, // 取对应的时间
      difficulty: { $first: '$difficulty' }, // 难度
      createdAt: { $first: '$createdAt' }, // 上榜时间
      prizeName: { $first: '$prizeName' }, // 奖品名称
      // 如果需要用户信息（假设 GameScore 里冗余存了），也可以在这里取
      // 但通常用户信息在 UserInfo 表，后面需要联表查询或在前端合并
      _openid: { $first: '$_openid' } // 保留 openid 用于后续查询用户信息
    })

    // 4. 最终排序：按最高分倒序
    pipeline = pipeline.sort({
      score: -1
    })

    // 5. 限制返回数量
    pipeline = pipeline.limit(limit)

    // 6. 联表查询 UserInfo 获取头像昵称
    pipeline = pipeline.lookup({
      from: 'UserInfo',
      localField: '_openid',
      foreignField: '_openid',
      as: 'userInfo'
    })

    // 7. 展开用户信息并保留未匹配的记录
    pipeline = pipeline.unwind({
      path: '$userInfo',
      preserveNullAndEmptyArrays: true
    })

    // 8. 整理输出字段
    pipeline = pipeline.project({
      _id: 1,
      score: 1,
      timeCost: 1,
      difficulty: 1,
      createdAt: 1,
      prizeName: 1,
      _openid: 1,
      nickName: '$userInfo.nickName',
      avatarUrl: '$userInfo.avatarUrl'
    })

    // 执行查询
    const result = await pipeline.end()

    return {
      success: true,
      data: result.list
    }

  } catch (err) {
    console.error('获取排行榜失败', err)
    return {
      success: false,
      error: err
    }
  }
}
