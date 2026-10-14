import { describe, expect, it } from 'vitest';
import { HEXAGRAM_LIST, type Hexagram } from '@plumora/knowledge';
import { resolve } from '../src/resolve.js';
import { classifyQuestion, interpret, type QuestionDomain } from '../src/interpret.js';
import type { ResolvedHexagram, TiYongRule } from '../src/types.js';

/** 造一个排盘结果：上卦 / 下卦 / 动爻 + 体用规则（默认通行规则：动爻所在为用） */
function make(upper: number, lower: number, moving: number, rule: TiYongRule = 'MOVING_LINE'): ResolvedHexagram {
  return resolve(upper as 1, lower as 4, moving, rule);
}

describe('classifyQuestion 领域识别', () => {
  const cases: readonly [string, QuestionDomain][] = [
    ['我最近想跳槽，去新公司好吗', 'CAREER'],
    ['这个项目能不能谈成', 'CAREER'],
    ['投资这只股票能赚吗', 'WEALTH'],
    ['今年的财运怎么样', 'WEALTH'],
    ['她对我还有感情吗', 'LOVE'],
    ['该不该跟他表白', 'LOVE'],
    ['身体不舒服，要去医院吗', 'HEALTH'],
    ['这次考研能上岸吗', 'STUDY'],
    ['下周出差顺利吗', 'TRAVEL'],
    ['丢失的手机能找到吗', 'SEARCH'],
    ['这场官司能赢吗', 'DISPUTE'],
    ['随缘问一事', 'GENERAL'],
    ['', 'GENERAL'],
  ];

  for (const [q, expected] of cases) {
    it(`「${q}」→ ${expected}`, () => {
      expect(classifyQuestion(q)).toBe(expected);
    });
  }

  it('长关键词优先：「找工作」应归事业而非寻人寻物', () => {
    expect(classifyQuestion('找工作')).toBe('CAREER');
  });
});

describe('interpret 结构完整性', () => {
  it('六节齐全且均非空', () => {
    const r = make(5, 4, 4); // 巽上震下，动爻 4 在上卦 → 用巽、体震（皆木）
    const out = interpret(r, '我最近想跳槽，去新公司好吗');
    expect(out.domain).toBe('CAREER');
    expect(out.domainCn).toBe('事业工作');
    expect(out.headline).toContain('比和'); // 巽木 vs 震木
    expect(out.sections.map((s) => s.label)).toEqual([
      '这件事是吉是凶',
      '事情会怎么发展',
      '最后是什么结果',
      '对应到你的生活里',
      '什么时候应验',
      '古人留下的说法',
    ]);
    for (const s of out.sections) {
      expect(s.body.length).toBeGreaterThan(0);
    }
    expect(out.advice).toContain('事业上');
  });

  it('问题为空 → 泛断 + 提示语', () => {
    const r = make(5, 4, 4);
    const out = interpret(r, '');
    expect(out.domain).toBe('GENERAL');
    expect(out.sections[0].body).toContain('没有记下');
    expect(out.advice).toContain('事在人为');
  });

  it('问题原样带回（不去首尾空格）', () => {
    const r = make(5, 4, 4);
    const out = interpret(r, '  所问  ');
    expect(out.question).toBe('  所问  ');
    expect(out.sections[0].body).toContain('所问');
  });

  it('表述口径：不出现绝对化措辞', () => {
    const r = make(5, 4, 4);
    for (const q of ['', '财运如何', '感情如何', '身体健康吗']) {
      const out = interpret(r, q);
      const all = [out.headline, ...out.sections.map((s) => s.body), out.advice, out.answer].join('');
      expect(all).not.toMatch(/必定|注定|将会/);
    }
  });

  it('吉凶总断带上所问之事', () => {
    const r = make(5, 4, 4);
    const out = interpret(r, '今年的财运怎么样');
    expect(out.sections[0].body).toContain('今年的财运怎么样');
  });
});

describe('interpret 最终答案', () => {
  it('答案带上所问之事与结论词（吉）', () => {
    const r = make(5, 4, 4); // 体用比和 → 吉
    const out = interpret(r, '这场官司能赢吗');
    expect(out.domain).toBe('DISPUTE');
    expect(out.answer).toContain('这场官司能赢吗');
    expect(out.answer).toContain('争得赢');
  });

  it('答案按领域给结论词（凶）', () => {
    // 上兑下震 + 手写流派 → 用克体 大凶
    const r = make(2, 4, 4, 'UPPER_YONG_LOWER_TI');
    const out = interpret(r, '投资这只股票能赚吗');
    expect(out.answer).toContain('难进');
  });

  it('问题为空 → 泛断答案', () => {
    const r = make(5, 4, 4);
    const out = interpret(r, '');
    expect(out.answer).toContain('没有具体所问');
  });

  it('本吉变凶 → 答案带「走势往下」提醒', () => {
    const r = make(5, 4, 3); // 本卦比和吉 → 变卦体生用小凶
    const out = interpret(r, '事业如何');
    expect(out.answer).toContain('走势往下');
  });

  it('本凶变吉 → 答案带「走势往上」鼓励', () => {
    const r = make(2, 4, 4, 'UPPER_YONG_LOWER_TI'); // 本卦大凶 → 变卦用生体大吉
    const out = interpret(r, '感情如何');
    expect(out.answer).toContain('走势往上');
  });
});

describe('interpret 趋势判断', () => {
  it('本卦吉、变卦凶 → 先顺后逆提示', () => {
    // 巽上震下（体巽木/用震木 比和吉），动爻 3（上卦中爻）→ 变后上卦变离（火）
    // 体巽木 vs 变之用离火：木生火 = 体生用（小凶）→ 吉转凶
    const r = make(5, 4, 3);
    expect(r.judge.relation).toBe('BI_HE');
    expect(r.bianJudge.relation).toBe('TI_SHENG_YONG');
    const out = interpret(r, '');
    expect(out.headline).toContain('先顺后逆');
    expect(out.sections[0].body).toContain('先顺后逆');
  });

  it('本卦凶、变卦吉 → 先难后易提示', () => {
    // 上兑（金）下震（木），手写笔记流派：上卦恒为用、下卦恒为体 → 体震木、用兑金，金克木 大凶；
    // 动爻 4（上卦初爻，兑 0b011 → 坎 0b010）→ 变上坎下震，用变坎水生木 大吉
    const r = make(2, 4, 4, 'UPPER_YONG_LOWER_TI');
    expect(r.judge.relation).toBe('YONG_KE_TI');
    expect(r.bianJudge.relation).toBe('YONG_SHENG_TI');
    const out = interpret(r, '');
    expect(out.headline).toContain('先难后易');
  });
});

describe('interpret 六十四卦全覆盖', () => {
  const questions = ['事业如何', '财运如何', '感情如何', '身体如何', '考试如何', '出行如何', '寻物如何', '官司如何', ''];

  it('每卦 × 每领域均产出完整非空文案', () => {
    for (const hex of HEXAGRAM_LIST as readonly Hexagram[]) {
      for (const moving of [1, 2, 3, 4, 5, 6]) {
        const r = resolve(hex.upper, hex.lower, moving);
        for (const q of questions) {
          const out = interpret(r, q);
          expect(out.sections).toHaveLength(6);
          for (const s of out.sections) {
            expect(s.body.length, `${hex.code} ${moving} ${q} ${s.label}`).toBeGreaterThan(0);
          }
          expect(out.advice.length).toBeGreaterThan(0);
          expect(out.headline.length).toBeGreaterThan(0);
          expect(out.answer.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
