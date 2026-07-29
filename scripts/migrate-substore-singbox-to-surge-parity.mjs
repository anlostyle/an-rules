#!/usr/bin/env node

import fs from "node:fs";

const input = fs.readFileSync(0, "utf8");
const store = JSON.parse(input);
const file = store.files?.find((item) => item.name === "singbox");
if (!file) throw new Error('Sub-Store file "singbox" not found');

const config = JSON.parse(file.content);
const rawBase =
  "https://raw.githubusercontent.com/anlostyle/an-rules/main/singbox/surge";
const metaBase =
  "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing";

const landingGroups = [
  "🇭🇰 WTT",
  "🇭🇰 HK iCable",
  "🇭🇰 HGC",
  "🇭🇰 DMIT|Mini-T1",
  "🇭🇰 Fxtransit|Std-T1",
  "🇭🇰 Bage-HKS&B",
  "🇭🇰 Bage-HKS&C",
  "🇭🇰 RFC|Jinx-T1",
  "🇲🇴 CTM-SS2022",
  "🇯🇵 Fxtransit-T1",
  "🇯🇵 Dmit-T1",
  "🇯🇵 BageVM-JP",
  "🇯🇵 BageVM-JPS",
  "🇸🇬 100TB-T1",
  "🇸🇬 BageVM-SGS",
  "🇸🇬 LegendVPS-SG",
  "🇸🇬 RFC-T1",
  "🇰🇷 ISIF-KR",
  "🇺🇸 ATT TX",
  "🇺🇸 BageVM-La2",
  "🇺🇸 BageVM-SLC",
  "🇬🇧 BageVM-UK",
  "🇩🇪 BageVM-De&A",
  "🇩🇪 BageVM-De&B",
  "🇳🇱 QDE-NL",
];

const countryGroups = [
  "🇭🇰 香港",
  "🇲🇴 澳门",
  "🇯🇵 日本",
  "🇸🇬 新加坡",
  "🇰🇷 韩国",
  "🇨🇳 台湾",
  "🇺🇸 美国",
  "🇬🇧 英国",
  "🇩🇪 德国",
  "🇳🇱 荷兰",
  "🇹🇷 土耳其",
];

const commonChoices = [
  "节点选择",
  "自动选择",
  ...countryGroups,
  ...landingGroups,
];

const directLastChoices = [...commonChoices, "全球直连"];
const directFirstChoices = ["全球直连", ...commonChoices];
const proxyOnlyChoices = [...commonChoices];

function selector(tag, outbounds) {
  return { tag, type: "selector", outbounds };
}

function urltest(tag) {
  return {
    tag,
    type: "urltest",
    outbounds: [],
    interval: "10m",
    tolerance: 100,
  };
}

const countryLandingMap = new Map([
  [
    "🇭🇰 香港",
    [
      "🇭🇰 WTT",
      "🇭🇰 HK iCable",
      "🇭🇰 HGC",
      "🇭🇰 DMIT|Mini-T1",
      "🇭🇰 Fxtransit|Std-T1",
      "🇭🇰 Bage-HKS&B",
      "🇭🇰 Bage-HKS&C",
      "🇭🇰 RFC|Jinx-T1",
    ],
  ],
  ["🇲🇴 澳门", ["🇲🇴 CTM-SS2022"]],
  [
    "🇯🇵 日本",
    ["🇯🇵 Fxtransit-T1", "🇯🇵 Dmit-T1", "🇯🇵 BageVM-JP", "🇯🇵 BageVM-JPS"],
  ],
  [
    "🇸🇬 新加坡",
    ["🇸🇬 100TB-T1", "🇸🇬 BageVM-SGS", "🇸🇬 LegendVPS-SG", "🇸🇬 RFC-T1"],
  ],
  ["🇰🇷 韩国", ["🇰🇷 ISIF-KR"]],
  ["🇨🇳 台湾", []],
  ["🇺🇸 美国", ["🇺🇸 ATT TX", "🇺🇸 BageVM-La2", "🇺🇸 BageVM-SLC"]],
  ["🇬🇧 英国", ["🇬🇧 BageVM-UK"]],
  ["🇩🇪 德国", ["🇩🇪 BageVM-De&A", "🇩🇪 BageVM-De&B"]],
  ["🇳🇱 荷兰", ["🇳🇱 QDE-NL"]],
  ["🇹🇷 土耳其", []],
]);

