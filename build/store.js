/* ============================================================
 * 本地存储层（IndexedDB）
 * bmetas: 题库摘要   bdata: 题库题目
 * prog:   练习进度   kv:    设置
 * ============================================================ */
(function (root) {
  'use strict';

  var DB_NAME = 'shuati-app';
  var DB_VER = 1;
  var _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('bmetas')) db.createObjectStore('bmetas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('bdata')) db.createObjectStore('bdata', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('prog')) db.createObjectStore('prog', { keyPath: 'bankId' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(storeNames, mode) {
    return open().then(function (db) {
      return db.transaction(storeNames, mode || 'readonly');
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getOne(store, key) {
    return tx(store).then(function (t) {
      return reqToPromise(t.objectStore(store).get(key));
    });
  }

  function putOne(store, val) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(store, 'readwrite'); }
        catch (e) { return reject(e); }
        t.oncomplete = function () { resolve(true); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('写入被中止')); };
        try { t.objectStore(store).put(val); } catch (e) { reject(e); }
      });
    });
  }

  function delOne(store, key) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(store, 'readwrite'); }
        catch (e) { return reject(e); }
        t.oncomplete = function () { resolve(true); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('删除被中止')); };
        try { t.objectStore(store).delete(key); } catch (e) { reject(e); }
      });
    });
  }

  function getAll(store) {
    return tx(store).then(function (t) {
      return reqToPromise(t.objectStore(store).getAll());
    });
  }

  var DEFAULT_SETTINGS = {
    fontSize: 16,
    theme: 'light',
    autoNext: false,
    instant: true,
    shuffleOptions: false
  };

  var Store = {
    init: open,

    listBanks: function () {
      return getAll('bmetas').then(function (arr) {
        return (arr || []).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
      });
    },

    getBank: function (id) {
      return Promise.all([getOne('bmetas', id), getOne('bdata', id)]).then(function (r) {
        if (!r[0] || !r[1]) return null;
        var bank = r[0];
        bank.questions = (r[1] && r[1].questions) || [];
        return bank;
      });
    },

    saveBank: function (bank) {
      var meta = {
        id: bank.id,
        name: bank.name,
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt || Date.now(),
        source: bank.source || '',
        count: bank.questions.length,
        stats: bank.stats || null
      };
      return Promise.all([
        putOne('bmetas', meta),
        putOne('bdata', { id: bank.id, questions: bank.questions })
      ]).then(function () { return meta; });
    },

    updateBankQuestions: function (bankId, questions, stats) {
      return Promise.all([
        putOne('bdata', { id: bankId, questions: questions }),
        getOne('bmetas', bankId).then(function (m) {
          if (!m) return null;
          m.count = questions.length;
          m.updatedAt = Date.now();
          if (stats) m.stats = stats;
          return putOne('bmetas', m);
        })
      ]);
    },

    deleteBank: function (id) {
      return Promise.all([delOne('bmetas', id), delOne('bdata', id), delOne('prog', id)]);
    },

    renameBank: function (id, name) {
      return getOne('bmetas', id).then(function (m) {
        if (!m) return null;
        m.name = name; m.updatedAt = Date.now();
        return putOne('bmetas', m);
      });
    },

    getProgress: function (bankId) {
      return getOne('prog', bankId).then(function (p) {
        return p || { bankId: bankId, rec: {}, fav: {}, last: null, updatedAt: 0 };
      });
    },

    getAllProgress: function () {
      return getAll('prog').then(function (a) { return a || []; });
    },

    saveProgress: function (p) {
      p.updatedAt = Date.now();
      return putOne('prog', p);
    },

    getSettings: function () {
      return getOne('kv', 'settings').then(function (r) {
        return Object.assign({}, DEFAULT_SETTINGS, (r && r.v) || {});
      });
    },

    saveSettings: function (s) {
      return putOne('kv', { k: 'settings', v: s });
    },

    getAI: function () {
      return getOne('kv', 'ai').then(function (r) { return (r && r.v) || null; });
    },

    saveAI: function (cfg) {
      return putOne('kv', { k: 'ai', v: cfg });
    },

    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };

  root.Store = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
