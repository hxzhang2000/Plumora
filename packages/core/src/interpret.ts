/* ============================================================
 * 解卦引擎 —— 结合卦象与所问之事，生成传统断法参考
 *
 * 方法（梅花易数传统断法；规则口径见 03 文档 §四、05 文档 §2.2 类象表）：
 *   1. 体用生克定吉凶：本卦为主体，互卦看过程，变卦看结局；
 *   2. 八卦类象应事：按所问领域选取体 / 用卦的相关类象；
 *   3. 应期：由体 / 用卦的时令推断；
 *   4. 古占参考：卦意关键词 + 动爻爻辞。
 *
 * 表述口径（06 文档 §五「断卦表述」）：用「主 / 多 / 恐 / 宜」，
 * 禁用「你将会 / 必定 / 注定」等绝对化措辞。
 *
 * 本文件为平台无关纯函数：无 DOM / 框架 / 第三方依赖。
 * ============================================================ */

import { ELEMENT_CN, type Trigram, trigram } from '@plumora/knowledge';
import {
  RELATION_CN,
  type FortuneDegree,
  type Relation,
  type ResolvedHexagram,
} from './types.js';

/* ---------- 所问领域 ---------- */

export type QuestionDomain =
  | 'CAREER'
  | 'WEALTH'
  | 'LOVE'
  | 'HEALTH'
  | 'STUDY'
  | 'TRAVEL'
  | 'SEARCH'
  | 'DISPUTE'
  | 'GENERAL';

export const DOMAIN_CN: Readonly<Record<QuestionDomain, string>> = Object.freeze({
  CAREER: '事业工作',
  WEALTH: '财运',
  LOVE: '感情',
  HEALTH: '健康',
  STUDY: '学业',
  TRAVEL: '出行',
  SEARCH: '寻人寻物',
  DISPUTE: '官司纠纷',
  GENERAL: '综合',
});

interface DomainDef {
  readonly id: QuestionDomain;
  /** 关键词：命中计分 = 关键词字数（长词更具体，避免「找」误中「找工作」） */
  readonly keywords: readonly string[];
  /** 该领域重点参考的类象栏目 */
  readonly focus: readonly (keyof Trigram)[];
  /** 领域建议（接在吉凶建议之后） */
  readonly tip: string;
}

const DOMAINS: readonly DomainDef[] = [
  {
    id: 'LOVE',
    keywords: ['感情', '恋爱', '暗恋', '表白', '追求', '婚姻', '结婚', '复合', '分手', '离婚', '对象', '男友', '女友', '桃花', '相亲', '喜欢', '爱情'],
    focus: ['figures', 'affairs'],
    tip: '感情之事，诚以待人，勿急勿迫，强求反失。',
  },
  {
    id: 'WEALTH',
    keywords: ['财运', '钱财', '投资', '股票', '基金', '理财', '生意', '买卖', '订单', '收入', '奖金', '分红', '借贷', '讨债', '彩票', '赌', '发财', '赚钱'],
    focus: ['objects', 'affairs'],
    tip: '财事宜留余地，忌贪忌赌，见好即收。',
  },
  {
    id: 'CAREER',
    keywords: ['工作', '事业', '职业', '升职', '升迁', '加薪', '跳槽', '求职', '面试', '创业', '项目', '合作', '谈判', '上司', '领导', '离职', '公司', '上班', '调动'],
    focus: ['figures', 'affairs'],
    tip: '事业之事，谋定后动，多与长者、前辈商议。',
  },
  {
    id: 'STUDY',
    keywords: ['考试', '学习', '学校', '录取', '考研', '考公', '考证', '毕业', '论文', '上课', '成绩', '升学', '测验'],
    focus: ['affairs', 'figures'],
    tip: '学业之事，勤为本、卦为参考，脚踏实地方能应验。',
  },
  {
    id: 'HEALTH',
    keywords: ['身体', '健康', '病情', '疾病', '医院', '手术', '体检', '怀孕', '生胎', '不舒服', '难受', '看病'],
    focus: ['body', 'animals'],
    tip: '身体之事，宜速就医检查，勿恃卦象而迟。',
  },
  {
    id: 'TRAVEL',
    keywords: ['出行', '旅游', '旅行', '远行', '出差', '搬家', '迁移', '出门', '回国', '机票', '行程'],
    focus: ['direction', 'geo'],
    tip: '出行之事，宜择定时日，备齐行具，途中注意安全。',
  },
  {
    id: 'SEARCH',
    keywords: ['寻找', '找回', '丢失', '失物', '寻人', '不见', '下落', '丢了'],
    focus: ['geo', 'objects'],
    tip: '寻人寻物，可按类象所示方位、特征细查，久寻自有踪迹。',
  },
  {
    id: 'DISPUTE',
    keywords: ['官司', '诉讼', '起诉', '纠纷', '投诉', '维权', '被告', '辩护'],
    focus: ['affairs', 'figures'],
    tip: '争讼之事，以和为贵，宜早谋和解，久讼两伤。',
  },
];