const serviceGroups = [
  selector("国外媒体", directLastChoices),
  selector("Telegram", proxyOnlyChoices),
  selector("Twitter", proxyOnlyChoices),
  selector("Netflix", directLastChoices),
  selector("Disney+", directLastChoices),
  selector("HBO", directLastChoices),
  selector("Spotify", directLastChoices),
  selector("TikTok", directLastChoices),
  selector("AI", directLastChoices),
  selector("Emby", directLastChoices),
  selector("Google", directLastChoices),
  selector("微软服务", directFirstChoices),
  selector("苹果服务", directFirstChoices),
  selector("Speedtest", directFirstChoices),
  selector("OneDrive", directFirstChoices),
  selector("Bilibili", directFirstChoices),
  selector("WeChat", directFirstChoices),
  selector("金融服务", directFirstChoices),
  selector("E-Hentai", directLastChoices),
  selector("PT站点", directFirstChoices),
];

const infrastructureOutbounds = [
  selector("节点选择", ["自动选择", ...countryGroups, ...landingGroups, "全球直连"]),
  urltest("自动选择"),
  ...countryGroups.map((tag) => selector(tag, countryLandingMap.get(tag) ?? [])),
  ...landingGroups.map((tag) => urltest(tag)),
  selector("全球直连", ["🎯 全球直连"]),
  { tag: "🎯 全球直连", type: "direct" },
];

const globalChoices = [
  ...serviceGroups.map((group) => group.tag),
  "节点选择",
  "自动选择",
  ...countryGroups,
  ...landingGroups,
  "全球直连",
];

config.outbounds = [
  ...serviceGroups,
  ...infrastructureOutbounds,
  selector("GLOBAL", globalChoices),
];

function sourceRuleSet(tag, slug) {
  return {
    tag,
    type: "remote",
    format: "source",
    url: `${rawBase}/${slug}.json`,
    download_detour: "全球直连",
  };
}

function binaryRuleSet(tag, url) {
  return {
    tag,
    type: "remote",
    format: "binary",
    url,
    download_detour: "全球直连",
  };
}

const policySlugs = new Map([
  ["AI", "ai"],
  ["Telegram", "telegram"],
  ["Twitter", "twitter"],
  ["Netflix", "netflix"],
  ["Disney+", "disney"],
  ["HBO", "hbo"],
  ["Spotify", "spotify"],
  ["TikTok", "tiktok"],
  ["国外媒体", "global-media"],
  ["Emby", "emby"],
  ["OneDrive", "onedrive"],
  ["Google", "google"],
  ["苹果服务", "apple"],
  ["微软服务", "microsoft"],
  ["Speedtest", "speedtest"],
  ["Bilibili", "bilibili"],
  ["WeChat", "wechat"],
  ["金融服务", "finance"],
  ["E-Hentai", "ehentai"],
  ["PT站点", "private-tracker"],
]);

const asnPolicies = new Map([
  ["Telegram", ["211157", "44907", "59930", "62014", "62041"]],
  ["Twitter", ["32934"]],
  ["WeChat", ["132203"]],
]);

const serviceRuleSets = [...policySlugs.entries()].map(([policy, slug]) =>
  sourceRuleSet(`surge-${slug}`, slug),
);
const asnRuleSets = [...asnPolicies.values()]
  .flat()
  .map((asn) =>
    binaryRuleSet(
      `asn-${asn}`,
      `${metaBase}/asn/AS${asn}.srs`,
    ),
  );

const personalRuleSets = ["hk", "sg", "us", "jp", "direct"].map((name) => ({
  tag: `user-${name}`,
  type: "remote",
  format: "source",
  url: `https://raw.githubusercontent.com/anlostyle/an-rules/main/singbox/user-${name}.json`,
  download_detour: "全球直连",
}));

config.route.rule_set = [
  binaryRuleSet(
    "geosite-ads-all",
    `${metaBase}/geo/geosite/category-ads-all.srs`,
  ),
  ...serviceRuleSets,
  ...asnRuleSets,
  ...personalRuleSets,
  binaryRuleSet("geosite-cn", `${metaBase}/geo/geosite/cn.srs`),
  binaryRuleSet("geoip-cn", `${metaBase}/geo/geoip/cn.srs`),
];

const routeRules = [
  { action: "sniff", sniffer: ["http", "tls", "quic", "dns"] },
  { inbound: "dns-in", action: "hijack-dns" },
  { ip_is_private: true, action: "route", outbound: "全球直连" },
  { clash_mode: "direct", action: "route", outbound: "全球直连" },
  { clash_mode: "global", action: "route", outbound: "GLOBAL" },
  { rule_set: "geosite-ads-all", action: "reject" },
];

for (const [policy, slug] of policySlugs) {
  routeRules.push({
    rule_set: `surge-${slug}`,
    action: "route",
    outbound: policy,
  });
  for (const asn of asnPolicies.get(policy) ?? []) {
    routeRules.push({
      rule_set: `asn-${asn}`,
      action: "route",
      outbound: policy,
    });
  }
}

