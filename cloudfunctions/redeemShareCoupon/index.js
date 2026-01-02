const { cloud, query, execute } = require('./common/db')

/**
 * 核销分享代金券云函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { couponId } = event

  if (!couponId) {
    return {
      success: false,
      message: '缺少代金券ID'
    }
  }

  try {
    const id = Number(couponId)
    if (!Number.isFinite(id)) {
      return { success: false, message: '代金券ID非法' }
    }

    const rows = await query(
      'SELECT id, sharer_openid, status FROM share_coupons WHERE id = ? LIMIT 1',
      [id]
    )

    const coupon = rows[0]

    if (!coupon) {
      return {
        success: false,
        message: '代金券不存在'
      }
    }

    if (coupon.sharer_openid !== openid) {
      return {
        success: false,
        message: '无权操作此代金券'
      }
    }

    if (coupon.status !== 'pending') {
      return {
        success: false,
        message: '代金券已被使用或已失效'
      }
    }

    await execute(
      'UPDATE share_coupons SET status = ?, redeemed_time = ? WHERE id = ? AND status = ?',
      ['used', new Date(), id, 'pending']
    )

    return {
      success: true,
      message: '核销成功'
    }
  } catch (err) {
    console.error('核销代金券失败:', err)
    return {
      success: false,
      message: '核销失败: ' + (err.message || err)
    }
  }
}
