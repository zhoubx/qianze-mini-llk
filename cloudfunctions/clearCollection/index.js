const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { collection } = event
  
  if (!collection) {
    return { success: false, message: '请指定集合名称' }
  }
  
  const res = await db.collection(collection).where({
    _id: db.command.exists(true)
  }).remove()
  
  return {
    success: true,
    removed: res.stats.removed,
    message: `成功删除 ${res.stats.removed} 条记录`
  }
}