routeRules.push(
  { rule_set: "user-hk", action: "route", outbound: "🇭🇰 香港" },
  { rule_set: "user-sg", action: "route", outbound: "🇸🇬 新加坡" },
  { rule_set: "user-us", action: "route", outbound: "🇺🇸 美国" },
  { rule_set: "user-jp", action: "route", outbound: "🇯🇵 日本" },
  { rule_set: "user-direct", action: "route", outbound: "全球直连" },
  { rule_set: "geosite-cn", action: "route", outbound: "全球直连" },
  { rule_set: "geoip-cn", action: "route", outbound: "全球直连" },
);

config.route.rules = routeRules;
config.route.final = "节点选择";

for (const server of config.dns?.servers ?? []) {
  if (server.detour) server.detour = "节点选择";
}
for (const rule of config.dns?.rules ?? []) {
  if (rule.rule_set) rule.rule_set = ["geosite-cn", "surge-apple"];
}
if (config.experimental?.clash_api?.external_ui_download_detour) {
  config.experimental.clash_api.external_ui_download_detour = "全球直连";
}

const injectionRules = [
  ["^(?:节点选择|自动选择)$", undefined],
  ["^🇭🇰 香港$", "(?:^🇭🇰|香港|(?:^|[-_/|\\s])HK(?:[-_/|\\s]|$))"],
  ["^🇲🇴 澳门$", "(?:^🇲🇴|澳门|澳門|(?:^|[-_/|\\s])MO(?:[-_/|\\s]|$))"],
  ["^🇯🇵 日本$", "(?:^🇯🇵|日本|(?:^|[-_/|\\s])JP(?:[-_/|\\s]|$))"],
  ["^🇸🇬 新加坡$", "(?:^🇸🇬|新加坡|狮城|(?:^|[-_/|\\s])SG(?:[-_/|\\s]|$))"],
  ["^🇰🇷 韩国$", "(?:^🇰🇷|韩国|韓國|(?:^|[-_/|\\s])KR(?:[-_/|\\s]|$))"],
  ["^🇨🇳 台湾$", "(?:^🇹🇼|台湾|台灣|(?:^|[-_/|\\s])TW(?:[-_/|\\s]|$))"],
  ["^🇺🇸 美国$", "(?:^🇺🇸|美国|美國|(?:^|[-_/|\\s])US(?:[-_/|\\s]|$))"],
  ["^🇬🇧 英国$", "(?:^🇬🇧|英国|英國|(?:^|[-_/|\\s])(?:UK|GB)(?:[-_/|\\s]|$))"],
  ["^🇩🇪 德国$", "(?:^🇩🇪|德国|德國|(?:^|[-_/|\\s])DE(?:[-_/|\\s]|$))"],
  ["^🇳🇱 荷兰$", "(?:^🇳🇱|荷兰|荷蘭|(?:^|[-_/|\\s])NL(?:[-_/|\\s]|$))"],
  ["^🇹🇷 土耳其$", "(?:^🇹🇷|土耳其|(?:^|[-_/|\\s])TR(?:[-_/|\\s]|$))"],
  ["^🇭🇰 WTT$", "^🇭🇰\\s+.+\\s*>>\\s*WTT-HK$"],
  ["^🇭🇰 HK iCable$", "^🇭🇰\\s+.+\\s*>>\\s*(?:iCable-HK|HK-iCable)$"],
  ["^🇭🇰 HGC$", "^🇭🇰\\s+.+\\s*>>\\s*HGC-HK$"],
  ["^🇭🇰 DMIT\\|Mini-T1$", "^🇭🇰\\s+.+\\s*>>\\s*(?:DMIT-HK|DMIT\\|HKG\\.T1\\.Mini)$"],
  ["^🇭🇰 Fxtransit\\|Std-T1$", "^🇭🇰\\s+.+\\s*>>\\s*(?:Fxtransit-HK|Fxtransit\\|HKG\\.T1\\.Std)$"],
  ["^🇭🇰 Bage-HKS&B$", "^🇭🇰\\s+.+\\s*>>\\s*(?:Bage-HKS|BageVM-HKS&B)$"],
  ["^🇭🇰 Bage-HKS&C$", "^🇭🇰\\s+.+\\s*>>\\s*(?:Bage-HKS|BageVM-HKS&C)$"],
  ["^🇭🇰 RFC\\|Jinx-T1$", "^🇭🇰\\s+.+\\s*>>\\s*(?:RFC-Jinx|RFC\\|HKG\\.T1\\.Jinx)$"],
  ["^🇲🇴 CTM-SS2022$", "^🇲🇴\\s+.+\\s*>>\\s*(?:CTM|CTM-SS2022)$"],
  ["^🇯🇵 Fxtransit-T1$", "^🇯🇵\\s+.+\\s*>>\\s*(?:FX-JP|Fxtransit\\|JP\\.T1\\.Std)$"],
  ["^🇯🇵 Dmit-T1$", "^🇯🇵\\s+.+\\s*>>\\s*(?:DMIT-JP|DMIT\\|JP\\.T1\\.WEE)$"],
  ["^🇯🇵 BageVM-JP$", "^🇯🇵\\s+.+\\s*>>\\s*(?:Bage-JP|BageVM-JP|JP)$"],
  ["^🇯🇵 BageVM-JPS$", "^🇯🇵\\s+.+\\s*>>\\s*(?:Bage-JPS|BageVM-JPS|JPS)$"],
  ["^🇸🇬 100TB-T1$", "^🇸🇬\\s+.+\\s*>>\\s*100TB-SG$"],
  ["^🇸🇬 BageVM-SGS$", "^🇸🇬\\s+.+\\s*>>\\s*BageVM-SGS$"],
  ["^🇸🇬 LegendVPS-SG$", "^🇸🇬\\s+.+\\s*>>\\s*(?:Legend-SG|LegendVPS-SG)$"],
  ["^🇸🇬 RFC-T1$", "^🇸🇬\\s+.+\\s*>>\\s*(?:RFC-SG|RFC\\|SG\\.T1)$"],
  ["^🇰🇷 ISIF-KR$", "^🇰🇷\\s+.+\\s*>>\\s*ISIF-KR$"],
  ["^🇺🇸 ATT TX$", "^🇺🇸\\s+.+\\s*>>\\s*(?:ATT-TX|ATT TX)$"],
  ["^🇺🇸 BageVM-La2$", "^🇺🇸\\s+.+\\s*>>\\s*BageVM-La2$"],
  ["^🇺🇸 BageVM-SLC$", "^🇺🇸\\s+.+\\s*>>\\s*BageVM-SLC$"],
  ["^🇬🇧 BageVM-UK$", "^🇬🇧\\s+.+\\s*>>\\s*BageVM-UK$"],
  ["^🇩🇪 BageVM-De&A$", "^🇩🇪\\s+.+\\s*>>\\s*(?:BageVM-De|BageVM-De&A)$"],
  ["^🇩🇪 BageVM-De&B$", "^🇩🇪\\s+.+\\s*>>\\s*(?:BageVM-De|BageVM-De&B)$"],
  ["^🇳🇱 QDE-NL$", "^🇳🇱\\s+.+\\s*>>\\s*QDE-NL$"],
];

