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
const metadataFilterUrl =
  "https://raw.githubusercontent.com/anlostyle/an-rules/main/substore/filter-singbox-metadata.js";

const countryGroups = [
  "🇭🇰 香港自动",
  "🇯🇵 日本自动",
  "🇸🇬 狮城自动",
  "🇺🇲 美国自动",
];

const orderedInfrastructureChoices = [
  "♻️ 自动选择",
  "🐸 手动选择",
  ...countryGroups,
  "其他地区",
  "🎯 全球直连",
];

const serviceChoices = ["🚀 默认代理", ...orderedInfrastructureChoices];

function selector(tag, outbounds, defaultOutbound) {
  return {
    tag,
    type: "selector",
    outbounds,
    ...(defaultOutbound ? { default: defaultOutbound } : {}),
  };
}

function urltest(tag) {
  return {
    tag,
    type: "urltest",
    outbounds: [],
    interval: "10m",
    tolerance: 100,
    idle_timeout: "30m",
    interrupt_exist_connections: false,
  };
}

const serviceGroups = [
  selector("🚀 默认代理", orderedInfrastructureChoices, "♻️ 自动选择"),
  selector("🧠 AI", serviceChoices, "🇸🇬 狮城自动"),
  selector("🌍 国外媒体", serviceChoices, "🚀 默认代理"),
  selector("📲 社交媒体", serviceChoices, "🇭🇰 香港自动"),
  selector("🎥 流媒体", serviceChoices, "🇭🇰 香港自动"),
  selector("🎵 TikTok", serviceChoices, "🇯🇵 日本自动"),
  selector("🎞 Emby", serviceChoices, "🇭🇰 香港自动"),
  selector("🍀 Google", serviceChoices, "🚀 默认代理"),
  selector("🪟 Microsoft", serviceChoices, "🎯 全球直连"),
  selector("🐬 OneDrive", serviceChoices, "🎯 全球直连"),
  selector("🍏 Apple", serviceChoices, "🎯 全球直连"),
  selector(
    "🐠 漏网之鱼",
    ["🚀 默认代理", "🎯 全球直连"],
    "🚀 默认代理",
  ),
];

const infrastructureOutbounds = [
  urltest("♻️ 自动选择"),
  selector("🐸 手动选择", []),
  ...countryGroups.map((tag) => urltest(tag)),
  selector("其他地区", []),
  { tag: "🎯 全球直连", type: "direct" },
];

const globalChoices = [
  ...serviceGroups.map((group) => group.tag),
  ...orderedInfrastructureChoices,
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
    download_detour: "🎯 全球直连",
  };
}

function binaryRuleSet(tag, url) {
  return {
    tag,
    type: "remote",
    format: "binary",
    url,
    download_detour: "🎯 全球直连",
  };
}

const policySlugs = new Map([
  ["ai", "🧠 AI"],
  ["telegram", "📲 社交媒体"],
  ["twitter", "📲 社交媒体"],
  ["netflix", "🎥 流媒体"],
  ["disney", "🎥 流媒体"],
  ["hbo", "🎥 流媒体"],
  ["spotify", "🎥 流媒体"],
  ["tiktok", "🎵 TikTok"],
  ["global-media", "🌍 国外媒体"],
  ["emby", "🎞 Emby"],
  ["onedrive", "🐬 OneDrive"],
  ["google", "🍀 Google"],
  ["apple", "🍏 Apple"],
  ["microsoft", "🪟 Microsoft"],
  ["speedtest", "🎯 全球直连"],
  ["bilibili", "🎯 全球直连"],
  ["wechat", "🎯 全球直连"],
  ["finance", "🎯 全球直连"],
  ["ehentai", "🇯🇵 日本自动"],
  ["private-tracker", "🎯 全球直连"],
]);

const asnPolicies = new Map([
  ["telegram", ["211157", "44907", "59930", "62014", "62041"]],
  ["twitter", ["32934"]],
  ["wechat", ["132203"]],
]);

const serviceRuleSets = [...policySlugs.keys()].map((slug) =>
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
  download_detour: "🎯 全球直连",
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
  { ip_is_private: true, action: "route", outbound: "🎯 全球直连" },
  { clash_mode: "direct", action: "route", outbound: "🎯 全球直连" },
  { clash_mode: "global", action: "route", outbound: "GLOBAL" },
  { rule_set: "geosite-ads-all", action: "reject" },
];

for (const [slug, policy] of policySlugs) {
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
  { rule_set: "user-hk", action: "route", outbound: "🇭🇰 香港自动" },
  { rule_set: "user-sg", action: "route", outbound: "🇸🇬 狮城自动" },
  { rule_set: "user-us", action: "route", outbound: "🇺🇲 美国自动" },
  { rule_set: "user-jp", action: "route", outbound: "🇯🇵 日本自动" },
  { rule_set: "user-direct", action: "route", outbound: "🎯 全球直连" },
  { rule_set: "geosite-cn", action: "route", outbound: "🎯 全球直连" },
  { rule_set: "geoip-cn", action: "route", outbound: "🎯 全球直连" },
);

config.route.rules = routeRules;
config.route.final = "🐠 漏网之鱼";

for (const server of config.dns?.servers ?? []) {
  if (server.detour) server.detour = "🚀 默认代理";
}
for (const rule of config.dns?.rules ?? []) {
  if (rule.rule_set) rule.rule_set = ["geosite-cn", "surge-apple"];
}
if (config.experimental?.clash_api?.external_ui_download_detour) {
  config.experimental.clash_api.external_ui_download_detour = "🎯 全球直连";
}

const majorRegionNodes = "^(?:🇭🇰|🇯🇵|🇸🇬|🇺🇸)";
const automaticMajorRegionNodes =
  "^(?!(?:🇯🇵 JP-GREEN｜Vless|🇺🇸 US-BWH｜Vless)$)(?:🇭🇰|🇯🇵|🇸🇬|🇺🇸)";

const injectionRules = [
  ["^♻️ 自动选择$", automaticMajorRegionNodes],
  ["^🐸 手动选择$", majorRegionNodes],
  ["^🇭🇰 香港自动$", "^🇭🇰"],
  ["^🇯🇵 日本自动$", "^(?!🇯🇵 JP-GREEN｜Vless$)🇯🇵"],
  ["^🇸🇬 狮城自动$", "^🇸🇬"],
  ["^🇺🇲 美国自动$", "^(?!🇺🇸 US-BWH｜Vless$)🇺🇸"],
  ["^其他地区$", "^(?:🇹🇼|🇰🇷|🇩🇪|🇬🇧)"],
];

const outboundArgument = injectionRules
  .map(([outboundPattern, tagPattern]) =>
    `🕳ℹ️${outboundPattern}${tagPattern ? `🏷ℹ️${tagPattern}` : ""}`,
  )
  .join("");

const operator = file.process?.find(
  (item) =>
    item.type === "Script Operator" &&
    item.args?.content?.includes("/sing-box/template.js"),
);
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

const metadataFilterName = "过滤 sing-box 订阅状态节点";
file.process = (file.process ?? []).filter(
  (item) =>
    item.customName !== metadataFilterName &&
    item.args?.content !== metadataFilterUrl,
);
const operatorIndex = file.process.indexOf(operator);
file.process.splice(operatorIndex + 1, 0, {
  id: "20260729.2401",
  type: "Script Operator",
  disabled: false,
  customName: metadataFilterName,
  args: {
    mode: "link",
    content: metadataFilterUrl,
    arguments: {},
  },
});

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
