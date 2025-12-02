// 日期格式化工具函数
// 统一处理日期格式化，避免代码重复
// 兼容 Bmob 字符串格式和云数据库 Date 对象格式

/**
 * 格式化日期为 mm-dd HH:mm 格式
 * @param {string|Date|object} dateInput - 日期输入，支持以下格式：
 *   - 字符串格式如 "YYYY-MM-DD HH:mm:ss"
 *   - Date 对象
 *   - 云数据库返回的时间对象
 * @returns {string} 格式化后的日期字符串，格式如 "12-25 14:30"
 */
function formatDate(dateInput) {
  let d;
  
  // 处理不同类型的输入
  if (!dateInput) {
    return '未知时间';
  }
  
  if (dateInput instanceof Date) {
    // 已经是 Date 对象
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // 字符串格式 - [核心修复] iOS 必须将 '-' 替换为 '/'
    let timeStr = dateInput.replace(/-/g, '/');
    d = new Date(timeStr);
  } else if (typeof dateInput === 'object') {
    // 云数据库返回的时间对象（可能包含 $date 或其他格式）
    if (dateInput.$date) {
      d = new Date(dateInput.$date);
    } else {
      // 尝试直接转换
      d = new Date(dateInput);
    }
  } else {
    // 其他情况，尝试直接转换
    d = new Date(dateInput);
  }
  
  // 检查日期是否有效
  if (isNaN(d.getTime())) {
    return '时间格式错误';
  }
  
  let m = (d.getMonth() + 1).toString().padStart(2, '0');
  let day = d.getDate().toString().padStart(2, '0');
  let h = d.getHours().toString().padStart(2, '0');
  let min = d.getMinutes().toString().padStart(2, '0');
  
  return `${m}-${day} ${h}:${min}`;
}

/**
 * 格式化日期为完整格式 YYYY-MM-DD HH:mm:ss
 * @param {string|Date|object} dateInput - 日期输入
 * @returns {string} 格式化后的日期字符串
 */
function formatDateFull(dateInput) {
  let d;
  
  if (!dateInput) {
    return '未知时间';
  }
  
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    let timeStr = dateInput.replace(/-/g, '/');
    d = new Date(timeStr);
  } else if (typeof dateInput === 'object') {
    if (dateInput.$date) {
      d = new Date(dateInput.$date);
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = new Date(dateInput);
  }
  
  if (isNaN(d.getTime())) {
    return '时间格式错误';
  }
  
  let y = d.getFullYear();
  let m = (d.getMonth() + 1).toString().padStart(2, '0');
  let day = d.getDate().toString().padStart(2, '0');
  let h = d.getHours().toString().padStart(2, '0');
  let min = d.getMinutes().toString().padStart(2, '0');
  let sec = d.getSeconds().toString().padStart(2, '0');
  
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

module.exports = {
  formatDate,
  formatDateFull
};
