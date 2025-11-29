// 日期格式化工具函数
// 统一处理日期格式化，避免代码重复
// 修复 iOS 日期格式兼容性问题

/**
 * 格式化日期字符串为 mm-dd HH:mm 格式
 * @param {string} dateStr - 日期字符串，格式如 "YYYY-MM-DD HH:mm:ss"
 * @returns {string} 格式化后的日期字符串，格式如 "12-25 14:30"
 */
function formatDate(dateStr) {
  // [核心修复] iOS 必须将 '-' 替换为 '/'
  // Bmob 返回的时间格式通常是 "YYYY-MM-DD HH:mm:ss"
  let timeStr = dateStr.replace(/-/g, '/');
  let d = new Date(timeStr);
  
  let m = (d.getMonth() + 1).toString().padStart(2, '0');
  let day = d.getDate().toString().padStart(2, '0');
  let h = d.getHours().toString().padStart(2, '0');
  let min = d.getMinutes().toString().padStart(2, '0');
  
  return `${m}-${day} ${h}:${min}`;
}

module.exports = {
  formatDate: formatDate
};

