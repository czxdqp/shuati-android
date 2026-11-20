#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""子路径部署：把刷题助手挂到现有站点的一个子路径下，不动原有站点。

适用于「服务器上已有网站在 80 端口运行」的情况。
最终地址形如 http://你的IP/shuati/

用法：
    python deploy-subpath.py --host 1.2.3.4 --user root --password 'x'
    python deploy-subpath.py --host 1.2.3.4 --user ubuntu --key C:/path/key.pem --sudo-pass 'x'

可选参数：
    --path /shuati/     子路径（默认 /shuati/）
    --site xuanji       现存的 nginx 站点名（默认自动探测唯一站点）
    --dry-run           只做检测，不修改任何文件
"""
import argparse
import hashlib
import os
import sys

import paramiko

BASE = os.path.dirname(os.path.abspath(__file__))
LOCAL_HTML = os.path.join(BASE, 'index.html')
PATCH_TMPL = r'''
import io, sys
P = %(conf)r
PATH = %(path)r
s = io.open(P, encoding="utf-8").read()
if "location ^~ " + PATH in s:
    print("SKIP 已有该配置")
    sys.exit(0)
BLOCK = """    # === 刷题助手（子路径部署）===
    location = %(bare)r {
        return 301 %(path)r;
    }

    location ^~ %(path)r {
        root /var/www;
        index index.html;
        try_files $uri $uri/ %(path)rindex.html;
        add_header Cache-Control "no-cache, must-revalidate";
        add_header X-Content-Type-Options nosniff always;
    }

"""
ANCHOR = "    location / {"
if ANCHOR not in s:
    print("FAIL 找不到插入锚点 location / {")
    sys.exit(1)
io.open(P, "w", encoding="utf-8").write(s.replace(ANCHOR, BLOCK + ANCHOR, 1))
print("PATCHED")
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', required=True)
    ap.add_argument('--user', default='root')
    ap.add_argument('--port', type=int, default=22)
    ap.add_argument('--password')
    ap.add_argument('--key')
    ap.add_argument('--sudo-pass')
    ap.add_argument('--path', default='/shuati/')
    ap.add_argument('--site')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    sub = a.path if a.path.startswith('/') else '/' + a.path
    if not sub.endswith('/'):
        sub += '/'
    bare = sub.rstrip('/')
    slug = sub.strip('/')

    if not os.path.exists(LOCAL_HTML):
        print('缺少 %s' % LOCAL_HTML)
        return 2

    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(hostname=a.host, port=a.port, username=a.user, timeout=20,
              banner_timeout=30, auth_timeout=30, look_for_keys=False, allow_agent=False)
    if a.key:
        kw['key_filename'] = a.key
    else:
        kw['password'] = a.password
    cli.connect(**kw)

    is_root = None

    def run(cmd, t=180):
        if is_root is False:
            cmd = "sudo -S -p '' bash -lc %s" % ("'" + cmd.replace("'", "'\"'\"'") + "'")
        _, o, e = cli.exec_command(cmd, timeout=t)
        if is_root is False:
            try:
                o.channel.sendall((a.sudo_pass or a.password or '') + '\n')
            except Exception:
                pass
        out = o.read().decode('utf-8', 'replace') + e.read().decode('utf-8', 'replace')
        return o.channel.recv_exit_status(), out.strip()

    code, out = run('id -u', 30)
    is_root = out.strip() == '0'
    print('== 身份：%s' % ('root' if is_root else a.user + '（将使用 sudo）'))

    # 探测现有站点
    code, out = run("ls -1 /etc/nginx/sites-enabled/ 2>/dev/null; ls -1 /etc/nginx/conf.d/*.conf 2>/dev/null", 30)
    files = [x for x in out.splitlines() if x.strip()]
    if not a.site:
        cand = [f for f in files if 'default' not in f]
        if len(cand) != 1:
            print('现有站点不唯一，请用 --site 指定：%s' % ', '.join(cand or ['(无)']))
            return 2
        a.site = cand[0]
    conf = '/etc/nginx/sites-available/' + a.site
    code, out = run('test -f %s && echo yes || echo no' % conf, 30)
    if out.strip() != 'yes':
        print('找不到配置文件 %s，请用 --site 指定正确的站点名' % conf)
        return 2
    print('== 目标站点：%s' % a.site)

    code, out = run("ss -lnt 2>/dev/null | grep ':80 ' | head -1", 30)
    print('== 80 端口：%s' % (out.strip() or '空闲'))

    if a.dry_run:
        print('== dry-run，不做修改')
        cli.close()
        return 0

    # 上传 HTML
    run('mkdir -p /var/www/%s' % slug, 60)
    sftp = cli.open_sftp()
    sftp.put(LOCAL_HTML, '/var/www/%s/index.html' % slug)
    sftp.close()
    run('chown -R www-data:www-data /var/www/%s && chmod 755 /var/www/%s && chmod 644 /var/www/%s/index.html'
        % (slug, slug, slug), 60)
    local_md5 = hashlib.md5(open(LOCAL_HTML, 'rb').read()).hexdigest()
    code, out = run('md5sum /var/www/%s/index.html' % slug, 30)
    print('== 上传完成，md5 %s %s' % ('一致' if local_md5 in out else '不一致(请检查)', out.split()[0] if out else ''))

    # 备份 + 打补丁
    run('cp -a %s /root/%s.conf.bak.$(date +%%Y%%m%%d-%%H%%M%%S)' % (conf, a.site), 60)
    code, out = run('ls -1t /root/%s.conf.bak.* 2>/dev/null | head -1' % a.site, 30)
    print('== 已备份：%s' % out.strip())

    script = PATCH_TMPL % {'conf': conf, 'path': sub, 'bare': bare}
    sftp = cli.open_sftp()
    with sftp.file('/tmp/_patch_shuati.py', 'w') as f:
        f.write(script)
    sftp.close()
    code, out = run('python3 /tmp/_patch_shuati.py', 60)
    print('== 配置：%s' % out.strip())
    if code != 0:
        print('打补丁失败，未改动生效')
        cli.close()
        return 1

    # 校验 + 重载（失败自动回滚）
    code, out = run('nginx -t', 60)
    print('== 校验：%s' % out.replace('\n', ' '))
    if code != 0:
        bak = run('ls -1t /root/%s.conf.bak.* | head -1' % a.site, 30)[1]
        run('cp -a %s %s' % (bak, conf), 60)
        run('nginx -t', 60)
        print('== 已回滚到 %s，站点未受影响' % bak)
        cli.close()
        return 1

    code, out = run('systemctl reload nginx && sleep 1 && systemctl is-active nginx', 90)
    print('== nginx：%s' % out.strip())

    code, out = run("curl -s -o /dev/null -w '%%{http_code} %%{size_download}' http://127.0.0.1%s" % sub, 60)
    print('== 服务器自测：%s' % out.strip())
    print('')
    print('访问地址： http://%s%s' % (a.host, sub))
    cli.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
