// 云函数入口文件 - 核销分享代金券
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { couponId } = event;

  if (!couponId) {
    return {
      success: false,
      message: '缺少代金券ID'
    };
  }

  try {
    // 1. 查询代金券，验证所有权
    const couponRes = await db.collection('ShareCoupons').doc(couponId).get();
    const coupon = couponRes.data;

    if (!coupon) {
      return {
        success: false,
        message: '代金券不存在'
      };
    }

    // 2. 验证当前用户是否是代金券所有者
    if (coupon.sharerOpenid !== openid) {
      return {
        success: false,
        message: '无权操作此代金券'
      };
    }

    // 3. 验证代金券状态
    if (coupon.status !== 'pending') {
      return {
        success: false,
        message: '代金券已被使用或已失效'
      };
    }

    // 4. 更新代金券状态为已使用
    await db.collection('ShareCoupons').doc(couponId).update({
      data: {
        status: 'used',
        redeemedTime: db.serverDate()
      }
    });

    return {
      success: true,
      message: '核销成功'
    };

  } catch (err) {
    console.error('核销代金券失败:', err);
    return {
      success: false,
      message: '核销失败: ' + err.message
    };
  }
};

