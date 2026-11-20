# -*- coding: utf-8 -*-
"""把 CSS / JS / PDF 引擎内联成单文件 HTML"""
import io
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)

def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()

tpl = read(os.path.join(BASE, 'template.html'))

parts = {
    '/*__APP_CSS__*/': read(os.path.join(BASE, 'app.css')),
    '/*__PDFJS__*/': read(os.path.join(ROOT, 'vendor', 'pdf.min.js')),
    '/*__PDFWORKER__*/': read(os.path.join(ROOT, 'vendor', 'pdf.worker.min.js')),
    '/*__PDFTEXT__*/': read(os.path.join(BASE, 'pdftext.js')),
    '/*__PARSE__*/': read(os.path.join(BASE, 'parse.js')),
    '/*__STORE__*/': read(os.path.join(BASE, 'store.js')),
    '/*__IMPORT__*/': read(os.path.join(BASE, 'import.js')),
    '/*__AI__*/': read(os.path.join(BASE, 'ai.js')),
    '/*__APP__*/': read(os.path.join(BASE, 'app.js')),
}

out = tpl
for k, v in parts.items():
    if k not in out:
        print('警告: 模板中找不到占位符', k)
        sys.exit(1)
    # 防御：脚本内容里若出现 </script 会截断文档
    if k in ('/*__PDFJS__*/', '/*__PDFWORKER__*/', '/*__PDFTEXT__*/',
             '/*__PARSE__*/', '/*__STORE__*/', '/*__IMPORT__*/',
             '/*__AI__*/', '/*__APP__*/'):
        if '</script' in v.lower():
            print('错误: %s 含有 </script 字面量' % k)
            sys.exit(1)
    out = out.replace(k, v)

target = os.path.join(ROOT, '刷题助手.html')
with io.open(target, 'w', encoding='utf-8', newline='\n') as f:
    f.write(out)

size = os.path.getsize(target)
print('已生成: %s  (%.2f MB)' % (target, size / 1024.0 / 1024.0))