/** 问题 → 领域（按命中关键词字数计分，取得分最高者；无命中归「综合」） */
export function classifyQuestion(question: string): QuestionDomain {
  const q = question.trim();
  if (!q) return 'GENERAL';
  let best: QuestionDomain = 'GENERAL';
  let bestScore = 0;
  for (const d of DOMAINS) {
    let score = 0;
    for (const kw of d.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d.id;
    }
  }
  return best;
}

/* ---------- 输出结构 ---------- */

export interface InterpretationSection {
  /** 小节标题，如「吉凶总断」 */
  readonly label: string;
  readonly body: string;
}

export interface Interpretation {
  /** 所问之事（原样带回，可能为空串） */
  readonly question: string;
  readonly domain: QuestionDomain;
  readonly domainCn: string;
  /** 总断标题，如「用生体 · 大吉　先难后易，终有转机」 */
  readonly headline: string;
  readonly sections: readonly InterpretationSection[];
  /** 行动建议（吉凶建议 + 领域建议） */
  readonly advice: string;
  /** 最终答案：结合所问之事与卦象给出的一句话结论 + 理由 + 叮嘱 */
  readonly answer: string;
}

/* ---------- 吉凶度量 ---------- */

/** 吉程度量（越大越吉）：大凶 1 < 小凶 2 < 吉 3 < 小吉 4 < 大吉 5 */
const GOODNESS: Readonly<Record<FortuneDegree, number>> = Object.freeze({
  DA_XIONG: 1,
  XIAO_XIONG: 2,
  JI: 3,
  XIAO_JI: 4,
  DA_JI: 5,
});

const HEADLINE_BASE: Readonly<Record<FortuneDegree, string>> = Object.freeze({
  DA_JI: '用生体 · 大吉',
  XIAO_JI: '体克用 · 小吉',
  JI: '体用比和 · 吉',
  XIAO_XIONG: '体生用 · 小凶',
  DA_XIONG: '用克体 · 大凶',
});

/** 本卦与变卦的走势措辞 */
function trendOf(benG: number, bianG: number): string {
  if (bianG > benG) {
    return benG >= 3 ? '愈往后愈顺，渐入佳境' : '先难后易，终有转机';
  }
  if (bianG < benG) {
    return bianG >= 3 ? '后势稍减，宜守成' : '先顺后逆，结局宜防';
  }
  return '本末一致，始终如一';
}

/* ---------- 各节文案 ---------- */

function headlineOf(r: ResolvedHexagram): string {
  const trend = trendOf(GOODNESS[r.judge.degree], GOODNESS[r.bianJudge.degree]);
  return `${HEADLINE_BASE[r.judge.degree]}　${trend}`;
}

function verdictOf(r: ResolvedHexagram, question: string): string {
  const ti = trigram(r.ti);
  const yong = trigram(r.yong);
  const j = r.judge;
  const lead = question.trim()
    ? `你问的是「${question.trim()}」。从这一卦来看：`
    : '这次没有记下具体问的是什么事，先就整卦泛泛地看：';
  const base = `本卦是${r.ben.name}。其中"体卦"代表你自己，是${ti.name}，五行属${ELEMENT_CN[j.tiElement]}；"用卦"代表你问的这件事，是${yong.name}，五行属${ELEMENT_CN[j.yongElement]}。两者放在一起看，${j.summary}。`;
  return lead + base + trendSentenceOf(r);
}

