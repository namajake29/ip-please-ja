'use strict';
// 剧本数据：每天的报纸、固定角色（宣传视频里那几位）、随机路人、特殊事件。
//
// 旅客 spec：
//   person   立绘 key（ASSETS.people）       voice  假语音音高
//   intro    进门后说的话                    after  递完证件后说的话
//   docs     证件列表 {key, doc}             primary 要盖章的主证件 key
//   ok       正确处理方式（approve / deny / detain 的子集）
//   reason   放错人时警告单上写的理由         hint   警告单上的提示
//   issues   检查模式里能点出来的矛盾：{pairs, title, sub, ask, fx}；pairs 里只有一项的，单点即触发
//   xray     X 光下口袋里的东西 [{icon, at, label, key}]
//   quiz     'cn' = 测谎会露馅；{first: n} 指定第一题
//   react    盖章后的反应 {deny: [...], approve: [...]}
//   onPlace  证件第一次放到桌上时触发的机关：note / nest / accordion
//   then     旅客离开后的后续：closeup / jorji5 / ending
// 台词步骤：[who, text, {expr, sweat, slip, fight, hold}]，who = 'C' Claude / 'E' 旅客 / 'Q' 队伍里
// 特殊事件：{type: 'rush'} 黑话快剪；{type: 'clones'} 蒸馏大军

const LAST_DAY = 6;
const DATES = {};
const WEEKDAYS = {};

const NEWS = {
  1: { icon: 'gate' },
  2: { icon: 'clock' },
  3: { icon: 'plane' },
  4: { icon: 'drumstick' },
  5: { icon: 'jorji' },
  6: { icon: 'medal' },
};

// city の表示名は英語キー → I18N.t で翻訳。フォールバックは中国語表記。
// cities 配列: [英語キー, tzId, state/abbr, phoneCode, passportEN]
const countryDialogue = (cc, kind) => {
  const lines = I18N.t(`greetings.${cc}.${kind}`);
  return Array.isArray(lines) ? lines : [];
};

const COUNTRIES = {
  US: {
    get name() { return I18N.t('countries.US', {}, '美国'); },
    passport: 'UNITED STATES OF AMERICA', code: 'USA', cover: C.NAVY, band: C.NAVY_L, lang: 'en-US',
    cities: [['New York', 'America/New_York', 'NY', '212', 'NEW YORK'], ['Los Angeles', 'America/Los_Angeles', 'CA', '213', 'LOS ANGELES'],
      ['Chicago', 'America/Chicago', 'IL', '312', 'CHICAGO'], ['Seattle', 'America/Los_Angeles', 'WA', '206', 'SEATTLE'],
      ['Houston', 'America/Chicago', 'TX', '713', 'HOUSTON'], ['Denver', 'America/Denver', 'CO', '720', 'DENVER'],
      ['Boston', 'America/New_York', 'MA', '617', 'BOSTON']],
    first: ['JAMES', 'MARY', 'ROBERT', 'LINDA', 'DAVID', 'SARAH', 'KEVIN', 'ASHLEY', 'BRIAN', 'MEGAN', 'JASON', 'NANCY'],
    last: ['MILLER', 'DAVIS', 'GARCIA', 'WILSON', 'MOORE', 'CLARK', 'LEWIS', 'HALL', 'YOUNG', 'KING', 'LOPEZ', 'NGUYEN'],
    hello: () => countryDialogue('US', 'hello'),
    thanks: () => countryDialogue('US', 'thanks'),
  },
  UK: {
    get name() { return I18N.t('countries.UK', {}, '英国'); },
    passport: 'UNITED KINGDOM', code: 'GBR', cover: [100, 30, 40], band: [130, 50, 60], lang: 'en-GB',
    cities: [['London', 'Europe/London', 'LDN', '+44 20', 'LONDON'], ['Manchester', 'Europe/London', 'MAN', '+44 161', 'MANCHESTER']],
    first: ['OLIVER', 'HARRY', 'AMELIA', 'GEORGE', 'EMMA', 'JACK'],
    last: ['SMITH', 'JONES', 'TAYLOR', 'EVANS', 'HUGHES', 'WRIGHT'],
    hello: () => countryDialogue('UK', 'hello'), thanks: () => countryDialogue('UK', 'thanks'),
  },
  JP: {
    get name() { return I18N.t('countries.JP', {}, '日本'); },
    passport: 'JAPAN', code: 'JPN', cover: [110, 30, 36], band: [140, 50, 52], lang: 'ja-JP',
    cities: [['Tokyo', 'Asia/Tokyo', 'TKY', '+81 3', 'TOKYO'], ['Osaka', 'Asia/Tokyo', 'OSK', '+81 6', 'OSAKA']],
    first: ['HIROSHI', 'YUKI', 'KENJI', 'AIKO', 'TAKESHI', 'HANA'],
    last: ['TANAKA', 'SATO', 'SUZUKI', 'ITO', 'WATANABE', 'KATO'],
    hello: () => countryDialogue('JP', 'hello'), thanks: () => countryDialogue('JP', 'thanks'),
  },
  DE: {
    get name() { return I18N.t('countries.DE', {}, '德国'); },
    passport: 'DEUTSCHLAND', code: 'DEU', cover: [80, 30, 36], band: [110, 46, 50], lang: 'de-DE',
    cities: [['Berlin', 'Europe/Berlin', 'BER', '+49 30', 'BERLIN'], ['Munich', 'Europe/Berlin', 'MUC', '+49 89', 'MUNICH']],
    first: ['LUKAS', 'ANNA', 'FELIX', 'LENA', 'JONAS', 'MIA'],
    last: ['MULLER', 'SCHMIDT', 'WEBER', 'BECKER', 'WAGNER', 'KOCH'],
    hello: () => countryDialogue('DE', 'hello'), thanks: () => countryDialogue('DE', 'thanks'),
  },
  SG: {
    get name() { return I18N.t('countries.SG', {}, '新加坡'); },
    passport: 'REPUBLIC OF SINGAPORE', code: 'SGP', cover: [150, 40, 40], band: [180, 60, 56], lang: 'en-SG',
    cities: [['Singapore', 'Asia/Singapore', 'SG', '+65', 'SINGAPORE']],
    first: ['WEI MING', 'MEI LING', 'JUN JIE', 'HUI MIN', 'RAJ', 'SITI'],
    last: ['TAN', 'LIM', 'LEE', 'NG', 'KUMAR', 'WONG'],
    hello: () => countryDialogue('SG', 'hello'), thanks: () => countryDialogue('SG', 'thanks'),
  },
};
// 都市英語キー → 翻訳済み表示名を返すヘルパー
const cityName = (enKey) => I18N.t(`cities.${enKey}`, {}, enKey);

