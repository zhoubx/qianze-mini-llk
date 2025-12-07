const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

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
    inviteFrom,
    isSinglePage
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
    // ==================== 核心逻辑：成绩 PK ====================
    
    // 获取该用户所有 pending 状态的旧记录
    // limit(1000) 确保能获取到所有积压的记录（解决前端 20 条限制导致的 Bug）
    const oldRecordsRes = await db.collection('GameScore')
      .where({
        _openid: openid,
        status: 'pending'
      })
      .limit(1000)
      .get()
    
    const oldRecords = oldRecordsRes.data
    
    // 将当前记录临时加入集合进行比较
    // 给当前记录一个特殊 ID 方便识别
    const currentRecordWithId = { ...currentRecord, _id: 'CURRENT_NEW' }
    const allRecords = [...oldRecords, currentRecordWithId]
    
    // 排序找出最优记录
    // 规则：Level 越小越好；Level 相同，Score 越大越好
    allRecords.sort((a, b) => {
      if (a.prizeLevel !== b.prizeLevel) {
        return a.prizeLevel - b.prizeLevel // 升序
      }
      return b.score - a.score // 降序
    })
    
    // 最优记录
    const bestRecord = allRecords[0]
    
    // 决定当前记录最终状态
    let finalStatus = 'pending'
    if (bestRecord._id !== 'CURRENT_NEW') {
      // 如果最优的不是当前这条，说明当前这条 PK 输了
      finalStatus = 'expired'
    }
    
    // 决定哪些旧记录需要过期
    // 所有不是 bestRecord 的记录都应该 expired
    // 如果 bestRecord 是 oldRecords 里的某一条，那它保留 pending，其他 oldRecords expired
    // 如果 bestRecord 是 CURRENT_NEW，那所有 oldRecords expired
    const idsToExpire = []
    for (const record of oldRecords) {
      if (record._id !== bestRecord._id) {
        idsToExpire.push(record._id)
      }
    }
    
    // 批量更新过期的旧记录
    if (idsToExpire.length > 0) {
      // 分批处理，虽然一般不会超过 1000 条，但为了稳健
      // where _id in [...]
      await db.collection('GameScore').where({
        _id: _.in(idsToExpire)
      }).update({
        data: {
          status: 'expired'
        }
      })
    }
    
    // 保存当前新记录
    // 注意：入库时使用 db.serverDate()
    const dataToSave = {
      ...currentRecord,
      status: finalStatus,
      createdAt: db.serverDate()
    }
    
    await db.collection('GameScore').add({
      data: dataToSave
    })

    // ==================== 逻辑 2：保存用户信息 ====================
    await saveUserInfoInternal(openid, nickName, avatarUrl, score)
    
    // ==================== 逻辑 3：分享奖励检查 ====================
    await checkAndGrantShareCouponInternal(db, inviteFrom, openid)

    return {
      success: true,
      status: finalStatus,
      pkResult: finalStatus === 'pending' ? 'win' : 'lose'
    }

  } catch (err) {
    console.error('云函数 submitGameScore 错误:', err)
    return {
      success: false,
      error: err
    }
  }
}

// 内部函数：保存用户信息
async function saveUserInfoInternal(openid, nickName, avatarUrl, currentScore) {
  try {
    const res = await db.collection('UserInfo').where({ _openid: openid }).get()
    
    if (res.data.length > 0) {
      const record = res.data[0]
      const updateData = {
        nickName,
        avatarUrl,
        updatedAt: db.serverDate()
      }
      
      // 更新最高分
      if (record.bestScore === undefined || record.bestScore === null || currentScore > record.bestScore) {
        updateData.bestScore = currentScore
      }
      
      await db.collection('UserInfo').doc(record._id).update({
        data: updateData
      })
    } else {
      await db.collection('UserInfo').add({
        data: {
          _openid: openid, // 显式指定
          nickName,
          avatarUrl,
          bestScore: currentScore,
          createdAt: db.serverDate()
        }
      })
    }
  } catch (e) {
    console.error('保存用户信息失败:', e)
    // 不阻断主流程
  }
}

// 内部函数：检查并发放分享奖励
async function checkAndGrantShareCouponInternal(db, inviteFrom, currentOpenid) {
  try {
    // 基本校验
    if (!inviteFrom || !currentOpenid || inviteFrom === currentOpenid) return

    // 1. 检查是否已存在分享记录
    const shareRecordRes = await db.collection('ShareRecords').where({
      sharerOpenid: inviteFrom,
      inviteeOpenid: currentOpenid
    }).get()
    
    if (shareRecordRes.data.length > 0) return

    // 2. 检查当前用户是否为新用户
    // 由于我们刚刚插入了一条 GameScore 记录，所以如果用户是全新的，
    // GameScore 表里应该只有刚刚插入的那 1 条记录。
    const userScoresCount = await db.collection('GameScore')
      .where({ _openid: currentOpenid })
      .count()
      
    // 如果 > 1 说明以前玩过
    if (userScoresCount.total > 1) return

    // 3. 检查分享人是否达到奖励上限
    const sharerCouponsCount = await db.collection('ShareCoupons')
      .where({ sharerOpenid: inviteFrom })
      .count()
      
    if (sharerCouponsCount.total >= CONFIG.SHARE_COUPON.MAX_COUNT) return

    // 4. 发放奖励
    // 创建分享记录
    await db.collection('ShareRecords').add({
      data: {
        sharerOpenid: inviteFrom,
        inviteeOpenid: currentOpenid,
        createdAt: db.serverDate()
      }
    })
    
    // 创建代金券
    await db.collection('ShareCoupons').add({
      data: {
        sharerOpenid: inviteFrom,
        amount: CONFIG.SHARE_COUPON.AMOUNT,
        status: 'pending',
        inviteeOpenid: currentOpenid,
        createdAt: db.serverDate()
      }
    })
    
  } catch (e) {
    console.error('分享奖励处理失败:', e)
    // 不阻断主流程
  }
}