/** 由本 / 互 / 变三卦生克合成走势断语 */
function trendSentenceOf(r: ResolvedHexagram): string {
  const bg = GOODNESS[r.judge.degree];
  const hg = GOODNESS[r.huJudge.degree];
  const gn = GOODNESS[r.bianJudge.degree];
  if (bg >= 3 && hg >= 3 && gn >= 3) {
    return `中间的互卦和最后的变卦，生克都顺畅，这件事大有可为。`;
  }
  if (bg <= 2 && hg <= 2 && gn <= 2) {
    return `中间的互卦和最后的变卦，生克都不利，这件事阻碍较多，不宜硬来。`;
  }
  if (bg >= 3 && gn <= 2) {
    return `本卦虽说吉利，但最后的变卦是${r.bian.name}（${RELATION_CN[r.bianJudge.relation]}），恐怕先顺后逆，结局要多留神。`;
  }
  if (bg <= 2 && gn >= 3) {
    return `本卦虽然阻力大，但最后的变卦是${r.bian.name}（${RELATION_CN[r.bianJudge.relation]}），属于先难后易，最后能有转机。`;
  }
  return `中间的互卦是${r.hu.name}（${RELATION_CN[r.huJudge.relation]}），代表事情的过程；最后的变卦是${r.bian.name}（${RELATION_CN[r.bianJudge.relation]}），代表事情的结局。有起有伏，宜稳扎稳打、步步为营。`;
}

const PROCESS_NOTE: Readonly<Record<Relation, string>> = Object.freeze({
  YONG_SHENG_TI: '事情推进中常有贵人、外力帮衬，遇到的人和环境多半能为你所用。',
  TI_KE_YONG: '过程主要由你自己掌控，适合主动出手推进，别坐着等。',
  BI_HE: '过程平顺协调，不会有大波折。',
  TI_SHENG_YONG: '过程中你要不断投入付出，注意别累坏自己、别把精力耗空。',
  YONG_KE_TI: '过程中容易遇到牵制和麻烦，宜谨慎守成，别强推。',
});

function processOf(r: ResolvedHexagram): string {
  const hj = r.huJudge;
  return `互卦是事情发展到中间的样子，由本卦的二到四爻、三到五爻交叠而成，成为${r.hu.name}。从体用上看是${RELATION_CN[hj.relation]}：${hj.traditional}。${PROCESS_NOTE[hj.relation]}`;
}

const OUTCOME_NOTE: Readonly<Record<Relation, string>> = Object.freeze({
  YONG_SHENG_TI: '最后能有外力成全，你求的事多半能成。',
  TI_KE_YONG: '结局握在你自己手里，收官对你有利。',
  BI_HE: '结局平平和和，不会大起大落。',
  TI_SHENG_YONG: '事情虽能成，但可能很折腾、损耗大，记得给自己留点后劲。',
  YONG_KE_TI: '结局受制于人，宜早做退一步的打算。',
});

function outcomeOf(r: ResolvedHexagram): string {
  const bj = r.bianJudge;
  return `动的那一爻是${r.movingLineName}，它一变，本卦就变成了${r.bian.name}。从体用上看是${RELATION_CN[bj.relation]}：${bj.traditional}。${OUTCOME_NOTE[bj.relation]}`;
}

/** 各类象栏目取首词（类象为顿号分隔的短语串） */
function firstItem(v: string): string {
  const head = v.split(/[、，,；;]/)[0]?.trim();
  return head && head.length ? head : v;
}

