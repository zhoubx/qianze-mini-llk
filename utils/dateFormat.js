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
  let d = parseDate(dateInput);
  
  if (!dateInput) {
    return '未知时间';
  }
  
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
  let d = parseDate(dateInput);
  
  if (!dateInput) {
    return '未知时间';
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

/**
 * 将日期输入转换为 Date 对象，处理 iOS 兼容性问题
 * @param {string|Date|object} dateInput - 日期输入
 * @returns {Date} Date 对象
 */
function parseDate(dateInput) {
  let d;
  
  if (dateInput instanceof Date) {
    // 已经是 Date 对象
    d = dateInput;
  } else if (typeof dateInput === 'string') {
    // 字符串格式
    // 1. 如果是 ISO 格式（包含 T），直接解析
    if (dateInput.includes('T')) {
      d = new Date(dateInput);
    } else {
      // 2. 普通格式 - iOS 必须处理
      // 两种兼容方案：
      //   a. 将 '-' 替换为 '/'
      //   b. 或转换为 ISO 格式，将空格替换为 'T'
      //   方案 b 更可靠，因为 iOS 16+ 已修复部分问题，但旧版本仍需兼容
      let timeStr = dateInput.replace(/\s+/g, 'T');
      d = new Date(timeStr);
    }
  } else if (typeof dateInput === 'object') {
    // 云数据库返回的时间对象
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
  
  return d;
}

/**
 * 格式化日期为 mm-dd HH:mm:ss 格式
 * @param {string|Date|object} dateInput - 日期输入
 * @returns {string} 格式化后的日期字符串，格式如 "12-25 14:30:45"
 */
function formatDateShortWithSeconds(dateInput) {
  let d = parseDate(dateInput);
  
  if (!dateInput) {
    return '未知时间';
  }
  
  if (isNaN(d.getTime())) {
    return '时间格式错误';
  }
  
  let m = (d.getMonth() + 1).toString().padStart(2, '0');
  let day = d.getDate().toString().padStart(2, '0');
  let h = d.getHours().toString().padStart(2, '0');
  let min = d.getMinutes().toString().padStart(2, '0');
  let sec = d.getSeconds().toString().padStart(2, '0');
  
  return `${m}-${day} ${h}:${min}:${sec}`;
}

module.exports = {
  formatDate,
  formatDateFull,
  formatDateShortWithSeconds,
  parseDate
};
