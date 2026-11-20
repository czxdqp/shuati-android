# -*- coding: utf-8 -*-
"""生成一份模拟真实考试题库的多页中文 PDF，用于端到端测试"""
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

pdfmetrics.registerFont(TTFont('SimHei', 'C:/Windows/Fonts/simhei.ttf'))

W, H = A4
c = canvas.Canvas('test-bank.pdf', pagesize=A4)
page = 1
y = H - 80
HEADER = '人力资源管理师（三级）理论知识题库 · 内部资料'


def draw_header():
    c.setFont('SimHei', 8)
    c.setGrey = None
    c.drawString(72, H - 42, HEADER)
    c.drawRightString(W - 72, H - 42, '密')


def footer():
    c.setFont('SimHei', 8)
    c.drawCentredString(W / 2, 38, '第 %d 页 共 3 页' % page)


def line(text, size=10, dy=17, indent=72):
    global y, page
    if y < 72:
        footer()
        c.showPage()
        page += 1
        draw_header()
        y = H - 72
    c.setFont('SimHei', size)
    c.drawString(indent, y, text)
    y -= dy


def q(num, stem, opts, ans, ana=None):
    global y
    line('%d. %s' % (num, stem), 10, 17)
    for o in opts:
        line(o, 10, 16, 92)
    if ans:
        line('【答案】%s' % ans, 9.5, 15, 92)
    if ana:
        line('【解析】%s' % ana, 9.5, 15, 92)
    y -= 6


c.setFont('SimHei', 14)
c.drawCentredString(W / 2, H - 68, '人力资源管理师（三级）理论知识模拟题')
y = H - 96
draw_header()
line('一、单项选择题（每题 1 分，共 6 题）', 10, 24)

q(1, '战略性人力资源管理的主要特征是（  ）。',
  ['A. 以事务性工作为核心', 'B. 与企业战略紧密结合',
   'C. 仅关注薪酬发放', 'D. 由基层主管独立完成'], 'B',
  '战略性人力资源管理强调人力资源管理活动与企业整体战略的匹配与协同。')

q(2, '在职位分析中，用来描述职位对任职者知识、技能要求的部分称为（  ）。',
  ['A. 职位描述', 'B. 任职资格', 'C. 工作规范', 'D. 职业通道'], 'C',
  '工作规范（Job Specification）侧重描述任职者应具备的素质条件。')

q(3, '下列不属于内部招募优点的是（  ）。',
  ['A. 降低招聘成本', 'B. 员工适应性快', 'C. 激励作用明显', 'D. 带来新思想新方法'], 'D',
  '带来新观点、新方法是外部招募的优势。')

q(4, '薪酬调查的主要目的不包括（  ）。',
  ['A. 了解市场薪酬水平', 'B. 调整本企业薪酬结构',
   'C. 确定员工晋升名单', 'D. 控制人工成本'], 'C',
  '薪酬调查服务于外部竞争性与内部公平性，与晋升无直接关系。')

q(5, '劳动关系中，集体合同的主体是（  ）。',
  ['A. 员工个人与企业', 'B. 工会与企业', 'C. 政府与企业', 'D. 员工与工会'], 'B',
  '集体合同由工会代表职工一方与企业签订。')

q(6, '培训效果评估的柯氏四级模型中最基础的一级是（  ）。',
  ['A. 反应层', 'B. 学习层', 'C. 行为层', 'D. 结果层'], 'A',
  '柯克帕特里克模型依次为反应、学习、行为、结果四个层次。')

line('二、多项选择题（每题 2 分，共 4 题）', 10, 24)

q(7, '绩效管理系统通常包括以下哪些环节（  ）。',
  ['A. 绩效计划', 'B. 绩效实施与管理', 'C. 绩效考核', 'D. 绩效反馈与面谈'], 'ABCD',
  '四个环节构成完整的绩效管理闭环，缺一不可。')

q(8, '影响薪酬水平的外部因素包括（  ）。',
  ['A. 劳动力市场供求', 'B. 地区生活费用', 'C. 行业薪酬水平', 'D. 企业支付能力'], 'ABC',
  '企业支付能力属于内部因素，不属于外部因素。')

q(9, '员工培训需求分析通常包括的层面有（  ）。',
  ['A. 组织分析', 'B. 任务分析', 'C. 人员分析', 'D. 财务分析'], 'ABC',
  '培训需求分析包括组织、任务、人员三个层面。')

q(10, '下列属于劳动合同必备条款的有（  ）。',
  ['A. 劳动合同期限', 'B. 工作内容和工作地点',
   'C. 劳动报酬', 'D. 试用期约定'], 'ABC',
  '试用期属于约定条款而非必备条款。')

line('三、判断题（每题 1 分，共 5 题）', 10, 24)

q(11, '劳动合同期限三个月以上不满一年的，试用期不得超过一个月。（  ）', [], '√',
  '依据《劳动合同法》第十九条规定。')

q(12, '培训需求分析只需要在组织层面开展即可。（  ）', [], '×',
  '培训需求分析应包括组织分析、任务分析和个人分析三个层面。')

q(13, '结构化面试的评分标准相对统一，信度较高。（  ）', [], '√',
  '统一维度与评分标准可降低评分者主观偏差。')

q(14, '员工离职率越低说明企业管理水平越高。（  ）', [], '×',
  '适度的流动有利于组织更新，过低可能意味着活力不足。')

q(15, '内部晋升属于外部招募渠道的一种。（  ）', [], '×',
  '内部晋升属于内部招募渠道。')

footer()
c.showPage()
c.save()
print('已生成 test-bank.pdf，共 %d 页' % page)
