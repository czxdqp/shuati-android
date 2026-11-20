/* ============================================================
 * 题库解析引擎 Parse
 * 纯函数，不依赖 DOM，可在 Node 中单测
 * 支持：PDF 抽取文本 / Word 段落 / TXT / Markdown / 表格行
 * ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Parse = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */

  var FULL2HALF = {
    'Ａ':'A','Ｂ':'B','Ｃ':'C','Ｄ':'D','Ｅ':'E','Ｆ':'F','Ｇ':'G','Ｈ':'H',
    'ａ':'a','ｂ':'b','ｃ':'c','ｄ':'d','ｅ':'e','ｆ':'f','ｇ':'g','ｈ':'h',
    '０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9'
  };
  function toHalf(s) {
    return String(s == null ? '' : s).replace(/[Ａ-Ｈａ-ｈ０-９]/g, function (c) {
      return FULL2HALF[c] || c;
    });
  }

  // 中文之间的多余空格（PDF 逐字抽取时常见）
  function cleanCJK(s) {
    return String(s == null ? '' : s)
      .replace(/([\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, '$1')
      .replace(/([\u4e00-\u9fa5])\s+(?=[，。；：、？！）》」』%）])/g, '$1')
      .replace(/([，。；：、（《「『])\s+(?=[\u4e00-\u9fa5])/g, '$1');
  }

  function tidy(s) {
    return cleanCJK(String(s == null ? '' : s).replace(/\u00a0|\u3000/g, ' ').replace(/\s+/g, ' ')).trim();
  }

  // 保留段落感的多行清理
  function tidyMulti(s) {
    return String(s == null ? '' : s)
      .split('\n')
      .map(function (l) { return tidy(l); })
      .filter(function (l) { return l.length > 0; })
      .join('\n');
  }

  /* ---------------- 正则模式 ---------------- */

  var TYPE_WORDS = '单项选择|多项选择|不定项选择|单选|多选|判断|填空|简答|论述|案例分析|名词解释|计算';
  var RE_TYPE_TAG = new RegExp('^\\s*[【\\[（(]\\s*(?:' + TYPE_WORDS + ')(?:题)?\\s*[】\\]）)]\\s*');

  var RE_QNUM = /^\s*(?:第\s*)?([0-9]{1,4})\s*[.．、,，)）:：](?![0-9])\s*/;
  var RE_QNUM_PAREN = /^\s*[（(]\s*([0-9]{1,4})\s*[)）]\s*/;

  var RE_OPT_LINE = /^\s*[（(]\s*([A-HＡ-Ｈ])\s*[)）]\s*(.*)$|^\s*([A-HＡ-Ｈ])\s*[.．、,，:：)）]\s*(.*)$/;

  var RE_PAGEART = /^(?:第\s*[0-9]+\s*页(?:\s*[，,、]?\s*共\s*[0-9]+\s*页)?|[-—\s]*[0-9]{1,4}[-—\s]*|共\s*[0-9]+\s*页|Page\s*[0-9]+(?:\s*of\s*[0-9]+)?)$/i;

  var RE_SECTION = /^\s*(?:第[一二三四五六七八九十百]+[章节部分讲单元篇]|[一二三四五六七八九十]{1,3}\s*[、.]\s*\S|[（(][一二三四五六七八九十]{1,3}[)）]\s*\S)/;

  var RE_ANSWER_HEAD = /^[【\[（(]?\s*(?:参考答案|正确答案|标准答案|本题答案|答\s*案)\s*[】\]）)]?\s*[:：]?\s*/;
  var RE_ANALYSIS_HEAD = /^[【\[（(]?\s*(?:答案)?(?:解\s*析|分\s*析|答案解析|试题解析|考点解析|点\s*评)\s*[】\]）)]?\s*[:：]?\s*/;

  var OPTS_LETTERS = 'ABCDEFGH';

  /* ---------------- 行级预处理 ---------------- */

  function toLines(text) {
    var s = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
    s = s.replace(/[\u200b-\u200f\ufeff]/g, '');
    return s.split('\n').map(function (l) { return l.replace(/[ \t]+$/g, '').trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  // 去掉重复出现的页眉页脚
  function stripHeaders(lines) {
    var count = {}, n = lines.length;
    lines.forEach(function (l) {
      var k = l.replace(/[0-9]+/g, '#');
      count[k] = (count[k] || 0) + 1;
    });
    var limit = Math.max(3, Math.ceil(n * 0.3));
    return lines.filter(function (l) {
      if (RE_PAGEART.test(l)) return false;
      if (/^\s*[-—_=·.\*]{3,}\s*$/.test(l)) return false;
      var k = l.replace(/[0-9]+/g, '#');
      if (l.length <= 30 && count[k] >= limit) return false;
      return true;
    });
  }

  /* ---------------- 题号 / 选项 识别 ---------------- */

  // 返回 {num, rest} 或 null
  function matchQNum(line) {
    var l = String(line);
    // 先剥离行首题型标签：【单选题】1. xxx
    var tag = l.match(RE_TYPE_TAG);
    if (tag) l = l.slice(tag[0].length);
    var m = toHalf(l).match(RE_QNUM) || toHalf(l).match(RE_QNUM_PAREN);
    if (!m) return null;
    var rest = l.slice(m[0].length);
    // 题号后再剥一次标签：1.【单选题】xxx
    var tag2 = rest.match(RE_TYPE_TAG);
    if (tag2) rest = rest.slice(tag2[0].length);
    return { num: parseInt(m[1], 10), rest: rest };
  }

  // 返回 {key, text} 或 null
  function matchOption(line) {
    var m = String(line).match(RE_OPT_LINE);
    if (!m) return null;
    var k = m[1] || m[2];
    var t = m[1] ? m[3] : m[4];
    return { key: toHalf(k).toUpperCase(), text: t == null ? '' : t };
  }

  /* ---------------- 答案表（卷末参考答案） ---------------- */

  function extractAnswerKey(lines) {
    var idx = -1;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (/^[【\[]?\s*(?:参考)?答\s*案\s*[】\]]?\s*$/.test(lines[i]) ||
          /^[【\[]?\s*参考答案[与及]解析\s*[】\]]?\s*$/.test(lines[i])) {
        if (i > lines.length * 0.45) { idx = i; break; }
      }
    }
    if (idx < 0) return null;

    var tail = lines.slice(idx + 1).join(' ');
    var map = {};
    var m;
    // 1-5 ABCD  /  1~5、ABCD
    var reRange = /([0-9]{1,4})\s*[-~—－至到]\s*([0-9]{1,4})\s*[:：.、]?\s*([A-H√×对错]{2,})/g;
    while ((m = reRange.exec(tail))) {
      var a = +m[1], b = +m[2], seq = m[3];
      if (b < a || b - a > 300) continue;
      for (var k = 0; k <= b - a; k++) {
        if (k < seq.length && !map[a + k]) map[a + k] = seq[k];
      }
    }
    // 1.A 2.ABC 3.√
    var reSingle = /([0-9]{1,4})\s*[.、:：)）]?\s*([A-H]{1,8}|√|×|对|错)(?![0-9\u4e00-\u9fa5A-Za-z])/g;
    while ((m = reSingle.exec(tail))) {
      var num = +m[1];
      if (!map[num]) map[num] = m[2];
    }
    return Object.keys(map).length >= 2 ? map : null;
  }

  function findAnswerKeyIndex(lines) {
    for (var i = lines.length - 1; i >= 0; i--) {
      if (/^[【\[]?\s*(?:参考)?答\s*案\s*[】\]]?\s*$/.test(lines[i]) ||
          /^[【\[]?\s*参考答案[与及]解析\s*[】\]]?\s*$/.test(lines[i])) {
        if (i > lines.length * 0.45) return i;
      }
    }
    return -1;
  }

  /* ---------------- 选项切分 ---------------- */

  function splitOptions(text) {
    var found = [];
    var searchFrom = 0;
    for (var i = 0; i < OPTS_LETTERS.length; i++) {
      var L = OPTS_LETTERS[i];
      var re = new RegExp('(^|[\\s（(])[' + L + toHalfInv(L) + ']\\s*[.．、,，:：)）]\\s*', 'g');
      re.lastIndex = searchFrom;
      var m = re.exec(text);
      if (!m) break;
      var after = text.slice(m.index + m[0].length);
      if (!after.trim()) break;
      found.push({ letter: L, start: m.index + m[1].length, contentStart: m.index + m[0].length });
      searchFrom = m.index + m[0].length;
    }
    if (found.length < 2) return { stem: text, options: [] };

    var opts = [];
    for (var j = 0; j < found.length; j++) {
      var cs = found[j].contentStart;
      var ce = j + 1 < found.length ? found[j + 1].start : text.length;
      opts.push({ key: found[j].letter, text: tidy(text.slice(cs, ce)) });
    }
    if (opts.some(function (o) { return !o.text; })) {
      var valid = opts.filter(function (o) { return o.text; });
      if (valid.length < 2) return { stem: text, options: [] };
      opts = valid;
    }
    return { stem: text.slice(0, found[0].start).trim(), options: opts };
  }

  var HALF_INV = { A: 'Ａ', B: 'Ｂ', C: 'Ｃ', D: 'Ｄ', E: 'Ｅ', F: 'Ｆ', G: 'Ｇ', H: 'Ｈ' };
  function toHalfInv(L) { return HALF_INV[L] || ''; }

  /* ---------------- 答案归一化 ---------------- */

  function normalizeAnswer(raw, options) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return { answer: '', type: '' };
    s = s.replace(/^[:：\s]+/, '');
    s = s.split(/[【\[]/)[0].trim();
    var compact = s.replace(/[\s,，、;；\/|·]/g, '').toUpperCase();

    var optCount = options ? options.length : 0;

    // 判断题（无选项或仅两选项）
    if (optCount <= 2) {
      if (/^(√|✓|☑|对的?|正确|是|T|TRUE|Y|YES)$/.test(compact)) {
        return { answer: optCount === 2 ? options[0].key : '正确', type: 'judge' };
      }
      if (/^(×|X|✗|☒|错的?|错误|否|F|FALSE|N|NO)$/.test(compact)) {
        return { answer: optCount === 2 ? options[1].key : '错误', type: 'judge' };
      }
    }

    var letters = compact.match(/[A-H]/g);
    if (letters && letters.length) {
      var uniq = [];
      letters.forEach(function (L) { if (uniq.indexOf(L) < 0) uniq.push(L); });
      uniq.sort();
      return { answer: uniq.join(''), type: uniq.length > 1 ? 'multi' : 'single' };
    }
    return { answer: tidy(raw).replace(/^[:：\s]+/, ''), type: 'fill' };
  }

  // 从解析文字里兜底找答案：「故选B」「答案为C」
  function answerFromAnalysis(analysis) {
    var m = String(analysis || '').match(/(?:故|应|因|所以)?\s*(?:答案|选项)?\s*(?:应)?(?:选|是|为)\s*([A-H]{1,6})(?![A-Za-z\u4e00-\u9fa5])/);
    if (m) return m[1];
    var m2 = String(analysis || '').match(/正确答案(?:应)?(?:是|为|选)\s*[：:]?\s*([A-H]{1,6})/);
    return m2 ? m2[1] : '';
  }

  /* ---------------- 单块 -> 题目 ---------------- */

  function parseBlock(rawLines, num, ctx) {
    var lines = rawLines.slice();
    var body = [], answerRaw = '', analysis = '';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      var am = line.match(RE_ANALYSIS_HEAD);
      if (am && am[0].length > 0) {
        analysis = [line.slice(am[0].length)].concat(lines.slice(i + 1)).join('\n');
        break;
      }

      var anm = line.match(RE_ANSWER_HEAD);
      if (anm && anm[0].length > 0) {
        var val = line.slice(anm[0].length).trim();
        var inlineAna = val.match(/^(.*?)\s*[【\[]?\s*(?:解\s*析|分\s*析)\s*[】\]]?\s*[:：]?\s*([\s\S]*)$/);
        if (inlineAna && inlineAna[2]) {
          answerRaw = answerRaw || inlineAna[1];
          analysis = analysis || inlineAna[2];
        } else {
          answerRaw = answerRaw || val;
        }
        continue;
      }
      body.push(line);
    }

    var bodyText = body.join('\n');

    // 行尾括号答案：「……（ B ）」
    if (!answerRaw) {
      var trail = bodyText.match(/[（(]\s*([A-HＡ-Ｈ]{1,6}|√|×|对|错)\s*[)）]\s*$/);
      if (trail && toHalf(trail[1]).length <= 6) {
        answerRaw = toHalf(trail[1]);
        bodyText = bodyText.slice(0, trail.index).trim();
      }
    }

    // 行内答案：「…… 答案：B」
    if (!answerRaw) {
      var m2 = bodyText.match(/[【\[]?\s*答\s*案\s*[】\]]?\s*[:：]\s*([A-H]{1,6}|√|×|对|错)\s*$/);
      if (m2) { answerRaw = m2[1]; bodyText = bodyText.replace(m2[0], '').trim(); }
    }

    var so = splitOptions(bodyText);
    var stem = so.stem, options = so.options;

    if (!stem && !options.length) return null;

    var na = normalizeAnswer(answerRaw, options);
    var typeTag = (ctx.typeTag || '');
    var type = na.type || (options.length ? 'single' : 'fill');

    if (typeTag) {
      if (/多选|不定项/.test(typeTag)) type = 'multi';
      else if (/判断/.test(typeTag)) type = 'judge';
      else if (/填空|简答|论述|案例|名词解释|计算/.test(typeTag)) type = 'fill';
      else if (/单选/.test(typeTag)) type = 'single';
    }
    if (options.length === 2 && /^(正确|对|是)$/.test(options[0].text) && /^(错误|错|否)$/.test(options[1].text)) {
      type = 'judge';
    }

    // 无选项、题干带（ ）、又没文字答案 -> 判断题
    if (!options.length && !typeTag && na.type !== 'fill' && /[（(][\s]{0,8}[)）]/.test(stem)) {
      type = 'judge';
    }

    // 无答案时从解析兜底
    if (!answerRaw && analysis) {
      var fromAna = answerFromAnalysis(analysis);
      if (fromAna) {
        var na2 = normalizeAnswer(fromAna, options);
        if (!na.answer) { na = na2; if (!typeTag) type = na.type || type; }
      }
    }

    // 答案字母校准
    if (options.length && /^[A-H]+$/.test(na.answer)) {
      var ok = na.answer.split('').every(function (L) {
        return options.some(function (o) { return o.key === L; });
      });
      if (!ok) {
        var mapped = na.answer.split('')
          .map(function (L) { return L.charCodeAt(0) - 65; })
          .filter(function (x) { return x < options.length; })
          .map(function (x) { return options[x].key; });
        na.answer = mapped.join('');
      }
      if (na.answer.length > 1) type = 'multi';
    }

    return {
      num: num,
      type: type,
      stem: tidy(stem),
      options: options,
      answer: na.answer,
      analysis: tidyMulti(analysis),
      section: ctx.section || ''
    };
  }

  /* ---------------- 主解析入口 ---------------- */

  function parseText(text, opts) {
    opts = opts || {};
    var lines = stripHeaders(toLines(text));
    if (!lines.length) return { questions: [], warnings: ['没有读到任何文字内容'] };

    var warnings = [];
    var answerKey = extractAnswerKey(lines);
    var keyIdx = answerKey ? findAnswerKeyIndex(lines) : -1;
    var scanLines = keyIdx > 0 ? lines.slice(0, keyIdx) : lines;

    var blocks = [], cur = null, section = '', preamble = [];

    for (var i = 0; i < scanLines.length; i++) {
      var line = scanLines[i];
      var qm = matchQNum(line);
      var opt = matchOption(line);

      if (qm && !opt) {
        var n = qm.num;
        var curHasOpt = cur && cur.lines.some(function (l) { return !!matchOption(l); });
        var reasonable = !cur || n > cur.num || (n !== cur.num && (n <= 3 || curHasOpt));
        if (reasonable) {
          if (cur) blocks.push(cur);
          var tag = line.match(RE_TYPE_TAG);
          cur = {
            num: n,
            lines: qm.rest ? [qm.rest] : [],
            section: section,
            typeTag: tag ? tag[0] : ''
          };
          preamble = [];
          continue;
        }
      }

      // 章节标题
      if (!qm && !opt && line.length < 46 && RE_SECTION.test(line)) {
        if (cur) { blocks.push(cur); cur = null; }
        section = tidy(line);
        continue;
      }

      if (!cur) { preamble.push(line); continue; }
      cur.lines.push(line);
    }
    if (cur) blocks.push(cur);

    // 没有识别出题号结构 -> 按选项块切分
    if (blocks.length === 0) {
      blocks = splitByOptionBlocks(scanLines, section);
      if (blocks.length) warnings.push('未识别到题号，已按选项块自动切分，建议抽查');
    }

    var questions = [];
    blocks.forEach(function (b) {
      var q = parseBlock(b.lines, b.num, b);
      if (!q) return;
      if (!q.stem && q.options.length < 2) return;
      questions.push(q);
    });

    // 回填卷末答案
    if (answerKey) {
      var filled = 0;
      questions.forEach(function (q) {
        var v = answerKey[q.num];
        if (v && !q.answer) {
          var na = normalizeAnswer(v, q.options);
          q.answer = na.answer;
          if (!q.options.length && na.type) q.type = na.type;
          filled++;
        }
      });
      if (filled) warnings.push('已从卷末「参考答案」回填 ' + filled + ' 道题的答案');
    }

    questions = questions.filter(function (q) { return q.stem || q.options.length >= 2; });
    questions.forEach(function (q, i) {
      q.id = 'q' + (i + 1) + '_' + hash(q.stem + '|' + (q.options[0] ? q.options[0].text : ''));
    });
    finalize(questions);

    var noAns = questions.filter(function (q) { return !q.answer; }).length;
    if (noAns) warnings.push(noAns + ' 道题未识别到答案，可用「编辑」补全，或仅用于记忆背诵');

    // 乱码检测：PDF 字体缺少标准编码时会出现私用区字符
    var garble = questions.filter(function (q) {
      var t = q.stem + q.options.map(function (o) { return o.text; }).join('');
      return /[\uE000-\uF8FF\uFFFD]{2,}/.test(t);
    }).length;
    if (questions.length && garble > questions.length * 0.3) {
      warnings.push('检测到大量乱码字符，该 PDF 可能未嵌入标准字体编码。建议另存为 Word/Excel 后导入，或先用 OCR 工具转换。');
    }

    if (!questions.length) {
      warnings.push('未能识别出题目结构。若为扫描件（图片版 PDF）需先 OCR；也可改用 Excel / TXT 导入。');
    }

    return { questions: questions, warnings: warnings };
  }

  function splitByOptionBlocks(lines, section) {
    var blocks = [], cur = null, num = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var opt = matchOption(line);
      var startsA = opt && opt.key === 'A';
      var hasOpt = cur && cur.lines.some(function (l) { return !!matchOption(l); });
      if (startsA && hasOpt) { blocks.push(cur); cur = null; }
      if (!cur) { num++; cur = { num: num, lines: [], section: section, typeTag: '' }; }
      cur.lines.push(line);
    }
    if (cur) blocks.push(cur);
    return blocks;
  }

  function hash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---------------- 结构化导入（Excel / CSV） ---------------- */

  function parseTable(rows) {
    if (!rows || !rows.length) return { questions: [], warnings: ['表格为空'] };
    var header = rows[0].map(function (h) { return tidy(h); });
    var lower = header.map(function (h) { return h.toLowerCase(); });

    function find(keys) {
      for (var i = 0; i < lower.length; i++) {
        for (var j = 0; j < keys.length; j++) {
          if (lower[i].indexOf(keys[j]) >= 0) return i;
        }
      }
      return -1;
    }
    var iStem = find(['题干', '题目', '问题', 'question', 'stem', '内容']);
    var iAns = find(['答案', 'answer']);
    var iAna = find(['解析', '分析', 'analysis', '说明', '解释']);
    var iType = find(['题型', 'type']);
    var iSec = find(['章节', '分类', '科目', 'section', 'category', '知识点']);

    var optCols = [];
    for (var c = 0; c < header.length; c++) {
      var m = lower[c].match(/(?:选项|option)\s*([a-h])$/) || lower[c].match(/^([a-h])$/);
      if (m) optCols.push({ col: c, key: m[1].toUpperCase() });
    }
    if (!optCols.length && iStem >= 0) {
      for (var c2 = iStem + 1; c2 < Math.min(header.length, iStem + 9); c2++) {
        if (iAns === c2 || iAna === c2) break;
        if (/^[a-h]$/.test(lower[c2]) || /选项/.test(lower[c2])) {
          optCols.push({ col: c2, key: 'ABCDEFGH'[optCols.length] });
        }
      }
    }
    optCols.sort(function (a, b) { return a.key < b.key ? -1 : 1; });

    if (iStem < 0) return { questions: [], warnings: ['未找到「题干」列，请确认表头包含 题干/题目/问题 等字样'] };

    var questions = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || !row.length) continue;
      var stem = tidy(row[iStem] || '');
      if (!stem) continue;
      var options = optCols.map(function (o) {
        return { key: o.key, text: tidy(row[o.col] || '') };
      }).filter(function (o) { return o.text; });

      var rawAns = iAns >= 0 ? tidy(row[iAns] || '') : '';
      var na = normalizeAnswer(rawAns, options);
      var type = iType >= 0 ? tidy(row[iType] || '') : '';
      if (/多选|不定项/.test(type)) na.type = 'multi';
      else if (/判断/.test(type)) na.type = 'judge';
      else if (/填空|简答|论述/.test(type)) na.type = 'fill';
      if (!na.type) na.type = options.length ? 'single' : 'fill';

      questions.push({
        id: 'q' + (questions.length + 1) + '_' + hash(stem),
        num: questions.length + 1,
        type: na.type,
        stem: stem,
        options: options,
        answer: na.answer,
        analysis: iAna >= 0 ? tidy(row[iAna] || '') : '',
        section: iSec >= 0 ? tidy(row[iSec] || '') : ''
      });
    }
    var warnings = [];
    if (!questions.length) warnings.push('表格中没有读到有效题目');
    return { questions: finalize(questions), warnings: warnings };
  }

  /* ---------------- 收尾标准化 ---------------- */

  // 判断题无选项时补上「正确/错误」两个虚拟选项，让交互与选择题统一
  function finalize(qs) {
    qs.forEach(function (q) {
      if (q.type === 'judge' && (!q.options || q.options.length === 0)) {
        q.options = [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }];
        if (/^(正确|对|是|√|✓|T|TRUE)$/i.test(q.answer)) q.answer = 'A';
        else if (/^(错误|错|否|×|X|F|FALSE)$/i.test(q.answer)) q.answer = 'B';
        else if (!q.answer) q.answer = '';
      }
      q.options = q.options || [];
      q.answer = q.answer || '';
      q.analysis = q.analysis || '';
      q.stem = q.stem || '';
    });
    return qs;
  }

  /* ---------------- JSON 导入 ---------------- */

  function parseJSON(arr) {
    var warnings = [];
    if (!Array.isArray(arr)) return { questions: [], warnings: ['JSON 顶层需要是数组'] };
    var questions = [];
    arr.forEach(function (raw, i) {
      if (!raw || typeof raw !== 'object') return;
      var stem = tidy(raw.stem || raw.question || raw.q || raw.title || raw.content || '');
      if (!stem) return;

      var options = [];
      var ro = raw.options || raw.opts || raw.choices;
      if (Array.isArray(ro)) {
        ro.forEach(function (o, k) {
          if (o && typeof o === 'object') {
            options.push({ key: String(o.key || o.letter || 'ABCDEFGH'[k]).toUpperCase(), text: tidy(o.text || o.value || o.content || '') });
          } else {
            var s = tidy(String(o));
            var m = s.match(/^([A-H])\s*[.．、,，:：)）]\s*(.*)$/);
            if (m) options.push({ key: m[1], text: tidy(m[2]) });
            else options.push({ key: 'ABCDEFGH'[k], text: s });
          }
        });
      } else if (ro && typeof ro === 'object') {
        Object.keys(ro).forEach(function (k) {
          options.push({ key: k.toUpperCase(), text: tidy(ro[k]) });
        });
      }
      options = options.filter(function (o) { return o.text; });

      var rawAns = String(raw.answer != null ? raw.answer : (raw.a != null ? raw.a : (raw.correct != null ? raw.correct : '')));
      var na = normalizeAnswer(rawAns, options);
      var type = String(raw.type || '');
      if (/多选|multi/i.test(type)) na.type = 'multi';
      else if (/判断|judge|bool/i.test(type)) na.type = 'judge';
      else if (/填空|简答|fill|short/i.test(type)) na.type = 'fill';
      if (!na.type) na.type = options.length ? 'single' : 'fill';

      questions.push({
        id: 'q' + (questions.length + 1) + '_' + hash(stem),
        num: questions.length + 1,
        type: na.type,
        stem: stem,
        options: options,
        answer: na.answer,
        analysis: tidy(raw.analysis || raw.explain || raw.explanation || raw.analyze || ''),
        section: tidy(raw.section || raw.category || raw.chapter || '')
      });
    });
    if (!questions.length) warnings.push('JSON 中没有读到有效题目');
    return { questions: finalize(questions), warnings: warnings };
  }

  /* ---------------- 质量评估 ---------------- */

  function audit(questions) {
    var total = questions.length;
    var withOpt = 0, withAns = 0, withAna = 0, multi = 0, judge = 0, fill = 0;
    questions.forEach(function (q) {
      if (q.options.length >= 2) withOpt++;
      if (q.answer) withAns++;
      if (q.analysis) withAna++;
      if (q.type === 'multi') multi++;
      else if (q.type === 'judge') judge++;
      else if (q.type === 'fill' || q.type === 'short') fill++;
    });
    return {
      total: total,
      optionRate: total ? withOpt / total : 0,
      answerRate: total ? withAns / total : 0,
      analysisRate: total ? withAna / total : 0,
      multi: multi, judge: judge, fill: fill,
      choice: withOpt
    };
  }

  return {
    parseText: parseText,
    parseTable: parseTable,
    parseJSON: parseJSON,
    finalize: finalize,
    audit: audit,
    splitOptions: splitOptions,
    normalizeAnswer: normalizeAnswer,
    matchQNum: matchQNum,
    matchOption: matchOption,
    tidy: tidy,
    toHalf: toHalf,
    _internal: {
      toLines: toLines, stripHeaders: stripHeaders,
      extractAnswerKey: extractAnswerKey, parseBlock: parseBlock
    }
  };
});
