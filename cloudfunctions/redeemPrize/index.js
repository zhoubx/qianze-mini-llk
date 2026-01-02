const { cloud, execute } = require('./common/db')

// 店员核销密码
const STAFF_PASSWORD = '999'

/**
 * 奖品核销云函数
 * @param {string} id - 奖品ID
 * @param {string} collection - 集合名称 ('GameScore' 或 'ShareCoupons')
 * @param {string} password - 核销密码
 */
exports.main = async (event, context) => {
  const { id, collection, password } = event

  // 1. 验证密码
  if (password !== STAFF_PASSWORD) {
    return {
      success: false,
      message: '核销密码错误'
    }
  }

  // 2. 验证集合名 (安全检查)
  if (!['GameScore', 'ShareCoupons'].includes(collection)) {
    return {
      success: false,
      message: '非法操作'
    }
  }

  try {
    const rowId = Number(id)
    if (!Number.isFinite(rowId)) {
      return { success: false, message: 'ID非法' }
    }

    const table = collection === 'GameScore' ? 'game_score' : 'share_coupons'

    const result = await execute(
      `UPDATE ${table} SET status = ?, redeemed_time = ? WHERE id = ?`,
      ['used', new Date(), rowId]
    )

    if ((result?.affectedRows || 0) === 0) {
      return { success: false, message: '记录不存在' }
    }

    return {
      success: true,
      message: '核销成功'
    }
  } catch (err) {
    console.error('核销失败:', err)
    return {
      success: false,
      message: '核销操作失败',
      error: err.message || err
    }
  }
}