const IMAGERY_NOTE: Readonly<Record<QuestionDomain, (ti: Trigram, yong: Trigram) => string>> =
  Object.freeze({
    CAREER: (ti, yong) =>
      `问事业，"用卦"代表这件事和外部环境，"体卦"代表你本人。用卦是${yong.name}，你遇到的人多半像${firstItem(yong.figures)}一类，事情也带有「${firstItem(yong.affairs)}」的意味；体卦是${ti.name}，说明你自己的状态偏${ti.nature}。量力而行就好。`,
    WEALTH: (ti, yong) =>
      `问财，"用卦"代表钱财和机会，"体卦"代表你抓不抓得住。用卦是${yong.name}，财的样子近于「${firstItem(yong.objects)}」；体卦是${ti.name}，你自己偏「${firstItem(ti.objects)}」一路。财的来去，从这两象里参看。`,
    LOVE: (ti, yong) =>
      `问感情，"用卦"是对方，"体卦"是你。用卦是${yong.name}，对方性情偏${yong.nature}，相处中多「${firstItem(yong.affairs)}」的意味；体卦是${ti.name}，你偏${ti.nature}。两个性子合得来就顺，合不来就吵。`,
    HEALTH: (ti, yong) =>
      `"体卦"代表你的身体，重点看${firstItem(ti.body)}；"用卦"代表病象，重点在${firstItem(yong.body)}，${yong.season}当令的时候要特别当心。身体的事，最终还是以医院检查为准。`,
    STUDY: (ti, yong) =>
      `问学业，"体卦"看你用不用功，"用卦"看机会。体卦是${ti.name}，性情${ti.nature}；用卦是${yong.name}，带「${firstItem(yong.affairs)}」的意味。功夫在自己，卦象只作参考。`,
    TRAVEL: (ti, yong) =>
      `问出行，"用卦"是你要去的地方：方位在${yong.direction}，地势近于「${firstItem(yong.geo)}」；"体卦"是你自己，方位在${ti.direction}。`,
    SEARCH: (ti, yong) =>
      `寻东西，"用卦"就是你丢的东西：样子近于「${firstItem(yong.objects)}」，方位在${yong.direction}，多在近「${firstItem(yong.geo)}」的地方；"体卦"是${ti.name}，代表找东西的你。按这个方位和特征细查，多半有踪迹。`,
    DISPUTE: (ti, yong) =>
      `起争执、打官司，"体卦"是你，"用卦"是对方。用卦是${yong.name}，对方性情${yong.nature}；体卦是${ti.name}，你这边${ti.nature}。两边气势谁强谁弱，看体用生克就知道了。`,
    GENERAL: (ti, yong) =>
      `"体卦"${ti.name}代表你，是${ti.nature}之象（多「${firstItem(ti.affairs)}」）；"用卦"${yong.name}代表这件事，是${yong.nature}之象（多「${firstItem(yong.affairs)}」）。以体为己、以用为事，生克就是人事的应验。`,
  });

function imageryOf(r: ResolvedHexagram, domain: QuestionDomain): string {
  const ti = trigram(r.ti);
  const yong = trigram(r.yong);
  return IMAGERY_NOTE[domain](ti, yong);
}

function timingOf(r: ResolvedHexagram): string {
  const ti = trigram(r.ti);
  const yong = trigram(r.yong);
  const base = `按五行时令推算：${ti.name}属${ELEMENT_CN[ti.element]}，在${ti.season}当令；${yong.name}属${ELEMENT_CN[yong.element]}，在${yong.season}当令。`;
  const rel = r.judge.relation;
  if (rel === 'YONG_KE_TI') {
    return `${base}用克体，要留神的时间是用卦当令的日子（${yong.season}），那时候容易出状况，凡事缓一缓。`;
  }
  if (rel === 'TI_KE_YONG') {
    return `${base}体克用，事情有结果，多半在你自己当令的日子（${ti.season}）。`;
  }
  if (rel === 'YONG_SHENG_TI') {
    return `${base}用生体，贵人来助，多在用卦当令的前后（${yong.season}）。`;
  }
  if (rel === 'TI_SHENG_YONG') {
    return `${base}体生用，你多付出的阶段在用卦当令的前后（${yong.season}），早作准备。`;
  }
  return `${base}体用比和，两个卦共同当令的月份最顺，没什么大阻碍。`;
}

