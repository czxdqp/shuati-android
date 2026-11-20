/* ============================================================
 * 刷题助手 · 主应用逻辑
 * ============================================================ */
(function () {
  'use strict';

  /* ================= 工具 ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function stemHTML(s) {
    return h(s).replace(/[（(]\s{0,8}[)）]/g, '<span class="blank">（ 　 ）</span>');
  }

  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2000);
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60), r = s % 60;
    return m > 0 ? m + ' 分 ' + r + ' 秒' : r + ' 秒';
  }
  function fmtDate(ts) {
    var d = new Date(ts), n = new Date();
    if (d.toDateString() === n.toDateString()) {
      return '今天 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  // 章节名去掉括号里的分值说明：「一、单项选择题（每题1分）」→「一、单项选择题」
  function shortSection(s) {
    return String(s || '').replace(/[（(].*$/, '').trim();
  }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9L12 3z"/></svg>',
    starOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9L12 3z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 008 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1A1.6 1.6 0 004.6 8a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5V5.5z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5"/><path d="M9 7h7M9 11h5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3l1.7 4.6L17.3 9.3l-4.6 1.7L11 15.6 9.3 11 4.7 9.3 9.3 7.6z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 114 2c-.8.6-1.5 1.1-1.5 2"/><path d="M12 17h.01"/></svg>'
  };

  /* ================= 状态 ================= */
  var S = {
    banks: [],
    settings: {},
    curBank: null,
    prog: null,
    sess: null,
    sheet: null,
    aiCfg: null,
    aiRun: null
  };

  function todayStart() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /* ================= 视图切换 ================= */
  function showView(id) {
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'v-' + id); });
  }

  /* ================= 弹层 ================= */
  function openSheet(html, opts) {
    opts = opts || {};
    var mask = $('#mask'), sh = $('#sheet');
    sh.innerHTML = '<div class="sh-bar"><i></i></div>' + html;
    sh.classList.add('show');
    mask.classList.add('show');
    S.sheet = opts;
  }
  function closeSheet() {
    $('#sheet').classList.remove('show');
    $('#mask').classList.remove('show');
    S.sheet = null;
  }

  /* ================= 首页 ================= */
  async function loadHome() {
    var list = await Store.listBanks();
    var progs = await Store.getAllProgress();
    var pMap = {};
    progs.forEach(function (p) { pMap[p.bankId] = p; });

    S.banks = list;
    S.progMap = pMap;

    var totalQ = 0, totalDone = 0, totalOk = 0, todayDone = 0;
    var t0 = todayStart();

    list.forEach(function (b) {
      totalQ += b.count || 0;
      var p = pMap[b.id];
      if (!p || !p.rec) return;
      Object.keys(p.rec).forEach(function (k) {
        var r = p.rec[k];
        if (r.ok === 1 || r.ok === 0) totalDone++;
        if (r.ok === 1) totalOk++;
        if (r.t >= t0) todayDone++;
      });
    });

    var acc = totalDone ? Math.round(totalOk / totalDone * 100) : 0;

    var html = '';
    html += '<div class="topbar">' +
      '<h1>刷题助手</h1>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn" data-act="settings" title="设置">' + ICON.gear + '</button>' +
      '</div>';

    html += '<div class="scroll" id="homeScroll"><div class="home-wrap">';

    // Hero
    var bigVal, bigSub, heroTop;
    if (!list.length) {
      bigVal = '0'; bigSub = '道题'; heroTop = '导入题库，开始刷题';
    } else if (!totalDone) {
      bigVal = totalQ; bigSub = '道题待练习'; heroTop = '今日已练 ' + todayDone + ' 题';
    } else {
      bigVal = acc; bigSub = '% 正确率'; heroTop = '今日已练 ' + todayDone + ' 题';
    }

    html += '<div class="hero">' +
      '<div class="h-top">' + ICON.clock + '<span>' + heroTop + '</span></div>' +
      '<div class="big">' + bigVal + '<small>' + bigSub + '</small></div>' +
      '<div class="stats">' +
      '<div><b>' + list.length + '</b>题库</div>' +
      '<div><b>' + totalQ + '</b>总题数</div>' +
      '<div><b>' + totalDone + '</b>已作答</div>' +
      '</div></div>';

    // 列表
    html += '<div class="section-head"><h2>我的题库</h2><div class="count">' + (list.length || '') + '</div></div>';

    if (!list.length) {
      html += '<div class="empty">' +
        '<div class="ico">' + ICON.book + '</div>' +
        '<h3>还没有题库</h3>' +
        '<p>导入 PDF、Word、Excel 或 TXT 题库文件<br>系统会自动识别题目、选项、答案与解析</p>' +
        '<button class="btn" data-act="import">' + ICON.upload + '导入题库</button>' +
        '</div>';
    } else {
      list.forEach(function (b) {
        html += bankCard(b, pMap[b.id]);
      });
      html += '<div style="height:8px"></div>';
    }

    html += '</div></div>';
    if (list.length) html += '<button class="fab" data-act="import">' + ICON.plus + '导入题库</button>';

    $('#v-home').innerHTML = html;

    var sc = $('#homeScroll');
    if (sc) sc.addEventListener('scroll', function () {
      var tb = $('#v-home .topbar');
      if (tb) tb.classList.toggle('scrolled', sc.scrollTop > 4);
    });
  }

  function bankCard(b, p) {
    var done = 0, ok = 0, wrong = 0;
    if (p && p.rec) {
      Object.keys(p.rec).forEach(function (k) {
        var r = p.rec[k];
        if (r.ok === 1) { ok++; done++; }
        else if (r.ok === 0) { wrong++; done++; }
      });
    }
    var pct = b.count ? Math.round(done / b.count * 100) : 0;
    var accTxt = done ? Math.round(ok / Math.max(1, done) * 100) + '% 正确' : '未开始';

    var tags = '';
    if (b.count) tags += '<span class="tag blue">' + b.count + ' 题</span>';
    if (wrong) tags += '<span class="tag warn">错题 ' + wrong + '</span>';
    if (p && p.fav && Object.keys(p.fav).length) tags += '<span class="tag">收藏 ' + Object.keys(p.fav).length + '</span>';
    if (b.source) tags += '<span class="tag">' + h(b.source) + '</span>';

    return '<div class="bank" data-act="openbank" data-id="' + b.id + '">' +
      '<div class="b-head"><div class="b-name">' + h(b.name) + '</div>' +
      '<button class="icon-btn" data-act="bankmenu" data-id="' + b.id + '" style="margin:-6px -8px 0 0">' + ICON.more + '</button>' +
      '</div>' +
      '<div class="b-meta">' + tags + '</div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="b-foot"><div class="b-stat">已练 <b>' + done + '</b> / ' + b.count + ' 题 · ' + accTxt + '</div>' +
      '<button class="btn sm soft" data-act="openbank" data-id="' + b.id + '">' + (done ? '继续练习' : '开始练习') + '</button>' +
      '</div></div>';
  }

  /* ================= 练习设置 ================= */
  async function openBank(id) {
    var bank = await Store.getBank(id);
    if (!bank) return toast('题库不存在');
    S.curBank = bank;
    S.prog = await Store.getProgress(id);

    var p = S.prog;
    var wrongN = 0, favN = 0, doneN = 0;
    Object.keys(p.rec || {}).forEach(function (k) {
      if (p.rec[k].ok === 0) wrongN++;
      if (p.rec[k].ok === 0 || p.rec[k].ok === 1) doneN++;
    });
    favN = Object.keys(p.fav || {}).length;

    var a = Parse.audit(bank.questions);
    var types = [];
    var hasSingle = bank.questions.some(function (q) { return q.type === 'single'; });
    var hasMulti = bank.questions.some(function (q) { return q.type === 'multi'; });
    var hasJudge = bank.questions.some(function (q) { return q.type === 'judge'; });
    var hasFill = bank.questions.some(function (q) { return q.type === 'fill' || q.type === 'short'; });
    if (hasSingle) types.push('single');
    if (hasMulti) types.push('multi');
    if (hasJudge) types.push('judge');
    if (hasFill) types.push('fill');

    var html = '<div class="sh-head"><h3>' + h(bank.name) + '</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body">' +
      '<div class="preview-stats">' +
      '<div class="pv"><b>' + bank.count + '</b><span>总题数</span></div>' +
      '<div class="pv good"><b>' + doneN + '</b><span>已作答</span></div>' +
      '<div class="pv warn"><b>' + wrongN + '</b><span>错题</span></div>' +
      '</div>';

    html += '<div class="field"><label>练习模式</label><div class="mode-list">';

    var modes = [
      { k: 'seq', t: '顺序练习', d: '按题库原始顺序逐题作答', n: a.total },
      { k: 'random', t: '随机练习', d: '打乱顺序，检验真实掌握程度', n: a.total }
    ];
    if (wrongN) modes.push({ k: 'wrong', t: '错题重练', d: '只练做错过的题，攻克薄弱点', n: wrongN });
    if (favN) modes.push({ k: 'fav', t: '收藏练习', d: '只练你收藏标记的题目', n: favN });
    modes.push({ k: 'new', t: '未做题', d: '跳过已作答的题目', n: Math.max(0, a.total - doneN) });

    // 有进度且还有没做的题 -> 默认「继续未做」
    var defMode = (doneN > 0 && doneN < a.total) ? 'new' : 'seq';

    modes.forEach(function (m, i) {
      html += '<button class="mode-item' + (m.k === defMode ? ' sel' : '') + '" data-act="pickmode" data-mode="' + m.k + '" data-n="' + m.n + '">' +
        '<div class="mi-t">' + m.t + '</div><div class="mi-d">' + m.d + '</div>' +
        '<div class="mi-n">' + m.n + '</div></button>';
    });
    html += '</div></div>';

    if (types.length > 1) {
      html += '<div class="field"><label>题型筛选</label><div class="chips" id="typeFilter">';
      html += '<button class="chip on" data-type="all">全部</button>';
      if (hasSingle) html += '<button class="chip" data-type="single">单选</button>';
      if (hasMulti) html += '<button class="chip" data-type="multi">多选</button>';
      if (hasJudge) html += '<button class="chip" data-type="judge">判断</button>';
      if (hasFill) html += '<button class="chip" data-type="fill">填空/简答</button>';
      html += '</div></div>';
    }

    html += '</div><div class="sh-foot">' +
      '<button class="btn ghost" data-act="editbank" data-id="' + bank.id + '">管理题库</button>' +
      '<button class="btn" style="flex:2" data-act="startquiz">开始练习</button>' +
      '</div>';

    openSheet(html);
    S.pickMode = defMode;
    S.pickType = 'all';
  }

  /* ================= 开始会话 ================= */
  function startQuiz() {
    var bank = S.curBank, prog = S.prog;
    if (!bank) return;
    var mode = S.pickMode || 'seq';
    var tf = S.pickType || 'all';

    var pool = bank.questions.map(function (q, i) { return i; });

    if (tf !== 'all') {
      pool = pool.filter(function (i) {
        var t = bank.questions[i].type;
        if (tf === 'fill') return t === 'fill' || t === 'short';
        return t === tf;
      });
    }
    if (mode === 'wrong') {
      pool = pool.filter(function (i) { return prog.rec[bank.questions[i].id] && prog.rec[bank.questions[i].id].ok === 0; });
    } else if (mode === 'fav') {
      pool = pool.filter(function (i) { return prog.fav[bank.questions[i].id]; });
    } else if (mode === 'new') {
      pool = pool.filter(function (i) { var r = prog.rec[bank.questions[i].id]; return !r || (r.ok !== 0 && r.ok !== 1); });
    }
    if (!pool.length) return toast('该条件下没有题目');

    if (mode === 'random') {
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
    }

    S.sess = {
      bank: bank,
      prog: prog,
      mode: mode,
      typeFilter: tf,
      queue: pool,
      pos: 0,
      answers: {},
      startAt: Date.now(),
      modeName: ({ seq: '顺序练习', random: '随机练习', wrong: '错题重练', fav: '收藏练习', new: '未做题' })[mode]
    };
    closeSheet();
    showView('quiz');
    renderQuiz();
  }

  /* ================= 渲染答题页 ================= */
  function renderQuiz() {
    var s = S.sess;
    if (!s) return;
    var q = s.bank.questions[s.queue[s.pos]];
    var total = s.queue.length;

    var html = '<div class="topbar quiz-top">' +
      '<button class="icon-btn" data-act="quitquiz">' + ICON.back + '</button>' +
      '<div style="min-width:0"><div class="q-title">' + s.modeName + '</div></div>' +
      '<div class="spacer"></div>' +
      '<button class="icon-btn' + (s.prog.fav[q.id] ? ' on' : '') + '" id="btnFav" data-act="fav">' +
      (s.prog.fav[q.id] ? ICON.starOn : ICON.star) + '</button>' +
      '<button class="icon-btn" data-act="qmenu">' + ICON.more + '</button>' +
      '</div>' +
      '<div class="qprog"><i id="qProg" style="width:' + ((s.pos) / total * 100) + '%"></i></div>' +
      '<div class="scroll" id="qScroll"><div class="qbody" id="qBody"></div></div>' +
      '<div class="quiz-foot" id="qFoot"></div>';

    $('#v-quiz').innerHTML = html;
    paintQuestion();
  }

  function paintQuestion() {
    var s = S.sess;
    var q = s.bank.questions[s.queue[s.pos]];
    var total = s.queue.length;
    var ans = s.answers[s.queue[s.pos]];
    var showFb = ans && S.settings.instant;
    var isJudge = q.type === 'judge';
    var sel = ans ? ans.picked : '';
    var selArr = sel ? sel.split('') : [];

    var typeName = { single: '单选题', multi: '多选题', judge: '判断题', fill: '填空题', short: '简答题' }[q.type] || '选择题';

    var body = '<div class="qindex">' +
      '<span class="n">' + (s.pos + 1) + ' / ' + total + '</span>' +
      '<span class="t">' + typeName + '</span>' +
      (q.section ? '<span class="t sec">· ' + h(shortSection(q.section)) + '</span>' : '') +
      '</div>';
    body += '<div class="stem">' + stemHTML(q.stem) + '</div>';

    // 填空题 / 简答题：无选项，直接展示参考答案
    if (!q.options.length) {
      if (!s.answers[s.queue[s.pos]]) {
        s.answers[s.queue[s.pos]] = { picked: '', ok: 2, t: Date.now() };
      }
      body += '<div class="feedback none">' +
        '<div class="fb-head">' + ICON.info + '填空题 / 简答题</div>' +
        '<div class="fb-ans">参考答案：<b>' + (q.answer ? h(q.answer) : '未收录') + '</b></div>' +
        (q.analysis ? '<div class="fb-ana"><span class="lb">解析</span><br>' + h(q.analysis) + '</div>' : '') +
        '</div>';
      $('#qBody').innerHTML = body;
      $('#qProg').style.width = ((s.pos + 1) / total * 100) + '%';
      $('#qFoot').innerHTML =
        '<button class="btn ghost" data-act="prev" ' + (s.pos === 0 ? 'disabled' : '') + '>上一题</button>' +
        '<button class="btn" data-act="next">' + (s.pos === total - 1 ? '完成练习' : '下一题') + '</button>' +
        '<button class="icon-btn" data-act="cards" title="答题卡">' + ICON.cards + '</button>';
      var sc0 = $('#qScroll');
      if (sc0) sc0.scrollTop = 0;
      return;
    }

    body += '<div class="options" id="optWrap">';

    q.options.forEach(function (o) {
      var cls = 'opt';
      if (isJudge && q.options.length === 2) cls += ' judge';
      var marked = '';
      if (showFb) {
        var isRight = q.answer && q.answer.indexOf(o.key) >= 0;
        var isPicked = selArr.indexOf(o.key) >= 0;
        if (isRight) { cls += ' right'; marked = '<span class="mark">' + ICON.check + '</span>'; }
        if (isPicked && !isRight) { cls += ' wrong'; marked = '<span class="mark">' + ICON.x + '</span>'; }
        if (!isRight && !isPicked) cls += ' muted';
      } else if (selArr.indexOf(o.key) >= 0) {
        cls += ' sel';
      }
      body += '<button class="' + cls + '" data-act="pick" data-key="' + o.key + '">' +
        '<span class="k">' + o.key + '</span><span class="tx">' + h(o.text) + '</span>' + marked + '</button>';
    });
    body += '</div>';

    if (showFb) body += feedbackHTML(q, ans);
    else if (s._peek === q.id && q.analysis) body += anaOnlyHTML(q);

    $('#qBody').innerHTML = body;
    $('#qProg').style.width = ((s.pos + 1) / total * 100) + '%';

    // 底栏
    var foot = '';
    if (!showFb && q.type === 'multi') {
      foot = '<button class="icon-btn" data-act="prev">' + ICON.back + '</button>' +
        '<button class="btn" id="btnConfirm" data-act="confirm" ' + (selArr.length ? '' : 'disabled') + '>确认答案</button>' +
        '<button class="icon-btn" data-act="cards">' + ICON.cards + '</button>';
    } else {
      foot = '<button class="btn ghost" data-act="prev" ' + (s.pos === 0 ? 'disabled' : '') + '>上一题</button>' +
        '<button class="btn" data-act="next">' + (s.pos === total - 1 ? '完成练习' : '下一题') + '</button>' +
        '<button class="icon-btn" data-act="cards" title="答题卡">' + ICON.cards + '</button>';
    }
    $('#qFoot').innerHTML = foot;

    var sc = $('#qScroll');
    if (sc) sc.scrollTop = 0;
  }

  /* 未作答时单独展示解析 */
  function anaOnlyHTML(q) {
    return '<div class="feedback none">' +
      '<div class="fb-head">' + ICON.spark + '解析</div>' +
      '<div class="fb-ana">' + h(q.analysis) + '</div>' +
      '</div>';
  }

  function feedbackHTML(q, ans) {
    if (!q.answer) {
      return '<div class="feedback none">' +
        '<div class="fb-head">' + ICON.info + '本题未收录答案</div>' +
        '<div class="fb-ans">可进入「更多 → 编辑本题」补全答案与解析。</div>' +
        (q.analysis ? '<div class="fb-ana"><span class="lb">解析</span><br>' + h(q.analysis) + '</div>' : '') +
        '</div>';
    }
    var ok = ans.ok === 1;
    var ansText = q.answer.split('').map(function (k) {
      var o = q.options.filter(function (x) { return x.key === k; })[0];
      return k + (o ? '. ' + o.text : '');
    }).join('　');

    return '<div class="feedback ' + (ok ? 'ok' : 'bad') + '">' +
      '<div class="fb-head">' + (ok ? ICON.check : ICON.x) + (ok ? '回答正确' : '回答错误') + '</div>' +
      '<div class="fb-ans">正确答案：<b>' + h(ansText) + '</b></div>' +
      (q.analysis ? '<div class="fb-ana"><span class="lb">解析</span><br>' + h(q.analysis) + '</div>' : '') +
      '</div>';
  }

  /* ================= 作答 ================= */
  function pickOption(key) {
    var s = S.sess;
    if (!s) return;
    var qi = s.queue[s.pos];
    var q = s.bank.questions[qi];
    var existing = s.answers[qi];

    // 已判题则不再响应
    if (existing && S.settings.instant) return;
    if (!q.answer && existing) return;

    if (q.type === 'multi') {
      if (existing) return;
      var cur = s._multiSel || '';
      var arr = cur.split('').filter(Boolean);
      var i = arr.indexOf(key);
      if (i >= 0) arr.splice(i, 1); else arr.push(key);
      arr.sort();
      s._multiSel = arr.join('');
      // 局部更新选中态
      $$('#optWrap .opt').forEach(function (el) {
        el.classList.toggle('sel', arr.indexOf(el.dataset.key) >= 0);
      });
      var b = $('#btnConfirm');
      if (b) b.disabled = arr.length === 0;
      return;
    }

    // 单选 / 判断
    if (existing) return;
    commit(key);
  }

  function commit(picked) {
    var s = S.sess;
    var qi = s.queue[s.pos];
    var q = s.bank.questions[qi];

    var ok = null;
    if (q.answer) {
      ok = normAns(picked) === normAns(q.answer) ? 1 : 0;
    }

    s.answers[qi] = { picked: picked, ok: ok, t: Date.now() };

    // 写入进度
    var rec = s.prog.rec || (s.prog.rec = {});
    var prev = rec[q.id];
    // 只要有一次做对，就记为已掌握；本次做错则记录错误
    var final = ok;
    if (ok === 1) final = 1;
    else if (ok === 0) final = (prev && prev.ok === 1) ? 1 : 0;
    rec[q.id] = { p: picked, ok: ok === null ? 2 : ok, t: Date.now() };
    s.prog.last = { mode: s.mode, pos: s.pos, at: Date.now() };
    Store.saveProgress(s.prog);

    if (S.settings.instant) {
      paintQuestion();
      if (S.settings.autoNext && ok === 1) {
        setTimeout(function () {
          if (S.sess === s) nextQ(true);
        }, 520);
      }
    } else {
      // 考试模式：只更新选项状态
      $$('#optWrap .opt').forEach(function (el) {
        el.classList.toggle('sel', el.dataset.key === picked);
      });
      var b = $('#btnConfirm');
      if (b) b.disabled = false;
    }
  }

  function normAns(v) {
    return String(v || '').toUpperCase().replace(/[^A-H]/g, '').split('').sort().join('');
  }

  function nextQ(silent) {
    var s = S.sess;
    if (!s) return;
    if (s.pos >= s.queue.length - 1) return finishSession();
    s.pos++;
    s._multiSel = '';
    paintQuestion();
    if (!silent) return;
  }

  function prevQ() {
    var s = S.sess;
    if (!s || s.pos === 0) return;
    s.pos--;
    s._multiSel = '';
    paintQuestion();
  }

  function jumpTo(pos) {
    var s = S.sess;
    s.pos = pos;
    s._multiSel = '';
    closeSheet();
    paintQuestion();
  }

  /* ================= 答题卡 ================= */
  function openCards() {
    var s = S.sess;
    var html = '<div class="sh-head"><h3>答题卡</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div><div class="sh-body">';

    var okN = 0, badN = 0, doneN = 0;
    html += '<div class="card-grid">';
    s.queue.forEach(function (qi, i) {
      var a = s.answers[qi];
      var cls = 'cg';
      if (a && a.ok === 1) { cls += ' ok'; okN++; doneN++; }
      else if (a && a.ok === 0) { cls += ' bad'; badN++; doneN++; }
      else if (a) { cls += ' done'; doneN++; }
      if (i === s.pos) cls += ' cur';
      html += '<button class="' + cls + '" data-act="jump" data-pos="' + i + '">' + (i + 1) + '</button>';
    });
    html += '</div>';

    html += '<div class="legend">' +
      '<span><i style="background:var(--ok-soft)"></i>答对 ' + okN + '</span>' +
      '<span><i style="background:var(--bad-soft)"></i>答错 ' + badN + '</span>' +
      '<span><i style="background:var(--bg-soft)"></i>未答 ' + (s.queue.length - doneN) + '</span>' +
      '</div>';
    html += '<div class="note info">' + ICON.info + '<div>点击题号可跳转，练习记录会自动保存。</div></div>';
    html += '</div>';
    openSheet(html);
  }

  /* ================= 结束 ================= */
  function finishSession() {
    var s = S.sess;
    var okN = 0, badN = 0, doneN = 0;
    s.queue.forEach(function (qi) {
      var a = s.answers[qi];
      if (!a) return;
      doneN++;
      if (a.ok === 1) okN++;
      else if (a.ok === 0) badN++;
    });
    var total = s.queue.length;
    var scored = okN + badN;
    var rate = scored ? Math.round(okN / scored * 100) : 0;
    var dur = Date.now() - s.startAt;

    var grade, sub;
    if (rate >= 90) { grade = '太棒了，几乎全对'; sub = '掌握得相当扎实，可以尝试更高的难度了'; }
    else if (rate >= 75) { grade = '不错，接近优秀'; sub = '把错题再过一遍就更稳了'; }
    else if (rate >= 60) { grade = '及格线上'; sub = '建议重点复习错题所在的知识点'; }
    else { grade = '还有提升空间'; sub = '先看解析理解思路，再重做一遍错题'; }

    var C = 2 * Math.PI * 66;
    var off = C * (1 - rate / 100);

    var html = '<div class="topbar">' +
      '<button class="icon-btn" data-act="backhome">' + ICON.back + '</button>' +
      '<h1 style="font-size:16.5px">练习结果</h1>' +
      '<div class="spacer"></div>' +
      '</div>' +
      '<div class="scroll"><div class="result-wrap">' +
      '<div class="score-ring">' +
      '<svg width="158" height="158" viewBox="0 0 158 158">' +
      '<circle cx="79" cy="79" r="66" fill="none" stroke="var(--bg-soft)" stroke-width="12"/>' +
      '<circle cx="79" cy="79" r="66" fill="none" stroke="' + (rate >= 60 ? 'var(--ok)' : 'var(--bad)') + '" stroke-width="12" stroke-linecap="round" ' +
      'stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" id="ringFg" style="transition:stroke-dashoffset .9s ease"/>' +
      '</svg>' +
      '<div class="val"><b>' + rate + '<span style="font-size:16px">%</span></b><span>正确率</span></div>' +
      '</div>' +
      '<div class="result-title">' + grade + '</div>' +
      '<div class="result-sub">' + sub + '</div>' +
      '<div class="result-grid">' +
      '<div class="rg ok"><b>' + okN + '</b><span>答对</span></div>' +
      '<div class="rg bad"><b>' + badN + '</b><span>答错</span></div>' +
      '<div class="rg na"><b>' + (total - doneN) + '</b><span>未答</span></div>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--tx-3);margin-bottom:22px">用时 ' + fmtTime(dur) + ' · 共 ' + total + ' 题</div>' +
      '<div class="result-actions">' +
      (badN ? '<button class="btn" data-act="redoWrong">重做错题（' + badN + ' 道）</button>' : '') +
      '<button class="btn ' + (badN ? 'ghost' : '') + '" data-act="again">再练一遍</button>' +
      '<button class="btn ghost" data-act="backhome">返回首页</button>' +
      '</div></div></div>';

    $('#v-result').innerHTML = html;
    showView('result');
    setTimeout(function () {
      var fg = $('#ringFg');
      if (fg) fg.style.strokeDashoffset = off.toFixed(1);
    }, 60);

    // 保存 last
    Store.saveProgress(S.prog);
  }

  /* ================= 收藏 ================= */
  function toggleFav() {
    var s = S.sess;
    var q = s.bank.questions[s.queue[s.pos]];
    if (s.prog.fav[q.id]) delete s.prog.fav[q.id];
    else s.prog.fav[q.id] = 1;
    Store.saveProgress(s.prog);
    var btn = $('#btnFav');
    if (btn) {
      btn.classList.toggle('on', !!s.prog.fav[q.id]);
      btn.innerHTML = s.prog.fav[q.id] ? ICON.starOn : ICON.star;
    }
    toast(s.prog.fav[q.id] ? '已收藏' : '已取消收藏', 1200);
  }

  /* ================= 导入流程 ================= */
  var imp = { file: null, questions: null, warnings: [], name: '' };

  function openImport() {
    imp = { file: null, questions: null, warnings: [], name: '' };
    var html = '<div class="sh-head"><h3>导入题库</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body" id="impBody">' + importDropHTML() + '</div>' +
      '<div class="sh-foot" id="impFoot">' +
      '<button class="btn ghost" data-act="pasteMode">粘贴文本</button>' +
      '<button class="btn" style="flex:2" data-act="pickfile">选择文件</button>' +
      '</div>';
    openSheet(html);
  }

  function importDropHTML() {
    return '<div class="drop" id="dropZone" data-act="pickfile">' + ICON.upload +
      '<div class="t1">拖拽文件到这里，或点击选择</div>' +
      '<div class="t2">全部在本地解析，文件不会上传到任何服务器</div>' +
      '<div class="formats">' +
      '<span class="tag blue">PDF</span><span class="tag">Word .docx</span>' +
      '<span class="tag">Excel .xlsx</span><span class="tag">CSV</span>' +
      '<span class="tag">TXT / Markdown</span><span class="tag">JSON</span>' +
      '</div></div>' +
      '<div class="note info">' + ICON.info + '<div>PDF 需要是「可复制文字」的版本；扫描件（图片）需先做 OCR 识别。' +
      '每行一道题、选项以 A./B./C./D. 开头、答案写作「答案：B」或「【答案】B」时识别率最高。</div></div>';
  }

  async function handleFile(file) {
    if (!file) return;
    imp.file = file;
    imp.name = file.name.replace(/\.[^.]+$/, '');

    $('#impBody').innerHTML = '<div class="progress-wrap">' +
      '<div class="spin"></div>' +
      '<div class="pt">正在解析…</div>' +
      '<div class="ps" id="impPs">' + h(file.name) + '</div>' +
      '<div class="pbar"><i id="impBar"></i></div>' +
      '</div>';
    $('#impFoot').innerHTML = '<button class="btn ghost block" data-act="closeSheet">取消</button>';

    try {
      var res = await FileImport.readFile(file, function (p, t) {
        var ps = $('#impPs'), bar = $('#impBar');
        if (ps) ps.textContent = '读取第 ' + p + ' / ' + t + ' 页';
        if (bar) bar.style.width = (p / t * 100) + '%';
      });
      var pr = await FileImport.toQuestions(res);
      imp.questions = pr.questions;
      imp.warnings = pr.warnings || [];
      renderPreview();
    } catch (e) {
      $('#impBody').innerHTML = '<div class="note warn">' + ICON.info + '<div><b>解析失败：</b>' +
        h(e.message || e) + '</div></div>' + importDropHTML();
      $('#impFoot').innerHTML = '<button class="btn ghost" data-act="pasteMode">粘贴文本</button>' +
        '<button class="btn" style="flex:2" data-act="pickfile">重新选择文件</button>';
    }
  }

  function renderPreview() {
    var qs = imp.questions || [];
    var a = Parse.audit(qs);

    if (!qs.length) {
      $('#impBody').innerHTML = '<div class="note warn">' + ICON.info +
        '<div><b>没有识别出题目。</b><br>' +
        (imp.warnings.join('；') || '请检查文件格式') + '</div></div>' +
        '<div class="field"><label>或者粘贴文本内容试试</label>' +
        '<textarea class="input" id="pasteBox" placeholder="示例：&#10;1. 企业战略管理的核心是（ ）&#10;A. 提高效率&#10;B. 确定方向&#10;答案：B"></textarea></div>';
      $('#impFoot').innerHTML = '<button class="btn ghost" data-act="pickfile">换个文件</button>' +
        '<button class="btn" style="flex:2" data-act="doPaste">解析粘贴内容</button>';
      return;
    }

    var html = '';
    html += '<div class="preview-stats">' +
      '<div class="pv good"><b>' + a.total + '</b><span>识别题目</span></div>' +
      '<div class="pv ' + (a.answerRate > 0.9 ? 'good' : 'warn') + '"><b>' + Math.round(a.answerRate * 100) + '<span style="font-size:12px">%</span></b><span>答案完整度</span></div>' +
      '<div class="pv"><b>' + a.choice + '</b><span>带选项</span></div>' +
      '</div>';

    var dist = [];
    if (a.multi) dist.push('多选 ' + a.multi);
    if (a.judge) dist.push('判断 ' + a.judge);
    if (a.fill) dist.push('填空 ' + a.fill);
    if (a.choice - a.multi - a.judge > 0) dist.unshift('单选 ' + (a.choice - a.multi - a.judge));
    if (dist.length) {
      html += '<div class="b-meta" style="margin:-6px 0 14px">' +
        dist.map(function (d) { return '<span class="tag">' + d + '</span>'; }).join('') + '</div>';
    }

    html += '<div class="field" style="margin-top:0"><label>预览（前 3 题）</label><div class="pv-list">';
    qs.slice(0, 3).forEach(function (q) {
      html += '<div class="pv-item">' +
        '<div class="pv-q">' + h(q.stem.slice(0, 90)) + (q.stem.length > 90 ? '…' : '') + '</div>' +
        (q.options.length ? '<div class="pv-o">' + q.options.slice(0, 4).map(function (o) {
          return h(o.key + '.' + o.text.slice(0, 14));
        }).join('　') + '</div>' : '') +
        '<div class="pv-a">答案：' + h(q.answer || '未识别') + '</div>' +
        '</div>';
    });
    html += '</div></div>';

    if (imp.warnings.length) {
      html += '<div class="note warn">' + ICON.info + '<div>' + imp.warnings.map(h).join('<br>') + '</div></div>';
    }

    html += '<div class="field"><label>题库名称</label>' +
      '<input class="input" id="impName" value="' + h(imp.name) + '"></div>';

    $('#impBody').innerHTML = html;
    $('#impFoot').innerHTML = '<button class="btn ghost" data-act="pickfile">重新选择</button>' +
      '<button class="btn" style="flex:2" data-act="doImport">导入 ' + qs.length + ' 题</button>';
  }

  async function doImport() {
    var nameEl = $('#impName');
    var name = (nameEl && nameEl.value.trim()) || imp.name || '未命名题库';
    var qs = imp.questions;
    if (!qs || !qs.length) return toast('没有可导入的题目');

    // 保唯一 id
    var seen = {};
    qs.forEach(function (q, i) {
      var base = q.id || ('q' + (i + 1));
      var id = base;
      var n = 1;
      while (seen[id]) { id = base + '_' + (n++); }
      seen[id] = 1;
      q.id = id;
    });

    var bank = {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: (imp.file && imp.file.name) || '手动粘贴',
      questions: qs,
      stats: Parse.audit(qs)
    };

    var btn = $('[data-act="doImport"]');
    if (btn) { btn.disabled = true; btn.textContent = '正在保存…'; }

    try {
      await Store.saveBank(bank);
      await Store.saveProgress({ bankId: bank.id, rec: {}, fav: {}, last: null });
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '重试导入 ' + qs.length + ' 题'; }
      toast('保存失败：' + (e && e.message ? e.message : e) + '（浏览器存储可能已满或处于隐私模式）', 4000);
      return;
    }

    closeSheet();
    toast('已导入「' + name + '」共 ' + qs.length + ' 题');
    await loadHome();
  }

  function pasteMode() {
    var html = '<div class="sh-head"><h3>粘贴题目文本</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body">' +
      '<div class="note info">' + ICON.info + '<div>把题目直接粘贴进来即可，支持「1. 题干 / A. 选项 / 答案：B / 解析：…」这类排版。</div></div>' +
      '<div class="field"><label>题目内容</label>' +
      '<textarea class="input" id="pasteBox" style="min-height:200px" placeholder="1. 企业战略管理的核心是（ ）\nA. 提高生产效率\nB. 确定企业发展方向\nC. 降低产品成本\nD. 扩大市场份额\n【答案】B\n【解析】战略管理关注长期方向。"></textarea></div>' +
      '<div class="field"><label>题库名称</label><input class="input" id="pasteName" placeholder="例如：人力资源管理师（三级）"></div>' +
      '</div>' +
      '<div class="sh-foot"><button class="btn ghost" data-act="closeSheet">取消</button>' +
      '<button class="btn" style="flex:2" data-act="doPaste">解析</button></div>';
    openSheet(html);
  }

  function doPaste() {
    var box = $('#pasteBox');
    var txt = box ? box.value : '';
    if (!txt.trim()) return toast('请先粘贴题目内容');
    var r = Parse.parseText(txt);
    imp.questions = r.questions;
    imp.warnings = r.warnings || [];
    var nm = $('#pasteName');
    imp.name = (nm && nm.value.trim()) || '粘贴题库';
    imp.file = null;

    // 复用预览
    var body = $('.sheet .sh-body');
    if (!r.questions.length) {
      toast('没有识别出题目，请检查格式');
    }
    var html = '<div class="sh-head"><h3>确认导入</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body" id="impBody"></div>' +
      '<div class="sh-foot" id="impFoot"></div>';
    $('.sheet').innerHTML = '<div class="sh-bar"><i></i></div>' + html;
    renderPreview();
  }

  /* ================= 题库管理 ================= */
  function bankMenu(id) {
    var b = S.banks.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var html = '<div class="sh-head"><h3>' + h(b.name) + '</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body" style="padding-bottom:8px">' +
      '<div class="set-item" data-act="rename" data-id="' + id + '" style="cursor:pointer">' +
      '<div class="sl"><div class="t">重命名</div></div>' + ICON.edit + '</div>' +
      '<div class="set-item" data-act="aifill" data-id="' + id + '" style="cursor:pointer">' +
      '<div class="sl"><div class="t">AI 补全解析</div><div class="d">给没有解析或解析太简略的题自动写讲解</div></div>' + ICON.spark + '</div>' +
      '<div class="set-item" data-act="exportbank" data-id="' + id + '" style="cursor:pointer">' +
      '<div class="sl"><div class="t">导出为 JSON</div><div class="d">可备份或分享给他人</div></div>' + ICON.upload + '</div>' +
      '<div class="set-item" data-act="delbank" data-id="' + id + '" style="cursor:pointer;color:var(--bad)">' +
      '<div class="sl"><div class="t" style="color:var(--bad)">删除题库</div><div class="d">练习记录将一并清除</div></div>' + ICON.trash + '</div>' +
      '</div>';
    openSheet(html);
  }

  /* ================= 设置 ================= */
  function openSettings() {
    var st = S.settings;
    var html = '<div class="sh-head"><h3>设置</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body">' +
      '<div class="set-item"><div class="sl"><div class="t">字号</div><div class="d">影响题干与选项显示大小</div></div>' +
      '<div class="seg" id="segFont">' +
      [14, 16, 18, 20].map(function (n) {
        return '<button data-act="fontsize" data-v="' + n + '" class="' + (st.fontSize === n ? 'on' : '') + '">' + n + '</button>';
      }).join('') + '</div></div>' +
      '<div class="set-item"><div class="sl"><div class="t">主题</div></div>' +
      '<div class="seg">' +
      '<button data-act="theme" data-v="light" class="' + (st.theme === 'light' ? 'on' : '') + '">浅色</button>' +
      '<button data-act="theme" data-v="dark" class="' + (st.theme === 'dark' ? 'on' : '') + '">深色</button>' +
      '</div></div>' +
      '<div class="set-item"><div class="sl"><div class="t">答题后立即显示答案</div><div class="d">关闭则进入考试模式，全部答完才显示</div></div>' +
      '<div class="switch ' + (st.instant ? 'on' : '') + '" data-act="toggle" data-k="instant"></div></div>' +
      '<div class="set-item"><div class="sl"><div class="t">答对后自动下一题</div></div>' +
      '<div class="switch ' + (st.autoNext ? 'on' : '') + '" data-act="toggle" data-k="autoNext"></div></div>' +
      '<div style="height:8px"></div>' +
      '<div class="set-item" data-act="aisetting" style="cursor:pointer">' +
      '<div class="sl"><div class="t">AI 解析</div><div class="d">' + h(aiCfgSummary()) + '</div></div>' + ICON.spark + '</div>' +
      '<div style="height:8px"></div>' +
      '<div class="note info">' + ICON.info + '<div>所有题库与练习记录都保存在本机浏览器中，清除浏览器数据会一并清空，建议定期用「导出 JSON」备份。</div></div>' +
      '<div class="note warn">' + ICON.info + '<div>PDF 解析为离线智能识别，复杂排版可能需要人工校正。用「更多 → 编辑本题」可随时修正。</div></div>' +
      '</div>';
    openSheet(html);
  }

  /* ================= AI 解析 ================= */
  function providerName(k) {
    var p = AI.PRESETS.filter(function (x) { return x.k === k; })[0];
    return p ? p.name : '自定义';
  }

  function aiCfgSummary() {
    var c = S.aiCfg;
    if (!c || !c.key) return '未配置，配置后可给题目批量生成解析';
    return providerName(c.provider) + ' · ' + (c.model || '未填模型');
  }

  function openAISettings() {
    var c = Object.assign({}, AI.DEFAULT_CONFIG, S.aiCfg || {});
    var p = AI.PRESETS.filter(function (x) { return x.k === c.provider; })[0] || AI.PRESETS[0];

    var html = '<div class="sh-head"><h3>AI 解析</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body">' +
      '<div class="field" style="margin-top:2px"><label>服务商</label>' +
      '<div class="chips" id="aiProvider">' +
      AI.PRESETS.map(function (x) {
        return '<button class="chip ' + (x.k === c.provider ? 'on' : '') + '" data-prov="' + x.k + '">' + x.name + '</button>';
      }).join('') + '</div>' +
      (p.tip ? '<div class="field-hint">' + h(p.tip) + '</div>' : '') +
      '</div>' +
      '<div class="field"><label>Base URL</label>' +
      '<input class="input" id="aiBase" value="' + h(c.baseUrl) + '" placeholder="https://api.deepseek.com" spellcheck="false"></div>' +
      '<div class="field"><label>模型</label>' +
      '<input class="input" id="aiModel" value="' + h(c.model) + '" placeholder="deepseek-chat" spellcheck="false"></div>' +
      '<div class="field"><label>API Key</label>' +
      '<div style="position:relative">' +
      '<input class="input" id="aiKey" type="password" value="' + h(c.key) + '" placeholder="sk-…" spellcheck="false" autocomplete="off" style="padding-right:56px">' +
      '<button class="btn-mini" data-act="aikeyshow" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)">显示</button>' +
      '</div>' +
      '<div class="field-hint">' + (p.keyUrl ? '<a href="' + h(p.keyUrl) + '" target="_blank" rel="noopener">去 ' + p.name + ' 申请 Key</a>' : '') +
      '　Key 只保存在本机，不会上传到任何地方</div></div>' +
      '<div class="field"><label>解析详细程度</label>' +
      '<div class="chips" id="aiStyle">' +
      AI.STYLES.map(function (s) {
        return '<button class="chip ' + (s.k === c.style ? 'on' : '') + '" data-style="' + s.k + '">' + s.name + '<span class="chip-sub">' + s.desc + '</span></button>';
      }).join('') + '</div></div>' +
      '<div class="ai-test" id="aiTestBox"></div>' +
      '</div>' +
      '<div class="sh-foot">' +
      '<button class="btn ghost" data-act="aitest">测试连接</button>' +
      '<button class="btn" style="flex:2" data-act="aisave">保存</button></div>';
    openSheet(html);

    // 服务商切换
    $$('#aiProvider .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.prov;
        var pre = AI.PRESETS.filter(function (x) { return x.k === k; })[0];
        $$('#aiProvider .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        if (pre && k !== 'custom') {
          var baseEl = $('#aiBase'), modelEl = $('#aiModel');
          if (baseEl) baseEl.value = pre.base;
          if (modelEl) modelEl.value = pre.model;
        }
      });
    });
    $$('#aiStyle .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('#aiStyle .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
  }

  function readAICfgFromForm() {
    var onProv = $('#aiProvider .chip.on');
    var onStyle = $('#aiStyle .chip.on');
    return {
      provider: onProv ? onProv.dataset.prov : (S.aiCfg && S.aiCfg.provider) || 'deepseek',
      baseUrl: ($('#aiBase') ? $('#aiBase').value : '').trim(),
      model: ($('#aiModel') ? $('#aiModel').value : '').trim(),
      key: ($('#aiKey') ? $('#aiKey').value : '').trim(),
      style: onStyle ? onStyle.dataset.style : 'normal'
    };
  }

  async function saveAISettings() {
    var cfg = readAICfgFromForm();
    if (!cfg.baseUrl) { toast('请填写 Base URL'); return; }
    if (!cfg.model) { toast('请填写模型名'); return; }
    S.aiCfg = Object.assign({}, S.aiCfg || {}, cfg);
    await Store.saveAI(S.aiCfg);
    closeSheet();
    toast(cfg.key ? '已保存' : '已保存（还没填 Key）');
  }

  function openAIFill(bankId) {
    var b = S.banks.filter(function (x) { return x.id === bankId; })[0];
    if (!b) return;
    S.aiBank = bankId;

    var ready = S.aiCfg && S.aiCfg.key;
    var html = '<div class="sh-head"><h3>AI 补全解析</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body" id="aiFillBody"></div>' +
      '<div class="sh-foot" id="aiFillFoot"></div>';
    openSheet(html);

    if (!ready) {
      $('#aiFillBody').innerHTML =
        '<div class="note warn" style="margin-top:4px">' + ICON.info +
        '<div>还没配置 AI。填一个 API Key 就能让模型给题目写解析，Key 只存在本机。</div></div>' +
        '<button class="btn" data-act="aisetting" style="margin-top:16px;width:100%">去配置</button>';
      $('#aiFillFoot').innerHTML = '';
      return;
    }
    renderAIFillSetup(b);
  }

  async function renderAIFillSetup(b) {
    var bank = await Store.getBank(b.id);
    if (!bank) return;
    var qs = bank.questions || [];
    var missN = qs.filter(function (q) { return !String(q.analysis || '').trim(); }).length;
    var shortN = qs.filter(function (q) {
      var a = String(q.analysis || '').trim();
      return !a || a.length < 30;
    }).length;
    var aiN = qs.filter(function (q) { return q.aiAt; }).length;

    var range = S.aiRange || 'short';
    var wrongSet = null;
    var prog = await Store.getProgress(b.id);
    var wrongN = 0;
    Object.keys(prog.rec || {}).forEach(function (k) { if (prog.rec[k] && prog.rec[k].ok === 0) wrongN++; });

    var counts = {
      missing: missN,
      short: shortN,
      all: qs.length - aiN
    };

    var html = '<div class="ai-stat">' +
      '<div class="ai-stat-row"><span>共 ' + qs.length + ' 题</span>' +
      '<span class="dim">无解析 ' + missN + ' · 解析过短 ' + (shortN - missN) + ' · 已有 ' + (qs.length - shortN) + '</span></div>' +
      '</div>' +
      '<div class="field" style="margin-top:14px"><label>处理范围</label><div class="ai-ranges">' +
      AI.RANGES.map(function (r) {
        var n = counts[r.k] || 0;
        return '<button class="ai-range ' + (r.k === range ? 'on' : '') + '" data-range="' + r.k + '">' +
          '<div class="ar-t">' + r.name + '<b>' + n + '</b></div>' +
          '<div class="ar-d">' + r.desc + '</div></button>';
      }).join('') + '</div></div>' +
      (wrongN ? '<label class="ai-check"><input type="checkbox" id="aiOnlyWrong"' + (S.aiOnlyWrong ? ' checked' : '') + '> 只处理做错过的题（' + wrongN + ' 道）</label>' : '') +
      '<div class="ai-est" id="aiEst"></div>';

    $('#aiFillBody').innerHTML = html;
    $('#aiFillFoot').innerHTML = '<button class="btn ghost" data-act="closeSheet">取消</button>' +
      '<button class="btn" style="flex:2" data-act="aistart">开始生成</button>';

    function refreshEst() {
      var n = AI.pickIndices(qs, S.aiRange || 'short', S.aiOnlyWrong ? wrongSetOf(prog) : null).length;
      var el = $('#aiEst');
      if (!el) return;
      if (!n) { el.innerHTML = '<span class="dim">这个范围下没有需要处理的题</span>'; return; }
      var secPerQ = S.aiCfg.style === 'detail' ? 8 : 5;
      var mins = Math.ceil(n * secPerQ / 3 / 60);
      el.innerHTML = ICON.clock + '<span>将处理 <b>' + n + '</b> 题，按当前并发约需 ' + mins + ' 分钟</span>';
      var st = $('[data-act="aistart"]');
      if (st) st.disabled = !n;
    }

    function wrongSetOf(p) {
      var m = {};
      Object.keys(p.rec || {}).forEach(function (k) { if (p.rec[k] && p.rec[k].ok === 0) m[k] = 1; });
      return m;
    }

    $$('.ai-range').forEach(function (el) {
      el.addEventListener('click', function () {
        S.aiRange = el.dataset.range;
        $$('.ai-range').forEach(function (x) { x.classList.toggle('on', x === el); });
        refreshEst();
      });
    });
    var cb = $('#aiOnlyWrong');
    if (cb) cb.addEventListener('change', function () { S.aiOnlyWrong = cb.checked; refreshEst(); });

    S._aiSetup = { bank: bank, questions: qs, prog: prog, wrongSetOf: wrongSetOf };
    refreshEst();
  }

  /* 执行批量生成 */
  async function startAIFill() {
    var ctx = S._aiSetup;
    if (!ctx) return;
    var qs = ctx.questions;
    var range = S.aiRange || 'short';
    var wrongSet = S.aiOnlyWrong ? ctx.wrongSetOf(ctx.prog) : null;
    var idxs = AI.pickIndices(qs, range, wrongSet);

    if (!idxs.length) { toast('没有需要处理的题'); return; }
    if (idxs.length > 30 && !confirm('即将为 ' + idxs.length + ' 道题生成解析，消耗 token 会按题量增加。确定开始？')) return;

    var bank = ctx.bank;
    var recent = [];

    var body = $('#aiFillBody');
    var foot = $('#aiFillFoot');
    body.innerHTML =
      '<div class="ai-prog-wrap">' +
      '<div class="ai-prog-num"><b id="aiDoneN">0</b><span> / ' + idxs.length + '</span></div>' +
      '<div class="ai-prog-bar"><i id="aiBar" style="width:0%"></i></div>' +
      '<div class="ai-prog-sub" id="aiProgSub">准备中…</div>' +
      '</div>' +
      '<div class="ai-log" id="aiLog"></div>';
    foot.innerHTML = '<button class="btn ghost" data-act="aistop">停止</button>';

    function pushLog(ok, text) {
      recent.unshift({ ok: ok, text: text });
      recent = recent.slice(0, 6);
      var el = $('#aiLog');
      if (!el) return;
      el.innerHTML = recent.map(function (r) {
        return '<div class="ai-log-item ' + (r.ok ? 'ok' : 'bad') + '">' +
          '<span class="dot"></span><span class="tx">' + h(r.text) + '</span></div>';
      }).join('');
    }

    var t0 = Date.now();
    var runner = AI.createRunner({
      cfg: S.aiCfg,
      questions: qs,
      indices: idxs,
      concurrency: 3,
      onItem: function (it) {
        if (it.ok) {
          pushLog(true, '第 ' + (it.index + 1) + ' 题：' + String(it.text).slice(0, 46));
        } else {
          pushLog(false, '第 ' + (it.index + 1) + ' 题失败：' + it.error);
        }
      },
      onTick: function (st) {
        var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
        var bar = $('#aiBar'), dn = $('#aiDoneN'), sub = $('#aiProgSub');
        if (bar) bar.style.width = pct + '%';
        if (dn) dn.textContent = st.done;
        if (sub) {
          var el = (Date.now() - t0) / 1000;
          var speed = st.done ? (el / st.done).toFixed(1) : '—';
          var left = st.done ? Math.max(0, Math.round((st.total - st.done) * el / st.done)) : 0;
          sub.textContent = '成功 ' + st.ok + (st.fail ? ' · 失败 ' + st.fail : '') +
            ' · 每题约 ' + speed + ' 秒' +
            (st.done && st.done < st.total ? ' · 预计还需 ' + fmtTime(left * 1000) : '');
        }
      },
      onFlush: function () {
        return Store.updateBankQuestions(bank.id, qs, Parse.audit(qs));
      },
      onFatal: function (msg) {
        pushLog(false, msg);
      }
    });

    S.aiRun = runner;
    var st = await runner.start();
    S.aiRun = null;

    await Store.updateBankQuestions(bank.id, qs, Parse.audit(qs));

    var doneReason = st.fatal ? st.fatal : (st.stopped ? '已停止' : '全部完成');
    body.innerHTML =
      '<div class="ai-finish">' +
      '<div class="af-num">' + st.ok + '</div>' +
      '<div class="af-label">道题已生成解析</div>' +
      (st.fail ? '<div class="af-sub">' + st.fail + ' 道失败，可重试</div>' : '') +
      '<div class="af-sub">' + h(doneReason) + '</div>' +
      '</div>';
    foot.innerHTML =
      (st.fail ? '<button class="btn ghost" data-act="airetry">重试失败</button>' : '') +
      '<button class="btn" style="flex:2" data-act="aifinish">完成</button>';

    if (st.ok) toast('已为 ' + st.ok + ' 道题生成解析');
    await loadHome();
    if (S.sess) {
      // 练习中修改了题库，刷新当前题
      paintQuestion && paintQuestion();
    }
  }

  /* 测试连接 */
  async function testAIConnection() {
    var cfg = readAICfgFromForm();
    var box = $('#aiTestBox');
    if (!cfg.baseUrl || !cfg.model) { toast('先填 Base URL 和模型'); return; }
    if (!cfg.key) { toast('先填 API Key'); return; }

    if (box) box.innerHTML = '<div class="ai-test-run">' + ICON.clock + '<span>正在连接，稍等…</span></div>';
    try {
      var r = await AI.testConnection(cfg);
      if (box) {
        box.innerHTML = '<div class="ai-test-ok">' + ICON.check +
          '<div><b>连接成功</b><span class="dim"> · ' + r.ms + 'ms</span>' +
          '<div class="ai-sample">' + h(String(r.sample || '').slice(0, 140)) + '</div></div></div>';
      }
    } catch (e) {
      if (box) {
        box.innerHTML = '<div class="ai-test-bad">' + ICON.x +
          '<div><b>连接失败</b><div class="ai-sample">' + h(e.message || '未知错误') + '</div></div></div>';
      }
    }
  }

  function toggleAIShow(btn) {
    var el = $('#aiKey');
    if (!el) return;
    var show = el.type === 'password';
    el.type = show ? 'text' : 'password';
    btn.textContent = show ? '隐藏' : '显示';
  }

  /* 单题生成 */
  async function aiFillOne() {    var s = S.sess;
    if (!s) return;
    var q = s.bank.questions[s.queue[s.pos]];
    if (!S.aiCfg || !S.aiCfg.key) {
      closeSheet();
      toast('先配置 AI 解析');
      openAISettings();
      return;
    }
    closeSheet();
    s._peek = q.id;
    toast('正在生成解析…', 15000);
    try {
      var txt = await AI.callWithRetry(S.aiCfg, q, { retries: 2 });
      if (S.sess !== s) return;
      q.analysis = txt;
      q.aiAt = Date.now();
      await Store.updateBankQuestions(s.bank.id, s.bank.questions, Parse.audit(s.bank.questions));
      paintQuestion();
      toast('解析已生成');
    } catch (e) {
      if (S.sess === s) { s._peek = null; paintQuestion(); }
      toast(e.message || '生成失败', 4500);
    }
  }

  /* ================= 编辑题目 ================= */
  function openEditQuestion() {
    var s = S.sess;
    var qi = s.queue[s.pos];
    var q = s.bank.questions[qi];

    var optsHtml = '';
    q.options.forEach(function (o, i) {
      optsHtml += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<span style="width:22px;font-weight:700;color:var(--tx-2)">' + o.key + '</span>' +
        '<input class="input" data-opt="' + i + '" value="' + h(o.text) + '" style="height:38px">' +
        '</div>';
    });

    var html = '<div class="sh-head"><h3>编辑本题</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body">' +
      '<div class="field" style="margin-top:0"><label>题干</label>' +
      '<textarea class="input" id="editStem" style="min-height:90px">' + h(q.stem) + '</textarea></div>' +
      (q.options.length ? '<div class="field"><label>选项</label>' + optsHtml + '</div>' : '') +
      '<div class="field"><label>正确答案（多个用逗号或直接连写，如 ABD）</label>' +
      '<input class="input" id="editAns" value="' + h(q.answer) + '"></div>' +
      '<div class="field"><label>解析</label>' +
      '<textarea class="input" id="editAna" style="min-height:80px">' + h(q.analysis) + '</textarea></div>' +
      '</div>' +
      '<div class="sh-foot"><button class="btn ghost" data-act="closeSheet">取消</button>' +
      '<button class="btn" style="flex:2" data-act="saveEdit">保存修改</button></div>';
    openSheet(html);
  }

  async function saveEdit() {
    var s = S.sess;
    var qi = s.queue[s.pos];
    var q = s.bank.questions[qi];

    var stemEl = $('#editStem'), ansEl = $('#editAns'), anaEl = $('#editAna');
    if (stemEl) q.stem = stemEl.value.trim();
    if (anaEl) q.analysis = anaEl.value.trim();
    if (ansEl) {
      var na = Parse.normalizeAnswer(ansEl.value.trim(), q.options);
      q.answer = na.answer;
      if (na.type) q.type = na.type;
    }
    $$('#sheet [data-opt]').forEach(function (inp) {
      var i = +inp.dataset.opt;
      if (q.options[i]) q.options[i].text = inp.value.trim();
    });
    q.options = q.options.filter(function (o) { return o.text; });
    Parse.finalize([q]);

    await Store.updateBankQuestions(s.bank.id, s.bank.questions, Parse.audit(s.bank.questions));
    closeSheet();
    s.answers[qi] = null;
    delete s.answers[qi];
    paintQuestion();
    toast('已保存');
  }

  /* ================= 题库操作 ================= */
  async function deleteBank(id) {
    var b = S.banks.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    if (!confirm('确定删除题库「' + b.name + '」？该操作不可恢复。')) return;
    await Store.deleteBank(id);
    closeSheet();
    toast('已删除');
    await loadHome();
  }

  async function renameBank(id) {
    var b = S.banks.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var v = prompt('输入新的题库名称', b.name);
    if (!v || !v.trim()) return;
    await Store.renameBank(id, v.trim());
    await loadHome();
    toast('已重命名');
  }

  async function exportBank(id) {
    var bank = await Store.getBank(id);
    if (!bank) return;
    var data = {
      name: bank.name,
      exportedAt: new Date().toISOString(),
      questions: bank.questions.map(function (q) {
        return {
          stem: q.stem, type: q.type, options: q.options,
          answer: q.answer, analysis: q.analysis, section: q.section
        };
      })
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = bank.name + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast('已导出');
  }

  /* ================= 设置应用 ================= */
  function applySettings() {
    var st = S.settings;
    document.documentElement.setAttribute('data-theme', st.theme || 'light');
    document.documentElement.style.setProperty('--fs', (st.fontSize || 16) + 'px');
  }

  /* ================= 退出练习 ================= */
  function quitQuiz() {
    var s = S.sess;
    if (!s) return;
    var doneN = Object.keys(s.answers).length;
    if (doneN && !confirm('退出练习？已作答 ' + doneN + ' 题，记录已保存。')) return;
    S.sess = null;
    loadHome();
    showView('home');
  }

  /* ================= 事件 ================= */
  var pending = null;

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act;

    // 模式选择
    if (act === 'pickmode') {
      $$('.mode-item').forEach(function (x) { x.classList.remove('sel'); });
      t.classList.add('sel');
      S.pickMode = t.dataset.mode;
      return;
    }
    if (act === 'chip') return;

    switch (act) {
      case 'import': openImport(); break;
      case 'pickfile': {
        var old = document.getElementById('__fileInput');
        if (old) old.remove();
        var f = document.createElement('input');
        f.type = 'file';
        f.id = '__fileInput';
        f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        f.accept = '.pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md,.json';
        f.onchange = function () { if (f.files && f.files[0]) handleFile(f.files[0]); };
        document.body.appendChild(f);
        f.click();
        break;
      }
      case 'pasteMode': pasteMode(); break;
      case 'doPaste': doPaste(); break;
      case 'doImport': await doImport(); break;
      case 'closeSheet': closeSheet(); break;
      case 'openbank': closeSheet(); {
        var id0 = t.dataset.id;
        setTimeout(function () { openBank(id0); }, 60);
        break;
      }
      case 'startquiz': startQuiz(); break;
      case 'cards': openCards(); break;
      case 'jump': jumpTo(+t.dataset.pos); break;
      case 'pick': pickOption(t.dataset.key); break;
      case 'confirm': {
        var s0 = S.sess;
        if (s0 && s0._multiSel) commit(s0._multiSel);
        break;
      }
      case 'next': nextQ(); break;
      case 'prev': prevQ(); break;
      case 'fav': toggleFav(); break;
      case 'quitquiz': quitQuiz(); break;
      case 'backhome': S.sess = null; loadHome(); showView('home'); break;
      case 'again': {
        var s1 = S.sess;
        var b1 = s1.bank;
        S.sess = null;
        await openBank(b1.id);
        break;
      }
      case 'redoWrong': {
        var s2 = S.sess;
        S.pickMode = 'wrong'; S.pickType = 'all';
        var nb = s2.bank;
        S.sess = null;
        await openBank(nb.id);
        S.pickMode = 'wrong';
        break;
      }
      case 'settings': openSettings(); break;
      case 'aisetting': closeSheet(); setTimeout(openAISettings, 70); break;
      case 'aisave': await saveAISettings(); break;
      case 'aitest': await testAIConnection(); break;
      case 'aikeyshow': toggleAIShow(t); break;
      case 'aifill': {
        var idf = t.dataset.id;
        closeSheet();
        setTimeout(function () { openAIFill(idf); }, 70);
        break;
      }
      case 'aistart': await startAIFill(); break;
      case 'aistop': if (S.aiRun) S.aiRun.stop(); break;
      case 'aifinish': closeSheet(); break;
      case 'aione': await aiFillOne(); break;
      case 'bankmenu': e.stopPropagation(); bankMenu(t.dataset.id); break;
      case 'editbank': closeSheet(); setTimeout(function () { bankMenu(t.dataset.id); }, 80); break;
      case 'delbank': await deleteBank(t.dataset.id); break;
      case 'rename': await renameBank(t.dataset.id); break;
      case 'exportbank': await exportBank(t.dataset.id); break;
      case 'qmenu': openQMenu(); break;
      case 'editq': closeSheet(); setTimeout(openEditQuestion, 80); break;
      case 'saveEdit': await saveEdit(); break;
      case 'fontsize': {
        S.settings.fontSize = +t.dataset.v;
        await Store.saveSettings(S.settings);
        applySettings();
        $$('#segFont button').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === S.settings.fontSize); });
        break;
      }
      case 'theme': {
        S.settings.theme = t.dataset.v;
        await Store.saveSettings(S.settings);
        applySettings();
        $$('[data-act="theme"]').forEach(function (b) { b.classList.toggle('on', b.dataset.v === S.settings.theme); });
        break;
      }
      case 'toggle': {
        var k = t.dataset.k;
        S.settings[k] = !S.settings[k];
        t.classList.toggle('on', S.settings[k]);
        await Store.saveSettings(S.settings);
        break;
      }
    }

    if (act === 'pick' || act === 'confirm' || act === 'next' || act === 'prev') return;
  });

  // 题型筛选（独立处理，因为 chip 是动态的）
  document.addEventListener('click', function (e) {
    var c = e.target.closest('#typeFilter .chip');
    if (!c) return;
    $$('#typeFilter .chip').forEach(function (x) { x.classList.remove('on'); });
    c.classList.add('on');
    S.pickType = c.dataset.type;
  });

  // 答题卡里点遮罩关闭
  $('#mask').addEventListener('click', closeSheet);

  function openQMenu() {
    var s = S.sess;
    var q = s.bank.questions[s.queue[s.pos]];
    var html = '<div class="sh-head"><h3>题目操作</h3><div class="spacer"></div>' +
      '<button class="icon-btn" data-act="closeSheet">' + ICON.x + '</button></div>' +
      '<div class="sh-body" style="padding-bottom:8px">' +
      '<div class="set-item" data-act="editq" style="cursor:pointer">' +
      '<div class="sl"><div class="t">编辑本题</div><div class="d">修正题干、选项、答案或解析</div></div>' + ICON.edit + '</div>' +
      '<div class="set-item" data-act="aione" style="cursor:pointer">' +
      '<div class="sl"><div class="t">' + (q.analysis ? 'AI 重写本题解析' : 'AI 生成本题解析') + '</div>' +
      '<div class="d">' + (S.aiCfg && S.aiCfg.key ? providerName(S.aiCfg.provider) + ' 帮你写一段讲解' : '需要先在设置里配 API Key') + '</div></div>' + ICON.spark + '</div>' +
      '<div class="set-item" data-act="fav" style="cursor:pointer">' +
      '<div class="sl"><div class="t">' + (s.prog.fav[q.id] ? '取消收藏' : '收藏本题') + '</div></div>' + ICON.star + '</div>' +
      '</div>';
    openSheet(html);
  }

  /* ================= 键盘 ================= */
  document.addEventListener('keydown', function (e) {
    if (!S.sess) return;
    if ($('.sheet.show')) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    var k = e.key.toUpperCase();
    if (/^[A-H]$/.test(k)) {
      var s = S.sess;
      var q = s.bank.questions[s.queue[s.pos]];
      if (q.options.some(function (o) { return o.key === k; })) {
        e.preventDefault();
        pickOption(k);
      }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); nextQ(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevQ(); }
    else if (e.key === ' ') { e.preventDefault(); toggleFav(); }
    else if (e.key === 'Escape') { closeSheet(); }
  });

  // 拖拽
  document.addEventListener('dragover', function (e) {
    var dz = document.getElementById('dropZone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.add('over');
  });
  document.addEventListener('dragleave', function (e) {
    var dz = document.getElementById('dropZone');
    if (dz) dz.classList.remove('over');
  });
  document.addEventListener('drop', function (e) {
    var dz = document.getElementById('dropZone');
    if (!dz) return;
    e.preventDefault();
    dz.classList.remove('over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  /* ================= 启动 ================= */
  async function boot() {
    S.settings = await Store.getSettings();
    S.aiCfg = await Store.getAI();
    applySettings();
    await loadHome();
    showView('home');
  }

  boot().catch(function (e) {
    console.error(e);
    toast('初始化失败：' + e.message, 4000);
  });

})();
