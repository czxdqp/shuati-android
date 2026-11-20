/* ============================================================
 * 文件导入：PDF / DOCX / XLSX / CSV / TXT / MD / JSON
 * 全部在浏览器本地完成，不联网
 * ============================================================ */
(function (root) {
  'use strict';

  var TD = new TextDecoder('utf-8');

  /* ---------------- 通用工具 ---------------- */

  function decodeText(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    // BOM
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) return TD.decode(u8.subarray(3));
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    var s = TD.decode(u8);
    // 明显乱码 -> 尝试 GBK
    var bad = (s.match(/\uFFFD/g) || []).length;
    if (bad > 3 && bad / Math.max(1, s.length) > 0.002) {
      try { return new TextDecoder('gbk').decode(u8); } catch (e) { /* ignore */ }
    }
    return s;
  }

  /* ---------------- ZIP（docx / xlsx） ---------------- */

  function openZip(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var eocd = -1;
    var min = Math.max(0, u8.length - 66000);
    for (var i = u8.length - 22; i >= min; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('无法识别文件结构（可能不是真正的 docx/xlsx）');
    var total = dv.getUint16(eocd + 10, true);
    var p = dv.getUint32(eocd + 16, true);
    var entries = {};
    for (var k = 0; k < total; k++) {
      if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true);
      var elen = dv.getUint16(p + 30, true);
      var clen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = TD.decode(u8.subarray(p + 46, p + 46 + nlen));
      entries[name] = { method: method, csize: csize, lho: lho };
      p += 46 + nlen + elen + clen;
    }
    return { u8: u8, dv: dv, entries: entries };
  }

  async function readEntry(zip, name) {
    var e = zip.entries[name];
    if (!e) throw new Error('文件缺失：' + name);
    var dv = zip.dv, u8 = zip.u8;
    var nlen = dv.getUint16(e.lho + 26, true);
    var elen = dv.getUint16(e.lho + 28, true);
    var start = e.lho + 30 + nlen + elen;
    var data = u8.subarray(start, start + e.csize);
    if (e.method === 0) return data;
    if (e.method !== 8) throw new Error('不支持的压缩方式');
    if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器版本过低，无法解压该文件');
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function parseXml(str) {
    var dom = new DOMParser().parseFromString(str, 'application/xml');
    if (dom.getElementsByTagName('parsererror').length) throw new Error('XML 解析失败');
    return dom;
  }

  function allByLocalName(node, name) {
    var out = [];
    var list = node.getElementsByTagName('*');
    for (var i = 0; i < list.length; i++) {
      if (list[i].localName === name) out.push(list[i]);
    }
    return out;
  }

  /* ---------------- DOCX ---------------- */

  function paraText(p) {
    var out = '';
    (function walk(n) {
      var kids = n.childNodes;
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.nodeType !== 1) continue;
        var ln = c.localName;
        if (ln === 't') out += c.textContent;
        else if (ln === 'tab') out += '\t';
        else if (ln === 'br' || ln === 'cr') out += '\n';
        else walk(c);
      }
    })(p);
    return out;
  }

  async function parseDocx(buf) {
    var zip = openZip(buf);
    var xml = TD.decode(await readEntry(zip, 'word/document.xml'));
    var dom = parseXml(xml);
    var ps = allByLocalName(dom, 'p').filter(function (p) {
      var par = p.parentNode;
      return !par || par.localName !== 'p';
    });
    var lines = [];
    for (var i = 0; i < ps.length; i++) {
      var t = paraText(ps[i]).replace(/\u00a0/g, ' ');
      lines.push(t);
    }
    var text = lines.join('\n');
    if (!text.trim()) throw new Error('文档中没有可读取的文字');
    return { text: text, kind: 'text' };
  }

  /* ---------------- XLSX ---------------- */

  function colIndex(ref) {
    var m = String(ref).match(/^([A-Z]+)/);
    if (!m) return 0;
    var s = m[1], n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  async function parseXlsx(buf) {
    var zip = openZip(buf);
    var shared = [];
    if (zip.entries['xl/sharedStrings.xml']) {
      var sx = TD.decode(await readEntry(zip, 'xl/sharedStrings.xml'));
      var sdom = parseXml(sx);
      shared = allByLocalName(sdom, 'si').map(function (si) {
        var s = '';
        (function walk(n) {
          var kids = n.childNodes;
          for (var i = 0; i < kids.length; i++) {
            var c = kids[i];
            if (c.nodeType !== 1) continue;
            if (c.localName === 't') s += c.textContent;
            else walk(c);
          }
        })(si);
        return s;
      });
    }

    var sheets = Object.keys(zip.entries)
      .filter(function (n) { return /^xl\/worksheets\/sheet\d+\.xml$/.test(n); })
      .sort(function (a, b) {
        return parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10);
      });
    if (!sheets.length) throw new Error('工作簿中没有工作表');

    var best = null;
    for (var si = 0; si < sheets.length; si++) {
      var xml = TD.decode(await readEntry(zip, sheets[si]));
      var dom = parseXml(xml);
      var rowsEls = allByLocalName(dom, 'row');
      var rows = [];
      for (var r = 0; r < rowsEls.length; r++) {
        var cells = [];
        var kids = rowsEls[r].childNodes;
        for (var c = 0; c < kids.length; c++) {
          var cell = kids[c];
          if (cell.nodeType !== 1 || cell.localName !== 'c') continue;
          var ci = colIndex(cell.getAttribute('r') || '');
          var t = cell.getAttribute('t');
          var val = '';
          if (t === 'inlineStr') {
            var ins = allByLocalName(cell, 't');
            val = ins.map(function (x) { return x.textContent; }).join('');
          } else {
            var v = null;
            var ck = cell.childNodes;
            for (var q = 0; q < ck.length; q++) {
              if (ck[q].nodeType === 1 && ck[q].localName === 'v') { v = ck[q]; break; }
            }
            if (v) {
              if (t === 's') val = shared[parseInt(v.textContent, 10)] || '';
              else val = v.textContent;
            }
          }
          cells[ci] = val;
        }
        var arr = [];
        for (var z = 0; z < cells.length; z++) arr.push(cells[z] == null ? '' : cells[z]);
        if (arr.some(function (x) { return String(x).trim(); })) rows.push(arr);
      }
      if (rows.length && (!best || rows.length > best.length)) best = rows;
    }
    if (!best || !best.length) throw new Error('工作表为空');
    return { rows: best, kind: 'table' };
  }

  /* ---------------- CSV ---------------- */

  function detectDelim(text) {
    var head = text.slice(0, 3000).split('\n')[0];
    var cands = [',', '\t', ';', '|'];
    var best = ',', bestN = -1;
    cands.forEach(function (d) {
      var n = head.split(d).length - 1;
      if (n > bestN) { bestN = n; best = d; }
    });
    return bestN > 0 ? best : ',';
  }

  function parseCSV(text) {
    var delim = detectDelim(text);
    var rows = [], row = [], cur = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === delim) { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (ch === '\r') { /* skip */ }
        else cur += ch;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }

  /* ---------------- PDF ---------------- */

  var _pdfReady = false;
  function setupPdf() {
    if (_pdfReady) return;
    _pdfReady = true;
    if (typeof pdfjsLib === 'undefined') return;
    var el = document.getElementById('pdfWorkerSrc');
    if (el && el.textContent.length > 1000) {
      try {
        var blob = new Blob([el.textContent], { type: 'text/javascript' });
        var url = URL.createObjectURL(blob);
        var w = new Worker(url);
        w.terminate();
        pdfjsLib.GlobalWorkerOptions.workerSrc = url;
        return;
      } catch (e) { /* file:// 下 Worker 可能被禁 */ }
      try {
        var s = document.createElement('script');
        s.textContent = el.textContent;
        document.head.appendChild(s);
        el.textContent = '';
      } catch (e2) { /* ignore */ }
    }
  }

  async function parsePdf(buf, onProgress) {
    setupPdf();
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF 引擎未加载');
    var doc = await pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      cMapPacked: true
    }).promise;

    var pages = [];
    var total = doc.numPages;
    for (var p = 1; p <= total; p++) {
      var page = await doc.getPage(p);
      var tc = await page.getTextContent({ includeMarkedContent: false });
      pages.push(PdfText.itemsToLines(tc.items));
      if (onProgress) onProgress(p, total);
      page.cleanup();
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    var lines = PdfText.dedupeRunning(pages);
    doc.destroy();
    return { text: lines.join('\n'), kind: 'text' };
  }

  /* ---------------- 分发 ---------------- */

  async function readFile(file, onProgress) {
    var name = (file.name || '').toLowerCase();
    var ext = name.split('.').pop();

    if (ext === 'pdf') {
      var b = await file.arrayBuffer();
      return await parsePdf(b, onProgress);
    }
    if (ext === 'docx') {
      return await parseDocx(await file.arrayBuffer());
    }
    if (ext === 'xlsx' || ext === 'xlsm') {
      return await parseXlsx(await file.arrayBuffer());
    }
    if (ext === 'doc' || ext === 'xls' || ext === 'ppt') {
      throw new Error('不支持旧版 Office 格式，请另存为 ' + (ext === 'xls' ? '.xlsx' : '.docx') + ' 后重试');
    }
    if (ext === 'csv') {
      var txt = decodeText(await file.arrayBuffer());
      return { rows: parseCSV(txt), kind: 'table' };
    }
    if (ext === 'txt' || ext === 'md' || ext === 'text' || ext === 'json') {
      var t2 = decodeText(await file.arrayBuffer());
      if (ext === 'json') {
        var data = JSON.parse(t2);
        var arr = Array.isArray(data) ? data : (data.questions || data.data || []);
        return { json: arr, kind: 'json' };
      }
      return { text: t2, kind: 'text' };
    }
    // 兜底：按文本尝试
    var t3 = decodeText(await file.arrayBuffer());
    if (t3.indexOf('\u0000') >= 0) throw new Error('无法识别的文件类型：.' + ext);
    return { text: t3, kind: 'text' };
  }

  async function toQuestions(result, onProgress) {
    if (result.kind === 'table') return Parse.parseTable(result.rows);
    if (result.kind === 'json') return Parse.parseJSON(result.json);
    return Parse.parseText(result.text);
  }

  root.FileImport = {
    readFile: readFile,
    toQuestions: toQuestions,
    parseCSV: parseCSV,
    parseDocx: parseDocx,
    parseXlsx: parseXlsx,
    parsePdf: parsePdf,
    openZip: openZip,
    decodeText: decodeText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