/** 剥离开头「名称：」前缀（数据层爻辞释义以爻名开头） */
function stripNamePrefix(text: string, name: string): string {
  const prefix = `${name}：`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function ancientOf(r: ResolvedHexagram): string {
  const kw = r.ben.keywords.filter(Boolean).join('、');
  const line = r.ben.lines?.[r.moving - 1];
  const parts: string[] = [`本卦是${r.ben.name}，这一卦的主旨是${kw || '未录'}。`];
  if (line) {
    parts.push(`你动的那一爻是${r.movingLineName}，古人留给我们的爻辞是：「${line.text}」`);
    if (line.meaning) {
      const m = stripNamePrefix(line.meaning, line.name);
      parts.push(`用大白话说就是：${m.endsWith('。') ? m : `${m}。`}`);
    }
  }
  return parts.join('');
}

/* ---------- 最终答案 ---------- */

/** 领域结论词：[吉, 凶] —— 把体用生克直接落到所问之事上的一句话答案 */
const ANSWER_WORD: Readonly<Record<QuestionDomain, readonly [good: string, bad: string]>> = Object.freeze({
  CAREER: ['能成', '难成'],
  WEALTH: ['能赚', '难进'],
  LOVE: ['能成', '难成'],
  HEALTH: ['会好', '难好'],
  STUDY: ['能如意', '难如意'],
  TRAVEL: ['走得顺', '宜缓行'],
  SEARCH: ['找得回', '难寻回'],
  DISPUTE: ['争得赢', '争不过'],
  GENERAL: ['可行', '宜缓'],
});

/** 吉凶理由：体用生克落到事上的解释（按本卦定调） */
const ANSWER_REASON: Readonly<Record<FortuneDegree, string>> = Object.freeze({
  DA_JI: '用卦生体卦，这件事本身就带着帮你的势，外力、贵人都在你这边，不必太费力。',
  XIAO_JI: '体卦克用卦，主动权握在你自己手里，主动谋划、慢慢推，就会有收获。',
  JI: '体用比和，你和这件事气场相合，不冲不克，顺顺当当。',
  XIAO_XIONG: '体卦生用卦，是你在迁就这件事，得多投入、多付出，回报却要打折。',
  DA_XIONG: '用卦克体卦，这件事反过来压你，强推容易受伤，宜守不宜攻。',
});

/** 领域叮嘱：[吉, 凶] */
const ANSWER_TAIL: Readonly<Record<QuestionDomain, readonly [good: string, bad: string]>> = Object.freeze({
  CAREER: [
    '事业上该争的争、该接的敢接，势头在你这边；长辈、前辈那边也可以多走动请教。',
    '事业上先守住现在的盘子，别贸然跳槽、别大动干戈，等风头过去再说。',
  ],
  WEALTH: [
    '财上有进益之象，进得来也要守得住，见好就收、落袋为安。',
    '财上先收紧，看紧本钱；投机的、垫钱的事，这几天先放一放。',
  ],
  LOVE: [
    '感情上对方那边有善意、有回应，可以放心往前迈一步。',
    '感情上别逼太紧，越急越僵；把劲收一收，对彼此都好。',
  ],
  HEALTH: [
    '身体没什么大碍，按时作息、配合调养，会慢慢好转。',
    '身体这根弦别硬撑，宜早检查、早治疗，别只看着卦象耽误病情。',
  ],
  STUDY: [
    '学业考试运在线，正常发挥就有好结果，安心去考。',
    '这回多半使不上全力，成绩恐不如预期；别自乱阵脚，把功夫下在平时。',
  ],
  TRAVEL: [
    '出行可按计划走，路上平安，也有收获。',
    '出行易有波折，不是非走不可的话，改期更稳；非要走，路上多留心。',
  ],
  SEARCH: [
    '东西丢不了，照卦里说的方位、特征去找，找得回来。',
    '东西一时难寻，沿老路和常待的地方细查，别急着认定丢了。',
  ],
  DISPUTE: [
    '纠纷官司你占理，去争能争得过来，但赢了也见好就收。',
    '争讼不利，以和为贵，主动谋和解比硬扛到底强。',
  ],
  GENERAL: [
    '此事可行，顺势而为就有好结果。',
    '此事眼下不宜强推，缓一缓、退一步，反而是上策。',
  ],
});

/** 走势修饰语：本卦与变卦的生克走向 */
function trendModifierOf(r: ResolvedHexagram): string {
  const benG = GOODNESS[r.judge.degree];
  const bianG = GOODNESS[r.bianJudge.degree];
  const good = benG >= 3;
  if (bianG > benG) {
    return good
      ? '走势往上：越往后越顺，现在使的劲后面都有回报。'
      : '但走势往上：开头虽难，往后会慢慢顺起来，挺过去就有转机。';
  }
  if (bianG < benG) {
    return good
      ? '但走势往下：后头不如前头，眼下顺也别大意，收尾要守住。'
      : '走势也往下：前后都吃力，别抱侥幸，缓行为上。';
  }
  return good
    ? '前后势头一致，稳得住。'
    : '前后势头一致，都不松快，宜按兵不动。';
}

function answerOf(r: ResolvedHexagram, question: string, domain: QuestionDomain): string {
  const band: 0 | 1 = GOODNESS[r.judge.degree] >= 3 ? 0 : 1;
  const lead = question.trim()
    ? `问「${question.trim()}」，一句话的答案：${ANSWER_WORD[domain][band]}。`
    : `这一卦没有具体所问，就整卦而论，一句话的答案：${ANSWER_WORD[domain][band]}。`;
  return `${lead}${ANSWER_REASON[r.judge.degree]}${trendModifierOf(r)}${ANSWER_TAIL[domain][band]}`;
}

/* ---------- 建议 ---------- */

const ADVICE_BASE: Readonly<Record<FortuneDegree, string>> = Object.freeze({
  DA_JI: '有外力帮你，适合趁热打铁，别错过好时机。',
  XIAO_JI: '成事靠自己，主动谋划、慢慢来，会有收获。',
  JI: '整体顺利，按常理去做就有结果。',
  XIAO_XIONG: '可能多付出、少回报，别贪大，控制投入。',
  DA_XIONG: '受制受阻，宜守不宜攻，等时机再动。',
});

const DOMAIN_TIP: Readonly<Record<QuestionDomain, string>> = Object.freeze({
  CAREER: '事业上谋定而后动，多和长辈、前辈商量。',
  WEALTH: '钱财上留余地，不贪不赌，见好就收。',
  LOVE: '感情上以诚待人，别急别逼，强求反而得不到。',
  HEALTH: '身体的事尽快去医院检查，别只靠卦象耽误病情。',
  STUDY: '学业靠勤奋，卦象只是参考，脚踏实地才灵。',
  TRAVEL: '出行挑好日子，带齐东西，路上注意安全。',
  SEARCH: '寻人寻物，照卦里说的方位、特征仔细找，找久了会有线索。',
  DISPUTE: '官司以和为贵，早点想办法和解，拖久了两败俱伤。',
  GENERAL: '一事一占，心诚则灵；事在人为，卦象仅供参考。',
});

/* ---------- 主入口 ---------- */

/**
 * 解卦：结合卦象与所问之事，生成传统断法参考。
 *
 * @param resolved  排盘结果（含本 / 互 / 变三卦与体用生克判断）
 * @param question  所问之事（可为空；为空时按「综合」泛断）
 */
export function interpret(resolved: ResolvedHexagram, question = ''): Interpretation {
  const domain = classifyQuestion(question);

  const sections: InterpretationSection[] = [
    { label: '这件事是吉是凶', body: verdictOf(resolved, question) },
    { label: '事情会怎么发展', body: processOf(resolved) },
    { label: '最后是什么结果', body: outcomeOf(resolved) },
    { label: '对应到你的生活里', body: imageryOf(resolved, domain) },
    { label: '什么时候应验', body: timingOf(resolved) },
    { label: '古人留下的说法', body: ancientOf(resolved) },
  ];

  return {
    question,
    domain,
    domainCn: DOMAIN_CN[domain],
    headline: headlineOf(resolved),
    sections,
    advice: `${ADVICE_BASE[resolved.judge.degree]}${DOMAIN_TIP[domain]}`,
    answer: answerOf(resolved, question, domain),
  };
}