const outboundArgument = injectionRules
  .map(([outboundPattern, tagPattern]) =>
    `🕳ℹ️${outboundPattern}${tagPattern ? `🏷ℹ️${tagPattern}` : ""}`,
  )
  .join("");

const operator = file.process?.find((item) => item.type === "Script Operator");
if (!operator) throw new Error("Sub-Store sing-box template Script Operator not found");
operator.args.arguments.outbound = outboundArgument;
operator.args.arguments.name = "自建组合";
operator.args.arguments.type = "组合订阅";

const scriptBase = operator.args.content.split("#", 1)[0];
const parameters = [
  ["name", "自建组合"],
  ["outbound", outboundArgument],
  ["type", "组合订阅"],
]
  .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  .join("&");
operator.args.content = `${scriptBase}#${parameters}`;

const outboundTags = new Set(config.outbounds.map((outbound) => outbound.tag));
if (outboundTags.size !== config.outbounds.length) {
  throw new Error("Duplicate outbound tag generated");
}
for (const rule of config.route.rules) {
  if (rule.outbound && !outboundTags.has(rule.outbound)) {
    throw new Error(`Route references missing outbound: ${rule.outbound}`);
  }
}
const ruleSetTags = new Set(config.route.rule_set.map((ruleSet) => ruleSet.tag));
for (const rule of config.route.rules) {
  for (const tag of [rule.rule_set].flat().filter(Boolean)) {
    if (!ruleSetTags.has(tag)) {
      throw new Error(`Route references missing rule-set: ${tag}`);
    }
  }
}

file.content = JSON.stringify(config, null, 2);
process.stderr.write(
  `Migrated singbox: ${serviceGroups.length} service groups, ${config.outbounds.length} base outbounds, ${config.route.rule_set.length} rule sets, ${config.route.rules.length} route rules\n`,
);
process.stdout.write(`${JSON.stringify(store, null, 2)}\n`);
