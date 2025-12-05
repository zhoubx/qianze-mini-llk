
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  const { nickName, avatarUrl, bestScoreCandidate } = event

  if (!openid) {
    return { success: false, msg: 'openid is missing' }
  }

  try {
    // 先查找是否已存在记录
    const res = await db.collection('UserInfo')
      .where({ _openid: openid })
      .get()

    if (res.data.length > 0) {
      // 更新现有记录
      const record = res.data[0]
      const updateData = {
        nickName: nickName,
        avatarUrl: avatarUrl,
        updatedAt: db.serverDate()
      }

      // 比较并更新最高分
      if (bestScoreCandidate !== null && bestScoreCandidate !== undefined) {
        const serverBestScore = typeof record.bestScore === 'number' ? record.bestScore : null
        if (serverBestScore === null || bestScoreCandidate > serverBestScore) {
          updateData.bestScore = bestScoreCandidate
        }
      }

      await db.collection('UserInfo').doc(record._id).update({
        data: updateData
      })
      
      return { success: true, type: 'update' }
    } else {
      // 创建新记录 (云函数端新增数据需要系统自动注入_openid，或者显式指定)
      // 这里通过 add 操作，云数据库会自动将 _openid 字段设置为当前用户的 openid
      const newData = {
        _openid: openid, // 显式指定，确保万无一失
        nickName: nickName,
        avatarUrl: avatarUrl,
        createdAt: db.serverDate()
      }
      
      if (bestScoreCandidate !== null && bestScoreCandidate !== undefined) {
        newData.bestScore = bestScoreCandidate
      }
      
      await db.collection('UserInfo').add({ data: newData })
      
      return { success: true, type: 'create' }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}