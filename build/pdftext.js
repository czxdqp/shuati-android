/* ============================================================
 * PDF 文本抽取：把 pdf.js 的 textContent 还原成「行」
 * 按 y 坐标聚行、按 x 排序，能较大程度恢复原排版
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PdfText = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function itemsToLines(items) {
    var rows = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it.str !== 'string' || it.str === '') {
        if (it && it.hasEOL && rows.length) rows[rows.length - 1].eol = true;
        continue;
      }
      var tr = it.transform || [1, 0, 0, 1, 0, 0];
      var x = tr[4], y = tr[5];
      var fs = Math.abs(tr[3]) || it.height || 10;
      var row = null;
      for (var r = rows.length - 1; r >= 0; r--) {
        if (Math.abs(rows[r].y - y) <= Math.max(1.6, fs * 0.45)) { row = rows[r]; break; }
        if (rows[r].y - y > fs) break;
      }
      if (!row) { row = { y: y, fs: fs, items: [], eol: false }; rows.push(row); }
      row.items.push({ x: x, str: it.str, w: it.width || 0, fs: fs });
    }

    rows.sort(function (a, b) { return b.y - a.y; });

    return rows.map(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      var out = '';
      var prevEnd = null, prevStr = '';
      for (var k = 0; k < row.items.length; k++) {
        var it = row.items[k];
        if (prevEnd !== null) {
          var gap = it.x - prevEnd;
          var needSpace = gap > Math.max(1.2, it.fs * 0.28);
          var ch1 = prevStr.slice(-1), ch2 = it.str.charAt(0);
          var cjk1 = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch1);
          var cjk2 = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch2);
          if (needSpace && !(cjk1 && cjk2) && !/\s$/.test(out) && !/^\s/.test(it.str)) {
            out += ' ';
          }
        }
        out += it.str;
        prevEnd = it.x + it.w;
        prevStr = it.str;
      }
      return out.replace(/[ \t]+/g, ' ').trim();
    }).filter(function (s) { return s.length > 0; });
  }

  // 多页 PDF：去掉每页顶部/底部重复出现的页眉页脚
  function dedupeRunning(pages) {
    if (!pages || !pages.length) return [];
    if (pages.length < 2) return [].concat.apply([], pages);
    var n = pages.length;
    var need = Math.max(2, Math.ceil(n * 0.6));
    var norm = function (s) { return s.replace(/[0-9]+/g, '#').replace(/\s+/g, ''); };
    var headMap = {}, footMap = {};
    pages.forEach(function (ls) {
      ls.slice(0, 2).forEach(function (l) { var k = norm(l); headMap[k] = (headMap[k] || 0) + 1; });
      ls.slice(-2).forEach(function (l) { var k = norm(l); footMap[k] = (footMap[k] || 0) + 1; });
    });
    var out = [];
    pages.forEach(function (ls) {
      var kept = ls.filter(function (l, i) {
        var k = norm(l);
        if (i < 2 && headMap[k] >= need) return false;
        if (i >= ls.length - 2 && footMap[k] >= need) return false;
        return true;
      });
      out = out.concat(kept);
    });
    return out;
  }

  // 从 pdf.js 文档对象抽取全文
  async function extract(pdfDoc, opts) {
    opts = opts || {};
    var pages = [];
    var total = pdfDoc.numPages;
    for (var p = 1; p <= total; p++) {
      var page = await pdfDoc.getPage(p);
      var tc = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
      pages.push(itemsToLines(tc.items));
      if (typeof opts.onProgress === 'function') opts.onProgress(p, total);
      page.cleanup();
    }
    return dedupeRunning(pages);
  }

  return { itemsToLines: itemsToLines, extract: extract, dedupeRunning: dedupeRunning };
});
