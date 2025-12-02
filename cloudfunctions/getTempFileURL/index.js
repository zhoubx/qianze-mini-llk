// 云函数：获取云文件临时链接
// 云函数拥有管理员权限，可以获取任何用户上传的文件的临时链接
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const { fileList } = event;
  
  if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
    return {
      success: false,
      error: 'fileList is required and must be a non-empty array'
    };
  }

  try {
    // 过滤出有效的云文件 ID
    const validFileIds = fileList.filter(id => id && id.startsWith('cloud://'));
    
    if (validFileIds.length === 0) {
      return {
        success: true,
        fileList: []
      };
    }

    // 使用管理员权限获取临时链接
    const result = await cloud.getTempFileURL({
      fileList: validFileIds
    });

    return {
      success: true,
      fileList: result.fileList
    };
  } catch (err) {
    console.error('获取临时链接失败:', err);
    return {
      success: false,
      error: err.message || '获取临时链接失败'
    };
  }
};