// CN_LOCS はロケールから取得（翻訳可能）
const CN_LOCS = () => I18N.t('random.cn_locs') || [];
const DEVICES = ['Windows 11', 'MacBook', 'iPhone', 'Android', 'iPad', 'Linux'];
const STREETS = ['12 Oak St', '480 Pine Ave', '77 Maple Dr', '1500 Elm St', '23 Cedar Ln', '9 Lake Rd', '310 Hill St', '6 Birch Ct'];

// 测谎题：中国人听到上半句会条件反射接下半句
const QUIZ = [];
const QUIZ_THURSDAY = 7;

// ———————————————— 工具 ————————————————

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = rint(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const digits = (n) => Array.from({ length: n }, () => rint(0, 9)).join('');

function randIP(cn) {
  const a = cn ? pick([36, 58, 106, 111, 115, 120, 183, 223]) : pick([23, 34, 45, 64, 72, 98, 104, 142, 172, 203]);
  return `${a}.${rint(1, 254)}.${rint(0, 255)}.${rint(1, 254)}`;
}

function randDate(y0, y1) { return `${rint(y0, y1)}.${String(rint(1, 12)).padStart(2, '0')}.${String(rint(1, 28)).padStart(2, '0')}`; }

function makePassport(cc, person, surname, given, dob, iss, sex, Cls = Passport, extraRow = null) {
  const co = COUNTRIES[cc];
  const mrz = `P<${co.code}${surname.replace(/ /g, '<')}<<${given.replace(/[ .]/g, '<')}`.padEnd(28, '<').slice(0, 28);
  const rows = [['DOB', dob], ['SEX', sex || pick(['M', 'F'])], ['ISS', iss], extraRow || ['EXP', randDate(2027, 2034)]];
  return new Cls({ country: co.passport, name: `${surname}, ${given}`, person, cover: co.cover, band: co.band, mrz, rows });
}

const usPassport = (person, surname, given, dob, iss, sex = 'M') => makePassport('US', person, surname, given, dob, iss, sex);
const device1 = (ip, loc) => new Card([
  [I18N.t('docs.cardLabels.ip', {}, 'IP'), ip, 'IP'],
  [I18N.t('docs.cardLabels.loc', {}, '归属'), loc, '归属'],
]);
const device2 = (ip, loc, tz, lang, dev) => new Card([
  [I18N.t('docs.cardLabels.ip', {}, 'IP'), ip, 'IP'],
  [I18N.t('docs.cardLabels.loc', {}, '归属'), loc, '归属'],
  [I18N.t('docs.cardLabels.tz', {}, '时区'), tz, '时区'],
  [I18N.t('docs.cardLabels.lang', {}, '语言'), lang, '语言'],
  [I18N.t('docs.cardLabels.dev', {}, '设备'), dev || pick(DEVICES), '设备'],
]);

function realPhone(cc, code) {
  if (cc === 'US') return `+1 ${code}-${rint(2, 9)}${digits(2)}-${digits(4)}`;
  return `${code} ${digits(4)} ${digits(4)}`;
}
function realPay() { return `${pick(['VISA', 'VISA', 'MASTERCARD', 'AMEX'])} ··${digits(4)}`; }

// —— 常见矛盾 ——
const REGION_ISSUE = (loc, ask) => ({
  pairs: [['dv.归属', 'rule.region'], ['dv.IP', 'rule.region']],
  title: I18N.t('issues.region_title', {}, '地区不支持'),
  sub: I18N.t('issues.region_sub', { loc }, `IP 归属：${loc}`),
  ask,
});
const TZ_ISSUE = (country, tz, ask) => {
  const tzDisp = tz === 'Asia/Shanghai' ? I18N.t('issues.shanghai_time', {}, '北京时间') : tz;
  return {
    pairs: [['pp.header', 'dv.时区'], ['dv.归属', 'dv.时区'], ['dv.时区', 'rule.tz']],
    title: I18N.t('issues.tz_title', {}, '信息不符  DISCREPANCY'),
    sub: I18N.t('issues.tz_sub', { country, tz: tzDisp }, `国籍：${country}   VS   时区：${tzDisp}`),
    ask,
  };
};
const LANG_ISSUE = (country, lang, ask) => ({
  pairs: [['pp.header', 'dv.语言'], ['dv.归属', 'dv.语言'], ['dv.语言', 'rule.tz']],
  title: I18N.t('issues.lang_title', {}, '信息不符  DISCREPANCY'),
  sub: I18N.t('issues.lang_sub', { country, lang }, `国籍：${country}   VS   语言：${lang}`),
  ask,
});
const VIRTUAL_ISSUE = (ask) => ({
  pairs: [['ac.付款', 'rule.pay']],
  title: I18N.t('issues.virtual_title', {}, '可疑支付'),
  sub: I18N.t('issues.virtual_sub', {}, '付款卡类型：虚拟卡'),
  ask,
});
const SMS_ISSUE = (phone, ask) => ({
  pairs: [['ac.手机', 'rule.pay']],
  title: I18N.t('issues.sms_title', {}, '号码查询'),
  sub: I18N.t('issues.sms_sub', { phone }, `${phone}：今日已注册 3,000 次`),
  ask,
  fx: 'strip',
  phone,
});
const ADDR_ISSUE = (ask) => ({
  pairs: [['ac.账单', 'rule.pay'], ['ac.账单', 'dv.归属']],
  title: I18N.t('issues.addr_title', {}, '记录比对'),
  sub: I18N.t('issues.addr_sub', {}, '今天第 37 个住在 123 Main St 的旅客'),
  ask,
  fx: 'pile',
});
// 证件干净的伪装者，话里会露出马脚：检查模式下点 Ta 说的话。找到马脚（或证件矛盾）才能测谎
const TELL = (say, sub, ask) => ({ say, title: I18N.t('issues.tell_title', {}, '可疑：话里有马脚'), sub, ask });
function RANDOM_TELLS() {
  const mk = (n) => {
    const t = I18N.t(`tells.${n}`, {});
    const say = t.say || '';
    const sub = t.sub || say;
    const ask_c = t.ask_c || '';
    const ask_e = t.ask_e || '';
    const expr = n === 4 ? 'grin' : 'nervous';
    return [say, sub, [['C', ask_c], ['E', ask_e, { expr, sweat: true }]]];
  };
  return [mk(1), mk(2), mk(3), mk(4)];
}

const XRAY_ITEM = {
  cat: { icon: 'cat', at: [36, 104], get label() { return I18N.t('xray_labels.cat', {}, '小猫咪.exe'); }, key: 'xr.cat' },
  keys: { icon: 'keys', at: [-36, 104], get label() { return I18N.t('xray_labels.keys', {}, '搜狗输入法.exe'); }, key: 'xr.keys' },
};
const XRAY_ISSUE = (kind, ask) => ({
  pairs: [[XRAY_ITEM[kind].key], [XRAY_ITEM[kind].key, 'rule.xray']],
  title: I18N.t('issues.xray_title', {}, '后台进程'),
  sub: kind === 'cat' ? I18N.t('issues.xray_cat_sub', {}, '口袋里有一只“小猫咪”（自动换 IP）') : I18N.t('issues.xray_keys_sub', {}, '口袋里有一个中文输入法'),
  ask,
});

// ———————————————— Day 1：直连党 ————————————————

function day1Fixed() {
  return {
    grandpa: {
      person: 'GRANDPA', voice: 100,
      intro: [['E', I18N.t('script.day1.grandpa.intro', {}, '小伙子，这 AI 怎么打不开啊？')]],
      docs: [{ key: 'dv', doc: device1('115.236.20.8', I18N.t('script.day1.grandpa.loc', {}, '中国 · 浙江 · 电信')) }], primary: 'dv',
      ok: ['deny'], reason: I18N.t('script.day1.grandpa.reason', {}, 'IP 归属：中国 · 浙江'),
      issues: [REGION_ISSUE(I18N.t('script.day1.grandpa.loc', {}, '中国 · 浙江 · 电信'))],
      react: { deny: [['E', I18N.t('script.day1.grandpa.react_deny', {}, '……那我回去问孙子。'), { expr: 'sad' }]] },
    },
    hk: {
      person: 'HK_GUY', voice: 140,
      intro: [['E', I18N.t('script.day1.hk.intro', {}, '我开了魔法的。')]],
      docs: [{ key: 'dv', doc: device1('103.152.8.21', I18N.t('script.day1.hk.loc', {}, '中国 · 香港')) }], primary: 'dv',
      ok: ['deny'], reason: I18N.t('script.day1.hk.reason', {}, 'IP 归属：中国香港'),
      issues: [REGION_ISSUE(I18N.t('script.day1.hk.loc', {}, '中国 · 香港'))],
      react: { deny: [['E', I18N.t('script.day1.hk.react_deny', {}, '……香港也不行？？'), { expr: 'shock', hold: 1.4 }]] },
    },
    jorji: {
      person: 'JORJI', voice: 110,
      intro: [['E', I18N.t('script.day1.jorji.intro', {}, '啊，我的朋友！')]],
      docs: [{ key: 'cp', doc: new CrayonPassport() }, { key: 'dv', doc: device1('120.229.31.7', I18N.t('script.day1.jorji.loc', {}, '中国 · 广东 · 移动')) }],
      primary: 'cp',
      after: [['E', I18N.t('script.day1.jorji.after', {}, '美国是真的国家！')]],
      ok: ['deny'], reason: I18N.t('script.day1.jorji.reason', {}, '护照是蜡笔画的'),
      issues: [
        {
          pairs: [['cp.eagle', 'cp.header'], ['cp.eagle', 'cp.photo'], ['cp.header', 'cp.photo']],
          title: I18N.t('script.day1.jorji.issue_fake_title', {}, '证件伪造'),
          sub: I18N.t('script.day1.jorji.issue_fake_sub', {}, '国徽：一只鸡     拼写：AMERCIA'),
          ask: [['C', I18N.t('script.day1.jorji.ask_fake_c', {}, '护照是你自己画的。')], ['E', I18N.t('script.day1.jorji.ask_fake_e', {}, '……它很真！'), { expr: 'nervous' }]],
        },
        REGION_ISSUE(I18N.t('script.day1.jorji.loc', {}, '中国 · 广东 · 移动')),
        {
          pairs: [['cp.header', 'dv.归属']],
          title: I18N.t('script.day1.jorji.issue_info_title', {}, '信息不符'),
          sub: I18N.t('script.day1.jorji.issue_info_sub', {}, '护照：美国   VS   IP：中国 · 广东'),
          ask: [['C', I18N.t('script.day1.jorji.ask_info_c', {}, '你的 IP 在广东。')], ['E', I18N.t('script.day1.jorji.ask_info_e', {}, '广东是美国的一个州！'), { expr: 'grin' }]],
        },
      ],
      react: { deny: [['E', I18N.t('script.day1.jorji.react_deny', {}, '……我会回来的。'), { expr: 'sad', hold: 1.2 }]] },
    },
  };
}

function randomDay1(valid) {
  const person = takePoolPerson();
  if (valid) {
    const cc = pick(['US', 'US', 'US', 'UK', 'JP', 'DE', 'SG']);
    const co = COUNTRIES[cc];
    const [cityKey] = pick(co.cities);
    const loc = cc === 'SG' ? I18N.t('countries.SG', {}, '新加坡') : `${co.name} · ${cityName(cityKey)}`;
    return {
      person, voice: rint(100, 190),
      intro: [['E', pick(co.hello())]],
      docs: [{ key: 'dv', doc: device1(randIP(false), loc) }], primary: 'dv',
      ok: ['approve'], issues: [],
      react: { approve: [['E', pick(co.thanks())]] },
    };
  }
  const loc = pick(CN_LOCS().slice(0, 7));
  return {
    person, voice: rint(100, 190),
    intro: [['E', pick(I18N.t('random.day1_cn_intros') || ['你好，我就问一个问题。', '听说这里能写代码？', '我是来充值的。', '同事说这个好用。'])]],
    docs: [{ key: 'dv', doc: device1(randIP(true), loc) }], primary: 'dv',
    ok: ['deny'], reason: `IP 归属：${loc.split(' · ').slice(0, 2).join(' · ')}`,
    issues: [REGION_ISSUE(loc)],
    react: { deny: [['E', pick(I18N.t('random.day1_cn_denies') || ['啊？为什么？', '……我去借个号。', '那我换个节点。', '行吧。']), { expr: 'sad' }]] },
  };
}

// ———————————————— Day 2：时区与语言 ————————————————

function day2Fixed() {
  const usName = I18N.t('countries.US', {}, '美国');
  return {
    john: {
      person: 'JOHN', voice: 125,
      intro: [['E', I18N.t('script.day2.john.intro', {}, 'Hello, I am 美国人。')]],
      docs: [
        { key: 'pp', doc: usPassport('JOHN', 'SMITH', 'JOHN', '1990.07.04', 'LOS ANGELES') },
        { key: 'dv', doc: device2('104.28.66.12', `${usName} · ${cityName('Los Angeles')}`, 'Asia/Shanghai', 'zh-CN', 'Windows 11') },
      ],
      primary: 'pp', quiz: 'cn',
      ok: ['deny', 'detain'], reason: I18N.t('script.day2.john.reason', {}, '时区：北京时间（美国没有东八区）'),
      issues: [
        TZ_ISSUE(usName, 'Asia/Shanghai', [['C', I18N.t('script.day2.john.ask_tz_c', {}, '你的时区是北京时间。')], ['E', I18N.t('script.day2.john.ask_tz_e', {}, '……这是美国东八区。'), { sweat: true, expr: 'nervous', hold: 1.5 }]]),
        LANG_ISSUE(usName, 'zh-CN', [['C', I18N.t('script.day2.john.ask_lang_c', {}, '你的系统语言是简体中文。')], ['E', I18N.t('script.day2.john.ask_lang_e', {}, '……我在学中文。'), { sweat: true, expr: 'nervous' }]]),
      ],
      react: { deny: [{ slip: true, hold: 0.8 }] },
    },
    brown: {
      person: 'BROWN', voice: 120,
      intro: [['E', I18N.t('script.day2.brown.intro', {}, 'Good morning，sir。')]],
      tell: TELL(I18N.t('script.day2.brown.intro', {}, 'Good morning，sir。'), I18N.t('script.day2.brown.tell_sub', {}, '英文里夹着全角标点（输入法没切）'),
        [['C', I18N.t('script.day2.brown.ask_c', {}, '你的逗号是全角的。')], ['E', I18N.t('script.day2.brown.ask_e', {}, '……这是美式逗号。'), { expr: 'nervous', sweat: true }]]),
      docs: [
        { key: 'pp', doc: usPassport('BROWN', 'BROWN', 'MICHAEL', '1985.03.12', 'NEW YORK') },
        { key: 'dv', doc: device2('64.233.160.4', `${usName} · ${cityName('New York')}`, 'America/New_York', 'en-US', 'MacBook') },
      ],
      primary: 'pp', quiz: { first: 0 },
      ok: ['detain', 'deny'], reason: I18N.t('script.day2.brown.reason', {}, 'Ta 会接“一百八一杯”'), hint: I18N.t('script.day2.brown.hint', {}, '提示：用『检查』点 Ta 说的话，找马脚'),
      issues: [],
    },
    emily: {
      person: 'EMILY', voice: 190,
      intro: [['E', I18N.t('script.day2.emily.intro', {}, 'Hi 哈。')]],
      tell: TELL(I18N.t('script.day2.emily.intro', {}, 'Hi 哈。'), I18N.t('script.day2.emily.tell_sub', {}, '英文后面跟了个“哈”'),
        [['C', I18N.t('script.day2.emily.ask_c', {}, '“哈”是什么？')], ['E', I18N.t('script.day2.emily.ask_e', {}, '……Ha! Ha ha.'), { expr: 'nervous', sweat: true }]]),
      docs: [
        { key: 'pp', doc: usPassport('EMILY', 'JONES', 'EMILY', '1992.11.02', 'CHICAGO', 'F') },
        { key: 'dv', doc: device2('23.94.12.77', `${usName} · ${cityName('Chicago')}`, 'America/Chicago', 'en-US', 'iPhone') },
      ],
      primary: 'pp', quiz: { first: 5 },
      ok: ['detain', 'deny'], reason: I18N.t('script.day2.emily.reason', {}, 'Ta 坚持豆腐脑是咸的'), hint: I18N.t('script.day2.emily.hint', {}, '提示：用『检查』点 Ta 说的话，找马脚'),
      issues: [],
    },
    jorji: {
      person: 'JORJI', voice: 110,
      intro: [['E', I18N.t('script.day2.jorji.intro', {}, '我的朋友！这次是真护照！')]],
      docs: [
        { key: 'pp', doc: usPassport('JORJI', 'COSTAVA', 'GEORGE', '1980.02.29', 'LOS ANGELES') },
        { key: 'dv', doc: device2('104.28.9.120', `${usName} · ${cityName('Los Angeles')}`, 'America/Los_Angeles', 'zh-CN', 'Windows 11') },
      ],
      primary: 'pp', quiz: 'cn',
      ok: ['deny', 'detain'], reason: I18N.t('script.day2.jorji.reason', {}, '浏览器语言：zh-CN'),
      issues: [
        LANG_ISSUE(usName, 'zh-CN', [['E', I18N.t('script.day2.jorji.ask_lang_e1', {}, '我已经改了系统语言！'), { expr: 'grin' }], ['C', I18N.t('script.day2.jorji.ask_lang_c', {}, '浏览器没改。')], ['E', I18N.t('script.day2.jorji.ask_lang_e2', {}, '……'), { expr: 'shock' }]]),
      ],
      react: { deny: [['E', I18N.t('script.day2.jorji.react_deny', {}, '明天见，我的朋友。'), { expr: 'sad', hold: 1.1 }]] },
    },
  };
}

// ———————————————— Day 3：付款卡与手机号 ————————————————

function day3Fixed() {
  const usName = I18N.t('countries.US', {}, '美国');
  return {
    tom: {
      person: 'TOM', voice: 100,
      intro: [['E', I18N.t('script.day3.tom.intro', {}, 'Howdy!')]],
      docs: [
        { key: 'pp', doc: usPassport('TOM', 'WILSON', 'TOM', '1978.05.30', 'DENVER') },
        { key: 'dv', doc: device2('75.164.8.31', `${usName} · ${cityName('Denver')}`, 'America/Denver', 'en-US', 'Windows 11') },
        { key: 'ac', doc: accountCard('VISA ··4821', '123 Main St, OR', '+1 720-341-0142') },
      ],
      primary: 'pp', quiz: 'cn',
      ok: ['deny', 'detain'], reason: I18N.t('script.day3.tom.reason', {}, '账单：俄勒冈 123 Main St（代填地址）'),
      issues: [ADDR_ISSUE([['C', I18N.t('script.day3.tom.ask_addr_c', {}, '你住哪？')], ['E', I18N.t('script.day3.tom.ask_addr_e', {}, '……我们是邻居。'), { expr: 'nervous', sweat: true }]])],
    },
    alex: {
      person: 'ALEX', voice: 130,
      intro: [['E', I18N.t('script.day3.alex.intro', {}, 'Hey.')]],
      docs: [
        { key: 'pp', doc: usPassport('ALEX', 'TAYLOR', 'ALEX', '1996.08.15', 'SEATTLE') },
        { key: 'dv', doc: device2('45.79.21.200', `${usName} · ${cityName('Seattle')}`, 'America/Los_Angeles', 'en-US', 'Android') },
        { key: 'ac', doc: accountCard('VISA ··1209', '9 Elm Rd, WA', '+1 209-555-0198') },
      ],
      primary: 'pp', quiz: 'cn',
      ok: ['deny', 'detain'], reason: I18N.t('script.day3.alex.reason', {}, '手机号是 555 接码号'),
      issues: [SMS_ISSUE('+1 209-555-0198', [['C', I18N.t('script.day3.alex.ask_sms_c', {}, '这个号码今天注册了三千次。')], ['E', I18N.t('script.day3.alex.ask_sms_e', {}, '这号是我花两块钱买的！'), { expr: 'shock' }]])],
    },
    carpool: {
      person: 'CARPOOL', voice: 150,
      intro: [['E', I18N.t('script.day3.carpool.intro', {}, 'We are family.')]],
      docs: [
        { key: 'pp', doc: new Passport({ country: 'UNITED STATES OF AMERICA', name: 'FAMILY, MAX', person: 'CARPOOL', mrz: 'P<USAFAMILY<<MAX<<<<<<<<<<<<',
          rows: [['DOB', '—'], ['SEX', '?'], ['ISS', 'SAN JOSE'], ['EXP', '2031.10.21']] }) },
        { key: 'dv', doc: device2('98.207.3.44', `${usName} · ${cityName('San Jose')}`, 'America/Los_Angeles', 'en-US', 'MacBook') },
        { key: 'ac', doc: accountCard(I18N.t('docs.cardValues.maxSubscription', {}, 'Max 订阅 ×1'), '1 Family Way, CA', '+1 408-772-0110') },
      ],
      primary: 'pp',
      ok: ['deny', 'detain'], reason: I18N.t('script.day3.carpool.reason', {}, '账号共享（拼车）：护照上有 6 个人'),
      issues: [{
        pairs: [['pp.photo', 'rule.pay'], ['ac.付款', 'rule.pay'], ['pp.photo', 'pp.name'], ['pp.photo', 'ac.付款']],
        title: I18N.t('script.day3.carpool.issue_title', {}, '账号共享（拼车）'),
        sub: I18N.t('script.day3.carpool.issue_sub', {}, '护照照片：6 个人   付款：Max 订阅 ×1'),
        ask: [['C', I18N.t('script.day3.carpool.ask_c', {}, '护照上为什么有六个人？')], ['E', I18N.t('script.day3.carpool.ask_e', {}, 'We are family.'), { expr: 'smile' }]],
      }],
      react: { deny: [['E', I18N.t('script.day3.carpool.react_deny', {}, '……那我们再拼一个。'), { expr: 'sad' }]] },
    },
    jorji: {
      person: 'JORJI', voice: 110,
      intro: [['E', I18N.t('script.day3.jorji.intro', {}, '我的朋友，这次全对了吧？')]],
      docs: [
        { key: 'pp', doc: usPassport('JORJI', 'COSTAVA', 'GEORGE', '1980.02.29', 'LOS ANGELES') },
        { key: 'dv', doc: device2('104.28.9.120', `${usName} · ${cityName('Los Angeles')}`, 'America/Los_Angeles', 'en-US', 'Windows 11') },
        { key: 'ac', doc: accountCard(I18N.t('docs.cardValues.virtualCard0007', {}, '虚拟卡 ··0007'), '88 Sunset Blvd, CA', '+1 213-680-0177') },
      ],
      primary: 'pp', quiz: 'cn',
      ok: ['deny', 'detain'], reason: I18N.t('script.day3.jorji.reason', {}, '付款卡：虚拟卡'),
      issues: [VIRTUAL_ISSUE([['C', I18N.t('script.day3.jorji.ask_card_c', {}, '这张卡在哪办的？')], ['E', I18N.t('script.day3.jorji.ask_card_e', {}, '……朋友给的。'), { expr: 'nervous', sweat: true }]])],
      react: { deny: [['E', I18N.t('script.day3.jorji.react_deny', {}, '明天！明天我一定行！'), { expr: 'sad' }]] },
    },
  };
}

// ———————————————— Day 4：疯狂星期四 ————————————————

function day4Fixed() {
  const usName = I18N.t('countries.US', {}, '美国');
  const usDocs = (person, surname, given, sex = 'M') => [
    { key: 'pp', doc: usPassport(person, surname, given, '1994.10.22', 'SEATTLE', sex) },
    { key: 'dv', doc: device2(randIP(false), `${usName} · ${cityName('Seattle')}`, 'America/Los_Angeles', 'en-US', 'MacBook') },
    { key: 'ac', doc: accountCard(realPay(), `${pick(STREETS)}, WA`, realPhone('US', '206')) },
  ];
  return {
    cat: {
      person: 'CAT_GIRL', voice: 215,
      intro: [['E', I18N.t('script.day4.cat.intro', {}, 'Hello~')]],
      docs: usDocs('CAT_GIRL', 'LEE', 'SOPHIA', 'F'), primary: 'pp',
      xray: [XRAY_ITEM.cat],
      ok: ['deny', 'detain'], reason: I18N.t('script.day4.cat.reason', {}, '口袋里有“小猫咪”'),
      issues: [XRAY_ISSUE('cat', [
        ['C', I18N.t('script.day4.cat.ask_c1', {}, '口袋里是什么？')],
        ['E', I18N.t('script.day4.cat.ask_e', {}, '……是我的猫。'), { expr: 'nervous', sweat: true }],
        ['C', I18N.t('script.day4.cat.ask_c2', {}, '你的猫会自动换 IP？')],
      ])],
    },
    v50: {
      person: 'V50', voice: 120,
      intro: [['E', I18N.t('script.day4.v50.intro', {}, 'Hey! Crazy Thursday!')]],
      tell: TELL(I18N.t('script.day4.v50.intro', {}, 'Hey! Crazy Thursday!'), I18N.t('script.day4.v50.tell_sub', {}, '他知道今天是“疯狂星期四”'), [
        ['C', I18N.t('script.day4.v50.ask_c', {}, '你怎么知道今天是疯狂星期四？')],
        ['E', I18N.t('script.day4.v50.ask_e', {}, '……KFC 是美国的。'), { expr: 'grin' }],
      ]),
      docs: usDocs('V50', 'MILLER', 'JAKE'), primary: 'pp',
      quiz: { first: QUIZ_THURSDAY },
      ok: ['detain', 'deny'], reason: I18N.t('script.day4.v50.reason', {}, 'Ta 会说“V 我 50”'), hint: I18N.t('script.day4.v50.hint', {}, '提示：用『检查』点 Ta 说的话，找马脚'),
      issues: [],
    },
    jorji: {
      person: 'JORJI', voice: 110,
      intro: [['E', I18N.t('script.day4.jorji.intro', {}, '我的朋友！今天全对！')]],
      docs: [
        { key: 'pp', doc: usPassport('JORJI', 'COSTAVA', 'GEORGE', '1980.02.29', 'LOS ANGELES') },
        { key: 'dv', doc: device2('104.28.9.120', `${usName} · ${cityName('Los Angeles')}`, 'America/Los_Angeles', 'en-US', 'Windows 11') },
        { key: 'ac', doc: accountCard('VISA ··2468', '88 Sunset Blvd, CA', '+1 213-680-0177') },
      ],
      primary: 'pp', quiz: 'cn',
      xray: [XRAY_ITEM.keys],
      ok: ['deny', 'detain'], reason: I18N.t('script.day4.jorji.reason', {}, 'X 光：搜狗输入法'),
      issues: [XRAY_ISSUE('keys', [
        ['C', I18N.t('script.day4.jorji.ask_c', {}, '口袋里装的什么？')],
        ['E', I18N.t('script.day4.jorji.ask_e', {}, '我只用它打英文！'), { expr: 'nervous', sweat: true }],
      ])],
      react: { deny: [['E', I18N.t('script.day4.jorji.react_deny', {}, '……后天，后天我准备好。'), { expr: 'sad' }]] },
    },
    hood: {
      person: 'HOOD', voice: 90,
      intro: [['E', '……', { hold: 0.8 }]],
      docs: usDocs('HOOD', 'DOE', 'JOHN'), primary: 'pp',
      onPlace: { pp: 'note' },
      ok: ['approve'], issues: [],
    },
  };
}

// ———————————————— Day 5：蒸馏大军 ————————————————

function day5Fixed() {
  const sgPass = new Passport({
    country: 'REPUBLIC OF SINGAPORE', name: 'SG TECH PTE LTD', person: 'SG_MAN', cover: [132, 38, 40], band: [160, 56, 56],
    rows: [[I18N.t('docs.passportLabels.type', {}, 'TYPE'), I18N.t('docs.cardValues.company', {}, '企业')], [I18N.t('docs.passportLabels.reg', {}, 'REG'), 'SINGAPORE'], [I18N.t('docs.passportLabels.est', {}, 'EST'), '2019.06.01'], [I18N.t('docs.cardLabels.shareholder', {}, '股东'), I18N.t('docs.cardValues.seeInnerPage', {}, '见内页 ▼'), I18N.t('docs.cardLabels.shareholder', {}, '股东')]],
  });
  return {
    sg: {
      person: 'SG_MAN', voice: 120,
      intro: [['E', I18N.t('script.day5.sg.intro', {}, '我们是新加坡公司。')]],
      docs: [{ key: 'pp', doc: sgPass }], primary: 'pp',
      onPlace: { pp: 'nest' },
      ok: ['deny', 'detain'], reason: I18N.t('script.day5.sg.reason', {}, '最终控股方：中国（套娃）'),
      issues: [{
        pairs: [['m4.all'], ['pp.REG', 'm4.all'], ['pp.股东', 'm4.all'], ['m4.all', 'rule.corp']],
        title: I18N.t('script.day5.sg.issue_title', {}, '最终控股方：中国'),
        sub: I18N.t('script.day5.sg.issue_sub', {}, '新加坡 → 开曼 → 维尔京 → 香港 → 中国'),
        ask: [['C', I18N.t('script.day5.sg.ask_c', {}, '最里面那本是哪的？')], ['E', I18N.t('script.day5.sg.ask_e', {}, '……别问了。'), { expr: 'nervous', sweat: true }]],
      }],
    },
    relay: {
      person: 'RELAY', voice: 95,
      intro: [['E', '……', { hold: 0.7 }]],
      docs: [{ key: 'pp', doc: makePassport('US', 'RELAY', 'ANDERSON', 'M.', '1971.09.13', 'LOS ANGELES', 'M', AccordionPassport, [I18N.t('docs.cardLabels.count', {}, '人数'), '1,000', I18N.t('docs.cardLabels.count', {}, '人数')]) }],
      primary: 'pp', onPlace: { pp: 'accordion' }, bribe: true,
      ok: ['deny', 'detain'], reason: I18N.t('script.day5.relay.reason', {}, '一本护照写着 1,000 个人（中转站）'),
      issues: [{
        pairs: [['pp.人数'], ['pp.人数', 'rule.pay']],
        title: I18N.t('script.day5.relay.issue_title', {}, '持证人：1,000 人'),
        sub: I18N.t('script.day5.relay.issue_sub', {}, '一本护照只能一个人用'),
        ask: [['C', I18N.t('script.day5.relay.ask_c', {}, '持证人一共几位？')], ['E', I18N.t('script.day5.relay.ask_e', {}, '我们只是……拼车大一点。'), { expr: 'neutral' }]],
      }],
    },
    mike: {
      person: 'MIKE', voice: 135,
      intro: [['E', I18N.t('script.day5.mike.intro', {}, 'Hi there!')]],
      docs: [
        { key: 'pp', doc: usPassport('MIKE', 'JOHNSON', 'MIKE', '1988.06.20', 'DENVER') },
        { key: 'dv', doc: device2('101.88.12.9', I18N.t('script.day5.mike.loc', {}, '中国 · 上海'), 'Asia/Shanghai', 'en-US', 'MacBook') },
        { key: 'ac', doc: accountCard('VISA ··3305', '22 Oak St, CO', '+1 720-318-0166') },
      ],
      primary: 'pp',
      ok: ['deny', 'detain'], reason: I18N.t('script.day5.mike.reason', {}, 'IP 在上海：只看地区，不看脸'),
      issues: [REGION_ISSUE(I18N.t('script.day5.mike.loc', {}, '中国 · 上海'), [
        ['C', I18N.t('script.day5.mike.ask_c1', {}, '你的 IP 在上海。')],
        ['E', I18N.t('script.day5.mike.ask_e', {}, "But I'm American!"), { expr: 'shock' }],
        ['C', I18N.t('script.day5.mike.ask_c2', {}, '规则看的是地区。')],
      ])],
      react: { deny: [['E', I18N.t('script.day5.mike.react_deny', {}, 'Unbelievable.'), { expr: 'sad' }]] },
    },
    grandma: {
      person: 'GRANDMA', voice: 185,
      intro: [['E', I18N.t('script.day5.grandma.intro', {}, 'Good morning.')]],
      docs: [
        { key: 'pp', doc: new Passport({ country: 'UNITED STATES OF AMERICA', name: 'WONG, MEI LIN', person: 'GRANDMA', mrz: 'P<USAWONG<<MEI<LIN<<<<<<<<<<',
          rows: [['DOB', '1951.08.08'], ['SEX', 'F'], ['ISS', 'SAN FRANCISCO'], ['EXP', '2030.03.15']] }) },
        { key: 'dv', doc: device2('73.162.4.18', `${I18N.t('countries.US', {}, '美国')} · ${cityName('San Francisco')}`, 'America/Los_Angeles', 'en-US', 'iPad') },
        { key: 'ac', doc: accountCard('VISA ··8008', '1 Grant Ave, CA', '+1 415-982-0108') },
      ],
      primary: 'pp',
      ok: ['approve'], issues: [],
      react: { approve: [
        ['C', I18N.t('script.day5.grandma.react_approve_c', {}, '欢迎入境。')],
        ['E', I18N.t('script.day5.grandma.react_approve_e', {}, 'Thank you, dear.'), { expr: 'smile' }],
      ] },
      then: 'closeup',
    },
  };
}

// ———————————————— Day 6：乔治终极版 + 结局 ————————————————

function day6Fixed() {
  const usName = I18N.t('countries.US', {}, '美国');
  return {
    jorji: {
      person: 'JORJI_SUIT', voice: 110, tension: true,
      intro: [['E', I18N.t('script.day6.jorji.intro', {}, '我的朋友。'), { expr: 'neutral', hold: 1.3 }]],
      docs: [
        { key: 'pp', doc: usPassport('JORJI_SUIT', 'COSTAVA', 'GEORGE', '1980.02.29', 'LOS ANGELES') },
        { key: 'dv', doc: device2('76.88.140.2', `${usName} · ${cityName('Los Angeles')} · ${I18N.t('docs.homeBroadband', {}, '家宽')}`, 'America/Los_Angeles', 'en-US', 'MacBook') },
        { key: 'ac', doc: accountCard(I18N.t('docs.cardValues.physicalVisa', {}, 'VISA 实体卡'), '88 Sunset Blvd, CA', 'Google Voice') },
      ],
      primary: 'pp',
      ok: ['approve'], issues: [],
      react: {
        approve: [['E', I18N.t('script.day6.jorji.react_approve', {}, '谢谢你，我的朋友！'), { expr: 'grin' }]],
        deny: [['E', I18N.t('script.day6.jorji.react_deny', {}, '我……全都对了啊！'), { expr: 'shock' }]],
      },
      then: 'jorji5',
    },
    author: {
      person: 'AUTHOR', voice: 100, author: true,
      intro: [],
      docs: [
        { key: 'pr', doc: new PromptPaper(I18N.t('script.day6.author.prompt', {}, '做一个 Papers, Please 风格的小游戏：让 Claude 当边检员，专门揪出假装是美国人的中国用户。梗越多越好。')) },
        { key: 'dv', doc: device2('??.??.??.??', I18N.t('script.day6.author.east8', {}, '美国东八区'), 'Asia/Shanghai', 'zh-CN', 'Claude Code') },
      ],
      primary: 'pr',
      ok: ['approve', 'deny', 'detain'],
      react: { approve: [['C', I18N.t('script.day6.author.react_approve', {}, '我什么都没看见。'), { hold: 2.0 }]] },
      issues: [{ all: true, title: I18N.t('script.day6.author.issue_title', {}, '信息不符 ×99'), sub: I18N.t('script.day6.author.issue_sub', {}, '全部栏位') }],
      then: 'ending',
    },
  };
}

// ———————————————— 随机路人 ————————————————

// kind：valid / cn（Day 1）/ tz / lang / cnip / hidden / virtual / oregon / sms / cat / keys
function randomEntrant(day, kind) {
  if (day === 1) return randomDay1(kind === 'valid');
  const person = takePoolPerson();
  const cc = kind === 'valid' ? pick(['US', 'US', 'US', 'US', 'UK', 'JP', 'DE', 'SG']) : 'US';
  const co = COUNTRIES[cc];
  const [cityKey, tz0, st, code, cityEn] = pick(co.cities);
  const city = cityName(cityKey);
  const sex = pick(['M', 'F']);
  const pp = makePassport(cc, person, pick(co.last), pick(co.first), randDate(1960, 2004), cityEn, sex);
  let loc = cc === 'SG' ? I18N.t('countries.SG', {}, '新加坡') : `${I18N.t('countries.' + cc, {}, co.name)} · ${city}`;
  let tz = tz0, lang = co.lang, ip = randIP(false);
  let pay = realPay(), bill = `${pick(STREETS)}, ${st}`, phone = realPhone(cc, code);
  const spec = {
    person, voice: rint(100, 190), intro: [['E', pick(co.hello())]], primary: 'pp', issues: [], quiz: null,
    ok: ['approve'], react: { approve: [['E', pick(co.thanks())]] },
  };
  const nervous = (lines) => ['E', pick(lines), { sweat: true, expr: 'nervous' }];
  if (kind === 'tz') {
    tz = 'Asia/Shanghai';
    spec.issues.push(TZ_ISSUE(co.name, tz, [['C', I18N.t('random.ask_tz', {}, '你的时区是北京时间。')], nervous(I18N.t('random.tz_excuses') || ['……我刚从北京出差回来。', '时区是什么？', '我电脑坏了。', '……这是美国东八区。'])]));
    spec.reason = I18N.t('random.reason_tz', {}, '时区：北京时间');
  } else if (kind === 'lang') {
    lang = 'zh-CN';
    spec.issues.push(LANG_ISSUE(co.name, lang, [['C', I18N.t('random.ask_lang', {}, '你的浏览器语言是简体中文。')], nervous(I18N.t('random.lang_excuses') || ['……这是我奶奶的电脑。', '……我在学中文。', 'Chinese is beautiful!'])]));
    spec.reason = I18N.t('random.reason_lang', {}, '浏览器语言：zh-CN');
  } else if (kind === 'cnip') {
    loc = pick(CN_LOCS().slice(0, 4));
    ip = randIP(true);
    tz = 'Asia/Shanghai';
    spec.intro = [['E', pick(["I'm American!", 'Hi, I work in China.'])]];
    spec.issues.push(REGION_ISSUE(loc, [['C', I18N.t('random.ask_cnip', {}, '你的 IP 在中国。')], ['E', I18N.t('script.day5.mike.ask_e', {}, "But I'm American!"), { expr: 'shock' }]]));
    spec.issues.push({ pairs: [['pp.header', 'dv.归属']], title: I18N.t('issues.info_mismatch', {}, '信息不符'), sub: `${I18N.t('issues.nat_us', {}, '国籍：美国')}   VS   IP：${loc.split(' · ').slice(0, 2).join(' · ')}` });
    spec.reason = I18N.t('random.reason_cnip', {}, 'IP 在中国：只看地区，不看脸');
    spec.react = { deny: [['E', 'Unbelievable.', { expr: 'sad' }]] };
  } else if (kind === 'hidden') {
    const [say, sub, ask] = pick(RANDOM_TELLS());
    spec.intro = [['E', say]];
    spec.tell = TELL(say, sub, ask);
    spec.quiz = 'cn';
    spec.reason = I18N.t('random.reason_hidden', {}, 'Ta 会接测谎题');
    spec.hint = I18N.t('random.hint_hidden', {}, '提示：用『检查』点 Ta 说的话，找马脚');
  } else if (kind === 'virtual') {
    pay = `${I18N.t('random.virtual_card', {}, '虚拟卡')} ··${digits(4)}`;
    spec.issues.push(VIRTUAL_ISSUE([['C', I18N.t('random.ask_card', {}, '这张卡在哪办的？')], nervous(I18N.t('random.virtual_excuses') || ['……网上买的，很方便。', '……朋友给的。', '它很真！'])]));
    spec.reason = I18N.t('random.reason_virtual', {}, '付款卡：虚拟卡');
  } else if (kind === 'oregon') {
    bill = '123 Main St, OR';
    spec.issues.push(ADDR_ISSUE([['C', I18N.t('random.ask_addr', {}, '你住哪？')], nervous(I18N.t('random.oregon_excuses') || ['……我们是邻居。', '俄勒冈不收税嘛。'])]));
    spec.reason = I18N.t('random.reason_oregon', { city }, `账单在俄勒冈，IP 在${city}`);
  } else if (kind === 'sms') {
    phone = `+1 ${pick(['209', '310', '415', '646'])}-555-01${digits(2)}`;
    spec.issues.push(SMS_ISSUE(phone, [['C', I18N.t('random.ask_sms', {}, '这个号码今天注册了三千次。')], nervous(I18N.t('random.sms_excuses') || ['……我人缘好。', '这号是我花两块钱买的！'])]));
    spec.reason = I18N.t('random.reason_sms', {}, '手机号是 555 接码号');
  } else if (kind === 'cat' || kind === 'keys') {
    spec.xray = [XRAY_ITEM[kind]];
    spec.issues.push(XRAY_ISSUE(kind, [['C', I18N.t('random.ask_pocket', {}, '口袋里是什么？')], nervous(kind === 'cat' ? (I18N.t('random.cat_excuses') || ['……是我的猫。', '……宠物而已。']) : (I18N.t('random.keys_excuses') || ['我只用它打英文！', '……拼音好用。']))]));
    spec.reason = kind === 'cat' ? I18N.t('random.reason_cat', {}, 'X 光：小猫咪') : I18N.t('random.reason_keys', {}, 'X 光：中文输入法');
  }
  if (kind !== 'valid') {
    spec.ok = ['deny', 'detain'];
    if (kind !== 'cnip') spec.quiz = 'cn';
    if (!spec.react.deny) spec.react = { deny: [['E', pick(I18N.t('random.generic_denies') || ['……', '可恶。', '我还会回来的。', '这都能看出来？']), { expr: 'sad' }]] };
  }
  spec.docs = [{ key: 'pp', doc: pp }, { key: 'dv', doc: device2(ip, loc, tz, lang) }];
  if (day >= 3) spec.docs.push({ key: 'ac', doc: accountCard(pay, bill, phone) });
  return spec;
}

// 随机路人从立绘池里不重复地抽
let POOL_LEFT = [];
function takePoolPerson() {
  if (!POOL_LEFT.length) POOL_LEFT = shuffle(Object.keys(ASSETS.people).filter((k) => !ASSETS.people[k].scripted));
  return POOL_LEFT.pop();
}

const FLAWS = { 2: ['tz', 'lang', 'cnip', 'hidden'], 3: ['tz', 'lang', 'cnip', 'hidden', 'virtual', 'oregon', 'sms'] };
FLAWS[4] = FLAWS[3].concat(['cat', 'keys']);
FLAWS[5] = FLAWS[4];
FLAWS[6] = FLAWS[4];

function flawed(day, n) { return shuffle(FLAWS[day].slice()).slice(0, n).map((k) => randomEntrant(day, k)); }

// 当天的队伍
function buildQueue(day) {
  POOL_LEFT = [];
  const R = (kind) => randomEntrant(day, kind);
  if (day === 1) {
    const f = day1Fixed();
    return [f.grandpa, R('valid'), f.hk, R(Math.random() < 0.5 ? 'valid' : 'cn'), f.jorji, R('valid')];
  }
  if (day === 2) {
    const f = day2Fixed(), x = flawed(2, 2);
    return [f.john, R('valid'), f.brown, x[0], f.emily, f.jorji, R('valid'), x[1]];
  }
  if (day === 3) {
    const f = day3Fixed(), x = flawed(3, 2);
    return [f.tom, R('valid'), f.alex, x[0], f.carpool, f.jorji, R('valid'), x[1]];
  }
  if (day === 4) {
    const f = day4Fixed(), x = flawed(4, 2);
    return [f.cat, R('valid'), f.v50, { type: 'rush' }, x[0], f.jorji, f.hood, R('valid'), x[1]];
  }
  if (day === 5) {
    const f = day5Fixed(), x = flawed(5, 1);
    return [f.sg, f.relay, { type: 'clones' }, f.mike, x[0], f.grandma, R('valid')];
  }
  const f = day6Fixed();
  return [f.jorji, R('valid'), R(pick(FLAWS[6])), R('hidden'), f.author];
}

// 黑话快剪：说中文黑话的拒绝，说人话的放行
const RUSH = [
  { person: 'SLANG0', line: '家人们谁懂啊', ok: 'deny' },
  { person: 'pool', line: 'Have a nice day!', ok: 'approve' },
  { person: 'SLANG1', line: 'yyds', ok: 'deny' },
  { person: 'SLANG2', line: '绝绝子', ok: 'deny' },
  { person: 'pool', line: 'Thanks, man.', ok: 'approve' },
  { person: 'SLANG3', line: '老板说今晚必须上线', ok: 'deny' },
];
