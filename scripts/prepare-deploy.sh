#!/bin/bash

# ============================================
# 云函数部署准备脚本（拷贝版）
# ============================================
# 功能：
# 1. 将 common 公共模块整包拷贝到各个云函数目录（包含 node_modules）
# 2. 若 common 未安装依赖则自动安装（生产依赖）
# 3. 统一各云函数的依赖来源与工具层
#
# 使用方式：
#   ./scripts/prepare-deploy.sh                # 更新所有云函数
#   ./scripts/prepare-deploy.sh getUserInfo    # 只更新指定云函数
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLOUDFUNCTIONS_DIR="$PROJECT_ROOT/cloudfunctions"
COMMON_DIR="$CLOUDFUNCTIONS_DIR/common"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    云函数部署准备脚本（拷贝版）${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 common 目录是否存在
if [ ! -d "$COMMON_DIR" ]; then
    echo -e "${RED}错误: common 目录不存在: $COMMON_DIR${NC}"
    exit 1
fi

# 确保 common 目录有 node_modules
if [ ! -d "$COMMON_DIR/node_modules" ]; then
    echo -e "${YELLOW}正在安装 common 模块依赖...${NC}"
    cd "$COMMON_DIR"
    npm install --production --silent 2>/dev/null || npm install --production
    cd "$PROJECT_ROOT"
    echo -e "${GREEN}✓ common 依赖安装完成${NC}"
    echo ""
fi

TARGET_FUNC="$1"

process_function() {
    local func_dir="$1"
    local func_name=$(basename "$func_dir")
    
    [[ "$func_name" == "common" ]] && return 0
    [[ "$func_name" == .* ]] && return 0
    [[ ! -f "$func_dir/index.js" ]] && return 0
    
    local target_common="$func_dir/common"
    
    # 删除旧的 common（目录或软链接）
    rm -rf "$target_common"
    
    # 拷贝 common 整包到目标函数目录
    if command -v rsync >/dev/null 2>&1; then
      mkdir -p "$target_common"
      rsync -a --delete "$COMMON_DIR/" "$target_common/"
    else
      cp -R "$COMMON_DIR" "$target_common"
    fi
    
    echo -e "${GREEN}✓ 拷贝完成: $func_name/common ← common${NC}"
}

if [ -n "$TARGET_FUNC" ]; then
    func_path="$CLOUDFUNCTIONS_DIR/$TARGET_FUNC"
    if [ -d "$func_path" ]; then
        process_function "$func_path"
    else
        echo -e "${RED}错误: 云函数不存在: $TARGET_FUNC${NC}"
        exit 1
    fi
else
    for func_dir in "$CLOUDFUNCTIONS_DIR"/*/; do
        process_function "$func_dir"
    done
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    部署准备完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "现在可以在微信开发者工具中部署云函数了"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo "  - common 以拷贝方式存在于每个云函数目录中"
echo "  - 请确保部署时选择“上传所有文件”，包含 common 及其 node_modules"
echo "  - 如需减小包体积，可转为 file:../common 依赖并使用云端安装依赖（不拷贝）"
echo ""