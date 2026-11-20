const Parse = require('./parse.js');

const cases = [
{
  name: 'A. 标准格式（题号+选项+答案+解析）',
  text: `一、单项选择题
1. 企业战略管理的核心是（ ）。
A. 提高生产效率
B. 确定企业发展方向
C. 降低产品成本
D. 扩大市场份额
【答案】B
【解析】战略管理的核心在于明确企业长期发展方向与目标定位。

2. 下列属于企业无形资产的是（ ）。
A. 厂房  B. 机器设备  C. 专利权  D. 原材料
答案：C
解析：专利权属于无形资产，其余为有形资产。

二、多项选择题
3. 影响消费者购买行为的因素包括（ ）。
A. 文化因素
B. 社会因素
C. 个人因素
D. 心理因素
【正确答案】ABCD
【解析】四者均为影响因素。

4. 下列关于财务报表的说法正确的是（ ）。
A. 资产负债表反映某一时点状况
B. 利润表反映一定期间经营成果
C. 现金流量表反映现金流入流出
D. 所有者权益变动表可省略
答案：ABC`
},
{
  name: 'B. 答案在卷末 + 判断题 + 页码干扰',
  text: `模拟试卷
第 1 页 共 3 页
1、管理的四大职能是计划、组织、领导和控制。（ ）
2、有限责任公司股东人数不得超过50人。（ ）
3、下列哪项不是市场营销4P的内容（ ）
A．产品
B．价格
C．渠道
D．服务
4、绩效管理的首要环节是（ ）
A．绩效计划
B．绩效实施
C．绩效考核
D．绩效反馈
第 2 页 共 3 页
5、组织结构设计中，管理幅度与管理层次的关系是（ ）
A．正比
B．反比
C．无关
D．先增后减
参考答案
1.√ 2.√ 3.D 4.A 5.B
第 3 页 共 3 页`
},
{
  name: 'C. 无题号、选项换行、题号与题干分开',
  text: `1.
关于人力资源规划的说法，正确的是（  ）
A. 只关注数量不关注质量
B. 需与组织战略相匹配
C. 仅由人力资源部门决定
D. 属于短期事务性工作
答案 B

2.
薪酬设计中的公平性不包括（  ）
A. 外部公平
B. 内部公平
C. 个人公平
D. 绝对公平
答案：D`
},
{
  name: 'D. 带题型标签与题干跨行',
  text: `【单选题】1. 在SWOT分析中，反映企业外部环境中
机会与威胁的字母分别是（  ）。
A. S和W
B. O和T
C. S和O
D. W和T
【答案】B

【多选题】2. 下列关于企业文化的表述，正确的有（  ）。
A. 企业文化具有导向功能
B. 企业文化是一成不变的
C. 企业文化可以通过制度固化
D. 企业文化会影响员工行为
【答案】ACD
【解析】企业文化并非一成不变，需要随环境演进，故B错误。`
}
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = Parse.parseText(c.text);
  const a = Parse.audit(r.questions);
  console.log('\n===== ' + c.name + ' =====');
  console.log(`题目数 ${a.total} | 有选项 ${a.choice} | 有答案 ${Math.round(a.answerRate*100)}% | 有解析 ${Math.round(a.analysisRate*100)}% | 多选 ${a.multi} | 判断 ${a.judge}`);
  if (r.warnings.length) console.log('提示: ' + r.warnings.join(' / '));
  r.questions.forEach(q => {
    console.log(`  #${q.num} [${q.type}] ${q.stem.slice(0,42)}${q.stem.length>42?'…':''}`);
    if (q.options.length) console.log(`      选项: ` + q.options.map(o=>o.key+'.'+o.text.slice(0,18)).join(' | '));
    console.log(`      答案: "${q.answer}"  解析: ${q.analysis ? q.analysis.slice(0,30) : '(无)'}`);
  });
  // 断言
  const expectCount = { 'A': 4, 'B': 5, 'C': 2, 'D': 2 }[c.name[0]];
  const okCount = a.total === expectCount;
  const okAns = a.answerRate === 1;
  if (okCount && okAns) pass++;
  else { fail++; console.log(`  ❌ 期望题数 ${expectCount}，实际 ${a.total}；答案覆盖率 ${a.answerRate}`); }
}
console.log(`\n===== 结果: ${pass} 通过 / ${fail} 失败 =====`);
