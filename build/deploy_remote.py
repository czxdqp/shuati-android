#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 deploy/ 目录上传到服务器并执行部署脚本。

用法：
    python deploy_remote.py --host 1.2.3.4 --user root --password 'xxx'
    python deploy_remote.py --host 1.2.3.4 --user root --key C:/path/key.pem
    python deploy_remote.py --host 1.2.3.4 --user ubuntu --key ... --sudo-pass 'xxx'

只做三件事：上传文件、执行 deploy.sh、回读访问结果。不改动服务器其他配置。
"""
import argparse
import os
import sys
import time

import paramiko

BASE = os.path.dirname(os.path.abspath(__file__))
DEPLOY_DIR = os.path.join(os.path.dirname(BASE), 'deploy')
REMOTE_DIR = '/tmp/shuati-deploy'


def log(msg):
    print(msg, flush=True)


def connect(args):
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(
        hostname=args.host,
        port=args.port,
        username=args.user,
        timeout=20,
        banner_timeout=30,
        auth_timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )
    if args.key:
        kw['key_filename'] = args.key
    else:
        kw['password'] = args.password
    cli.connect(**kw)
    return cli


def run(cli, cmd, sudo_pass=None, timeout=900, quiet=False):
    """执行命令并实时回显。sudo_pass 非空时自动喂给 sudo -S。"""
    if sudo_pass:
        cmd = "sudo -S -p '' bash -lc %s" % shq(cmd)
    full = cmd
    stdin, stdout, stderr = cli.exec_command(full, timeout=timeout, get_pty=False)
    if sudo_pass:
        try:
            stdin.write(sudo_pass + '\n')
            stdin.flush()
        except Exception:
            pass

    out = []
    while True:
        line = stdout.readline()
        if not line:
            break
        line = line.rstrip('\n')
        out.append(line)
        if not quiet:
            log('  ' + line)
    err = stderr.read().decode('utf-8', 'replace').strip()
    code = stdout.channel.recv_exit_status()
    if err and code != 0 and not quiet:
        log('  [stderr] ' + err[-500:])
    return code, '\n'.join(out), err


def shq(s):
    return "'" + s.replace("'", "'\"'\"'") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', required=True)
    ap.add_argument('--user', default='root')
    ap.add_argument('--port', type=int, default=22)
    ap.add_argument('--password')
    ap.add_argument('--key')
    ap.add_argument('--sudo-pass', default=None, help='非 root 用户执行 sudo 的密码')
    args = ap.parse_args()

    if not args.password and not args.key:
        log('错误：需要 --password 或 --key')
        return 2

    # 0. 本地检查
    for f in ('index.html', 'nginx-shuati.conf', 'deploy.sh'):
        p = os.path.join(DEPLOY_DIR, f)
        if not os.path.exists(p):
            log('本地缺少文件：%s' % p)
            return 2

    # 1. 连接
    log('==> 连接 %s@%s:%d' % (args.user, args.host, args.port))
    t0 = time.time()
    try:
        cli = connect(args)
    except Exception as e:
        log('连接失败：%s' % e)
        log('常见原因：IP 写错 / 安全组未放行 22 / 密码或密钥不对 / root 登录被禁用')
        return 1
    log('    已连接（%.1fs）' % (time.time() - t0))

    # 2. 看系统
    code, out, _ = run(cli, 'cat /etc/os-release | head -3; uname -r; id -u', quiet=True)
    log('==> 服务器信息')
    for line in out.splitlines():
        log('    ' + line)
    is_root = out.strip().splitlines()[-1].strip() == '0' if out else False
    sudo_pass = None if is_root else (args.sudo_pass or args.password)

    # 3. 上传
    log('==> 上传文件到 %s' % REMOTE_DIR)
    sftp = cli.open_sftp()
    run(cli, 'mkdir -p ' + REMOTE_DIR, sudo_pass)
    for f in ('index.html', 'nginx-shuati.conf', 'deploy.sh'):
        lp = os.path.join(DEPLOY_DIR, f)
        rp = REMOTE_DIR + '/' + f
        t1 = time.time()
        sftp.put(lp, rp)
        log('    %-20s %8.1f KB  %.1fs' % (f, os.path.getsize(lp) / 1024.0, time.time() - t1))
    sftp.close()

    # 4. 执行部署
    log('==> 执行部署脚本（首次安装 nginx 可能要 1-2 分钟）')
    cmd = ('export DEBIAN_FRONTEND=noninteractive; cd %s && bash deploy.sh'
           % REMOTE_DIR)
    code, out, err = run(cli, cmd, sudo_pass, timeout=1200)
    if code != 0:
        log('部署脚本返回码 %d，未成功' % code)
        if err:
            log(err[-800:])
        cli.close()
        return 1

    # 5. 回读结果
    log('==> 核对结果')
    checks = [
        ('nginx 状态', 'systemctl is-active nginx'),
        ('监听端口', "ss -lntp 2>/dev/null | grep ':80 ' || netstat -lntp 2>/dev/null | grep ':80 '"),
        ('文件位置', 'ls -lh /var/www/shuati/index.html'),
        ('本机自测', "curl -s -o /dev/null -w '%{http_code} %{size_download}bytes %{time_total}s' http://127.0.0.1/"),
    ]
    for name, c in checks:
        code, out, _ = run(cli, c, quiet=True)
        log('    %-10s %s' % (name, out.strip() or '(空)'))

    cli.close()
    log('')
    log('部署完成，访问地址： http://%s/' % args.host)
    log('如果浏览器打不开但第 5 步自测是 200，就是安全组没放行 80。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
