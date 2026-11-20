/* ============================================================
 * AI 解析模块
 * 走 OpenAI 兼容的 /chat/completions 接口，浏览器直连
 * 已验证支持 file:// 直连的服务商：DeepSeek / Kimi / 通义
 * ============================================================ */
(function (root) {
  'use strict';

  var PRESETS = [
    {
      k: 'deepseek', name: 'DeepSeek',
      base: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      keyUrl: 'https://platform.deepseek.com/api_keys',
      tip: '中文讲解质量好，价格便宜'
    },
    {
      k: 'kimi', name: 'Kimi',
      base: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-8k',
      keyUrl: 'https://platform.moonshot.cn/console/api-keys',
      tip: '长文本见长'
    },
    {
      k: 'qwen', name: '通义千问',
      base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      keyUrl: 'https://bailian.console.aliyun.com/',
      tip: '新用户有免费额度'
    },
    {
      k: 'custom', name: '自定义',
      base: '', model: '', keyUrl: '',
      tip: '任何 OpenAI 兼容接口'
    }
  ];

  var STYLES = [
    { k: 'brief', name: '简短', limit: 90, desc: '只讲关键依据' },
    { k: 'normal', name: '标准', limit: 180, desc: '正误选项都讲清' },
    { k: 'detail', name: '详细', limit: 320, desc: '展开相关考点' }
  ];

  var DEFAULT_CONFIG = {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    key: '',
    style: 'normal'
  };

  function styleLimit(k) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].k === k) return STYLES[i].limit;
    return 180;
  }

  /* ---------------- 接口地址 ---------------- */
  function endpoint(base) {
    var b = String(base || '').trim().replace(/\/+$/, '');
    if (!b) return '';
    if (/\/chat\/completions$/.test(b)) return b;
    if (/\/v\d+([a-z0-9-]*)?$/i.test(b)) return b + '/chat/completions';
    return b + '/v1/chat/completions';
  }

  /* ---------------- 提示词 ---------------- */
  function systemPrompt(style) {
    var limit = styleLimit(style);
    return [
      '你是一位善于把题目讲透的考试辅导老师。用户会给你一道题和它的正确答案，你要写一段解析。',
      '',
      '写作要求：',
      '1. 开头直接说明正确答案和判断依据，不要复述题干',
      '2. 有多个选项时，逐个指出错误选项错在哪里；要说清具体错因，不要用"不符合题意""与题目无关"这类空话',
      '3. 结尾点明这道题的核心考点，或提醒容易混淆的地方',
      '4. 语气平实，像面对面讲课；不要用"首先、其次、综上所述"这类套话',
      '5. 只输出解析正文，纯文本，不要 Markdown 标记、标题、加粗、编号列表，不要加"解析："前缀',
      '6. 篇幅控制在 ' + limit + ' 字以内'
    ].join('\n');
  }

  function userPrompt(q) {
    var lines = [];
    if (q.section) lines.push('所属章节：' + String(q.section).slice(0, 60));
    lines.push('题干：' + String(q.stem || '').slice(0, 1800));

    var opts = q.options || [];
    if (opts.length) {
      lines.push('选项：');
      opts.forEach(function (o) {
        lines.push(o.key + '. ' + String(o.text || '').slice(0, 300));
      });
    }

    var ans = String(q.answer || '').trim();
    if (ans) {
      lines.push('正确答案：' + ans);
    } else {
      lines.push('正确答案：（题库未提供，请自行判断，并在解析开头先写明答案）');
    }

    if (q.analysis) {
      lines.push('');
      lines.push('已有解析（仅供参考，如不够准确请直接改写）：' + String(q.analysis).slice(0, 800));
    }
    return lines.join('\n');
  }

  /* ---------------- 返回清洗 ---------------- */
  function clean(text) {
    var s = String(text || '').trim();
    // 去掉整体包裹的代码块
    s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');
    // 去掉开头的标签词
    s = s.replace(/^(?:【\s*(?:解析|分析|答案|答|解|详解|考点)\s*】|\[\s*(?:解析|分析|答案|详解)\s*\])\s*[:：]?\s*/i, '');
    s = s.replace(/^(?:解析|分析|答案|答|详解)\s*[:：]\s*/i, '');
    // 去掉 Markdown 标记
    s = s.replace(/(^|\s)#{1,6}\s+/g, '$1');
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/^\s*\d+[.、]\s+/gm, '');
    // 压缩空白
    s = s.replace(/[ \t]+\n/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    return s.trim();
  }

  /* ---------------- 单次调用 ---------------- */
  function callOnce(cfg, q, opts) {
    opts = opts || {};
    var url = endpoint(cfg.baseUrl);
    if (!url) return Promise.reject(fatal('接口地址为空'));
    if (!cfg.key) return Promise.reject(fatal('还没有填 API Key'));
    if (!cfg.model) return Promise.reject(fatal('还没有填模型名'));

    var ctrl = null;
    var timer = null;
    try { ctrl = new AbortController(); } catch (e) { ctrl = null; }

    var timeout = opts.timeout || 60000;
    var p = new Promise(function (resolve, reject) {
      if (ctrl) {
        timer = setTimeout(function () {
          try { ctrl.abort(); } catch (e) {}
          reject(retryable('请求超时（' + Math.round(timeout / 1000) + ' 秒）'));
        }, timeout);
      }

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: systemPrompt(cfg.style) },
            { role: 'user', content: userPrompt(q) }
          ],
          temperature: 0.3,
          max_tokens: cfg.style === 'detail' ? 1000 : (cfg.style === 'brief' ? 320 : 560),
          stream: false
        }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.text().then(function (raw) {
          if (!res.ok) throw httpError(res.status, raw);
          var data;
          try { data = JSON.parse(raw); }
          catch (e) { throw retryable('返回内容无法解析'); }
          var msg = data && data.choices && data.choices[0] && data.choices[0].message;
          var txt = msg && (msg.content || msg.reasoning_content);
          if (!txt) throw retryable('模型没有返回内容');
          return clean(txt);
        });
      }).then(function (txt) {
        if (timer) clearTimeout(timer);
        if (!txt) throw retryable('模型返回为空');
        if (txt.length > 1200) txt = txt.slice(0, 1200);
        resolve(txt);
      }).catch(function (e) {
        if (timer) clearTimeout(timer);
        if (e && e.__kind) return reject(e);
        if (e && e.name === 'AbortError') return reject(retryable('请求被中断'));
        // TypeError 多为网络不可达 / CORS 被拦
        if (e instanceof TypeError) {
          return reject(retryable('无法连接到接口，请检查网络与接口地址（浏览器可能拦截了跨域）'));
        }
        reject(retryable((e && e.message) || '请求失败'));
      });
    });

    p.abort = function () {
      if (timer) clearTimeout(timer);
      if (ctrl) { try { ctrl.abort(); } catch (e) {} }
    };
    return p;
  }

  function fatal(msg) {
    var e = new Error(msg);
    e.__kind = 'fatal';
    e.__fatal = true;
    return e;
  }

  function retryable(msg) {
    var e = new Error(msg);
    e.__kind = 'retry';
    e.__retry = true;
    return e;
  }

  function httpError(status, raw) {
    var detail = '';
    try {
      var j = JSON.parse(raw);
      detail = (j.error && (j.error.message || j.error.code)) || j.message || '';
    } catch (e) {}
    if (status === 401 || status === 403) {
      return fatal('API Key 无效或没有权限（HTTP ' + status + '）' + (detail ? '：' + detail : ''));
    }
    if (status === 402 || status === 429) {
      var e2 = retryable('请求过于频繁或余额不足（HTTP ' + status + '）' + (detail ? '：' + detail : ''));
      e2.__slow = status === 429;
      return e2;
    }
    if (status === 404) {
      return fatal('接口地址不对（HTTP 404），请检查 Base URL' + (detail ? '：' + detail : ''));
    }
    if (status >= 500) return retryable('服务端错误（HTTP ' + status + '），稍后重试');
    return retryable('请求失败（HTTP ' + status + '）' + (detail ? '：' + detail : ''));
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ---------------- 带重试的调用 ---------------- */
  function callWithRetry(cfg, q, opts) {
    opts = opts || {};
    var retries = opts.retries == null ? 2 : opts.retries;
    var attempt = 0;

    function go() {
      if (opts.shouldStop && opts.shouldStop()) {
        return Promise.reject(fatal('已停止'));
      }
      return callOnce(cfg, q, { timeout: opts.timeout }).catch(function (e) {
        if (e && e.__fatal) throw e;
        if (attempt >= retries) throw e;
        attempt++;
        var wait = (e && e.__slow) ? 6000 * attempt : 1200 * attempt;
        return sleep(wait).then(go);
      });
    }
    return go();
  }

  /* ---------------- 测试连接 ---------------- */
  function testConnection(cfg) {
    var probe = {
      stem: '1 + 1 等于多少？',
      options: [
        { key: 'A', text: '1' },
        { key: 'B', text: '2' },
        { key: 'C', text: '3' }
      ],
      answer: 'B',
      analysis: '',
      section: ''
    };
    var t0 = Date.now();
    var testCfg = Object.assign({}, cfg, { style: 'brief' });
    return callOnce(testCfg, probe, { timeout: 30000 }).then(function (txt) {
      return { ok: true, ms: Date.now() - t0, sample: txt };
    });
  }

  /* ---------------- 范围筛选 ---------------- */
  var RANGES = [
    { k: 'missing', name: '只补空白的', desc: '题库里完全没有解析的题' },
    { k: 'short', name: '补空白和过短的', desc: '没有解析，或解析不到 30 字的' },
    { k: 'all', name: '全部重新生成', desc: '已有解析也重写；AI 生成过的会跳过，避免重复消耗' }
  ];

  function pickIndices(questions, range, wrongSet) {
    var out = [];
    (questions || []).forEach(function (q, i) {
      if (wrongSet && !wrongSet[q.id]) return;
      if (!q.stem || !String(q.stem).trim()) return;
      var ana = String(q.analysis || '').trim();
      if (range === 'missing') {
        if (!ana) out.push(i);
      } else if (range === 'all') {
        if (q.aiAt) return;
        out.push(i);
      } else {
        if (!ana || ana.length < 30) out.push(i);
      }
    });
    return out;
  }

  /* ---------------- 批量运行器 ---------------- */
  function createRunner(options) {
    var cfg = options.cfg;
    var questions = options.questions;
    var indices = options.indices || [];
    var total = indices.length;
    var concurrency = Math.max(1, Math.min(6, options.concurrency || 3));
    var onItem = options.onItem || function () {};
    var onTick = options.onTick || function () {};
    var onFlush = options.onFlush || function () { return Promise.resolve(); };
    var onFatal = options.onFatal || function () {};

    var state = {
      done: 0, ok: 0, fail: 0, total: total,
      stopped: false, running: false, fatal: null,
      failed: [], startedAt: 0
    };
    var cursor = 0;
    var inflight = [];
    var dirty = 0;

    function flush(force) {
      if (!dirty && !force) return Promise.resolve();
      dirty = 0;
      return Promise.resolve(onFlush()).catch(function () {});
    }

    function shouldStop() { return state.stopped || !!state.fatal; }

    function worker() {
      if (shouldStop()) return Promise.resolve();
      if (cursor >= total) return Promise.resolve();

      var idx = indices[cursor++];
      var q = questions[idx];

      var p = callWithRetry(cfg, q, { retries: 2, shouldStop: shouldStop });
      inflight.push(p);

      return p.then(function (txt) {
        q.analysis = txt;
        q.aiAt = Date.now();
        state.ok++;
        dirty++;
        onItem({ ok: true, q: q, index: idx, text: txt });
      }).catch(function (e) {
        if (shouldStop() && !state.fatal) return;
        if (e && e.__fatal) {
          if (!state.fatal) {
            state.fatal = e.message || '调用失败';
            onFatal(state.fatal);
          }
          return;
        }
        state.fail++;
        state.failed.push(idx);
        onItem({ ok: false, q: q, index: idx, error: (e && e.message) || '失败' });
      }).then(function () {
        if (shouldStop()) return;
        state.done++;
        onTick(state);
        if (dirty >= 5) return flush().then(loop);
        return loop();
      });
    }

    function loop() {
      if (shouldStop()) return Promise.resolve();
      if (cursor >= total) return Promise.resolve();
      return worker();
    }

    function start() {
      if (state.running) return Promise.resolve(state);
      state.running = true;
      state.startedAt = Date.now();
      onTick(state);

      var lanes = [];
      for (var i = 0; i < Math.min(concurrency, total); i++) lanes.push(loop());

      return Promise.all(lanes).then(function () {
        state.running = false;
        return flush(true);
      }).then(function () {
        onTick(state);
        return state;
      });
    }

    function stop() {
      state.stopped = true;
      inflight.forEach(function (p) { if (p && p.abort) try { p.abort(); } catch (e) {} });
    }

    return {
      start: start,
      stop: stop,
      state: state,
      setConcurrency: function (n) { concurrency = Math.max(1, Math.min(6, n)); }
    };
  }

  root.AI = {
    PRESETS: PRESETS,
    STYLES: STYLES,
    RANGES: RANGES,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    endpoint: endpoint,
    styleLimit: styleLimit,
    systemPrompt: systemPrompt,
    userPrompt: userPrompt,
    clean: clean,
    callOnce: callOnce,
    callWithRetry: callWithRetry,
    testConnection: testConnection,
    pickIndices: pickIndices,
    createRunner: createRunner
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
