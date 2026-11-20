const fs = require('fs');
const path = require('path');
const PdfText = require('./pdftext.js');
const Parse = require('./parse.js');

(async () => {
  // pdf.js 在 Node 下需要同目录的 pdf.worker.js 作为 fake worker
  const wsrc = path.join(__dirname, '..', 'vendor', 'pdf.worker.min.js');
  const wdst = path.join(__dirname, '..', 'vendor', 'pdf.worker.js');
  if (!fs.existsSync(wdst) && fs.existsSync(wsrc)) fs.copyFileSync(wsrc, wdst);

  const pdfjsLib = require('../vendor/pdf.min.js');
  const data = new Uint8Array(fs.readFileSync(path.join(__dirname, 'test-bank.pdf')));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: false,
    isEvalSupported: false,
    useWorkerFetch: false
  }).promise;

  const lines = await PdfText.extract(doc);
  const text = lines.join('\n');
  console.log('===== PDF 抽取的原始行 =====');
  console.log(text);
  console.log('\n===== 解析结果 =====');
  const r = Parse.parseText(text);
  const a = Parse.audit(r.questions);
  console.log(`题目数 ${a.total} | 有选项 ${a.choice} | 答案覆盖 ${Math.round(a.answerRate * 100)}% | 解析覆盖 ${Math.round(a.analysisRate * 100)}%`);
  if (r.warnings.length) console.log('提示: ' + r.warnings.join(' / '));
  r.questions.forEach(q => {
    console.log(`  #${q.num} [${q.type}] ${q.stem.slice(0, 46)}`);
    if (q.options.length) console.log(`      ` + q.options.map(o => o.key + '.' + o.text.slice(0, 16)).join(' | '));
    console.log(`      答案:"${q.answer}"  解析:${q.analysis ? q.analysis.slice(0, 34) : '(无)'}`);
  });
})().catch(e => { console.error('ERR', e); process.exit(1); });
