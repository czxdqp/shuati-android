#!/usr/bin/env bash
# 刷题助手 · 阿里云 ECS / 轻量服务器一键部署脚本
# 用法（在服务器上，与 index.html 同目录执行）：
#   sudo bash deploy.sh
#
# 做的事：装 nginx -> 放文件 -> 写站点配置 -> 开防火墙 -> 启动 -> 打印访问地址
set -euo pipefail

SITE_DIR=/var/www/shuati
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[注意] %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行：sudo bash deploy.sh"; exit 1; }
[ -f "$SRC_DIR/index.html" ] || { echo "当前目录找不到 index.html，请把本脚本和 index.html 放在一起"; exit 1; }

# 安全检查：80 已被占用说明机器上已有网站在跑，
# 本脚本会接管 80 的默认站点，直接跑会顶掉现有网站。
if ss -lnt 2>/dev/null | grep -qE ':80[[:space:]]'; then
  if [ "${1:-}" != "--force" ]; then
    warn "检测到 80 端口已有服务在监听（机器上可能已有网站在运行）"
    warn "本脚本会接管 80 端口的默认站点，可能让现有网站无法访问。"
    warn "  · 要与现有站点共存 → 改用 deploy-subpath.py（子路径部署）"
    warn "  · 确认要替换现有站点 → bash deploy.sh --force"
    exit 1
  fi
  warn "已指定 --force，将继续接管 80 端口"
fi

# ---------- 1. 安装 nginx ----------
if command -v nginx >/dev/null 2>&1; then
  say "nginx 已安装，跳过"
else
  say "安装 nginx"
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y nginx
  else
    echo "未识别的包管理器，请手动安装 nginx 后重跑"; exit 1
  fi
fi

# ---------- 2. 放文件 ----------
say "部署文件到 $SITE_DIR"
mkdir -p "$SITE_DIR"
cp -f "$SRC_DIR/index.html" "$SITE_DIR/index.html"
chmod 644 "$SITE_DIR/index.html"
chown -R nginx:nginx "$SITE_DIR" 2>/dev/null || chown -R www-data:www-data "$SITE_DIR" 2>/dev/null || true

# SELinux（CentOS / Alibaba Cloud Linux 常见）
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
  say "SELinux 为 Enforcing，放行 nginx 读取该目录"
  chcon -R -t httpd_sys_content_t "$SITE_DIR" 2>/dev/null || true
  setsebool -P httpd_can_network_connect 1 2>/dev/null || true
fi

# ---------- 3. 站点配置 ----------
say "写入 nginx 站点配置"
if [ -d /etc/nginx/conf.d ]; then
  cp -f "$SRC_DIR/nginx-shuati.conf" /etc/nginx/conf.d/shuati.conf
else
  mkdir -p /etc/nginx/conf.d
  cp -f "$SRC_DIR/nginx-shuati.conf" /etc/nginx/conf.d/shuati.conf
fi

# Debian/Ubuntu 自带 default 站点会抢占 80 端的 default_server
if [ -e /etc/nginx/sites-enabled/default ]; then
  mv /etc/nginx/sites-enabled/default /etc/nginx/default.bak
  warn "已停用 Ubuntu 默认站点（原文件备份为 /etc/nginx/default.bak）"
fi

nginx -t

# ---------- 4. 防火墙 ----------
say "放行 80 端口"
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http >/dev/null
  firewall-cmd --reload >/dev/null
elif command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
else
  echo "未检测到运行中的防火墙，跳过（阿里云还需在控制台安全组放行 80 端口）"
fi

# ---------- 5. 启动 ----------
say "启动 / 重载 nginx"
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx

sleep 1
if systemctl is-active --quiet nginx; then
  IP=$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || true)
  [ -z "${IP:-}" ] && IP=$(hostname -I | awk '{print $1}')
  printf '\n\033[1;32m部署完成\033[0m\n'
  printf '  访问地址： http://%s/\n' "$IP"
  printf '  文件位置： %s/index.html\n' "$SITE_DIR"
  printf '  更新方式： 覆盖 %s/index.html 后刷新页面即可\n' "$SITE_DIR"
  printf '\n如果打不开，检查阿里云控制台 → 安全组 → 入方向是否放行了 80 端口。\n'
else
  echo "nginx 启动失败，查看：journalctl -u nginx -n 50 --no-pager"
  exit 1
fi
