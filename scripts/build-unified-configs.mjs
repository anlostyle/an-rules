#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const [storePath, surgeBasePath, outputDir, suffix] = process.argv.slice(2);
if (!storePath || !surgeBasePath || !outputDir || !/^[a-z0-9-]{6,64}$/.test(suffix ?? "")) {
  throw new Error(
    "usage: build-unified-configs.mjs <sub-store.json> <mac.surgeconfig.conf> <output-dir> <safe-suffix>",
  );
}

const repoRoot = path.resolve(import.meta.dirname, "..");
const rawBase = "https://raw.githubusercontent.com/anlostyle/an-rules/main";
const metaBase = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta";
const homeCidrs = [
  "10.0.0.0/24",
  "10.0.1.0/24",
  "10.0.2.0/24",
  "10.0.3.0/24",
  "10.0.5.0/24",
];
const privateCidrs = [
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "fc00::/7",
  "fe80::/10",
];

const store = JSON.parse(await fs.readFile(storePath, "utf8"));
const surgeBase = await fs.readFile(surgeBasePath, "utf8");
const sourceSingboxFile = store.files.find((file) => file.name === "singbox");
const sourceMihomoFile = store.files.find(
  (file) => file.name === "tiNan专用clash配置",
);
if (!sourceSingboxFile || !sourceMihomoFile) {
  throw new Error("source Sub-Store files not found");
}

const singbox = JSON.parse(sourceSingboxFile.content);
const canonicalGroups = singbox.outbounds.filter((outbound) =>
  ["selector", "urltest", "direct"].includes(outbound.type),
);
const canonicalGroupNames = new Set(canonicalGroups.map((group) => group.tag));
if (canonicalGroupNames.size !== canonicalGroups.length) {
  throw new Error("duplicate canonical sing-box group");
}

const injectionOperator = sourceSingboxFile.process?.find(
  (item) => item.type === "Script Operator" && item.args?.arguments?.outbound,
);
if (!injectionOperator) throw new Error("sing-box node injection operator not found");

const groupFilters = new Map();
for (const entry of injectionOperator.args.arguments.outbound.split("🕳ℹ️").filter(Boolean)) {
  const [groupPattern, nodePattern] = entry.split("🏷ℹ️");
  if (!groupPattern || !nodePattern) continue;
  const matcher = new RegExp(groupPattern);
  const group = canonicalGroups.find(({ tag }) => matcher.test(tag));
  if (group) groupFilters.set(group.tag, nodePattern);
}

function orderedMembers(group) {
  const members = [...(group.outbounds ?? [])];
  if (!group.default) return members;
  return [group.default, ...members.filter((member) => member !== group.default)];
}

function sourcePathForRuleSet(tag) {
  if (tag.startsWith("surge-")) {
    return path.join(repoRoot, "singbox", "surge", `${tag.slice(6)}.json`);
  }
  if (tag.startsWith("user-")) {
    return path.join(repoRoot, "singbox", `${tag}.json`);
  }
  return null;
}

function ruleLines(source) {
  const output = [];
  for (const rule of source.rules ?? []) {
    for (const [field, values] of Object.entries(rule)) {
      for (const value of values) {
        if (field === "domain") output.push(`DOMAIN,${value}`);
        else if (field === "domain_suffix") output.push(`DOMAIN-SUFFIX,${value}`);
        else if (field === "domain_keyword") output.push(`DOMAIN-KEYWORD,${value}`);
        else if (field === "domain_regex") output.push(`DOMAIN-REGEX,${value}`);
        else if (field === "ip_cidr") {
          output.push(`${value.includes(":") ? "IP-CIDR6" : "IP-CIDR"},${value},no-resolve`);
        } else {
          throw new Error(`unsupported sing-box rule field ${field}`);
        }
      }
    }
  }
  return output;
}

const generatedRuleSets = new Map();
for (const ruleSet of singbox.route.rule_set) {
  const sourcePath = sourcePathForRuleSet(ruleSet.tag);
  if (!sourcePath) continue;
  const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const lines = ruleLines(source);
  if (!lines.length) throw new Error(`empty rule set ${ruleSet.tag}`);
  generatedRuleSets.set(ruleSet.tag, lines);
}

const mihomoRuleDir = path.join(repoRoot, "mihomo", "unified");
const surgeRuleDir = path.join(repoRoot, "surge", "unified");
await fs.mkdir(mihomoRuleDir, { recursive: true });
await fs.mkdir(surgeRuleDir, { recursive: true });
for (const [tag, lines] of generatedRuleSets) {
  await fs.writeFile(
    path.join(mihomoRuleDir, `${tag}.yaml`),
    `payload:\n${lines.map((line) => `  - ${JSON.stringify(line)}`).join("\n")}\n`,
  );
  await fs.writeFile(path.join(surgeRuleDir, `${tag}.list`), `${lines.join("\n")}\n`);
}

function metaRuleSet(tag, extension) {
  if (tag === "geosite-ads-all") return `${metaBase}/geo/geosite/category-ads-all.${extension}`;
  if (tag === "geosite-cn") return `${metaBase}/geo/geosite/cn.${extension}`;
  if (tag === "geoip-cn") return `${metaBase}/geo/geoip/cn.${extension}`;
  if (tag.startsWith("asn-")) return `${metaBase}/asn/AS${tag.slice(4)}.${extension}`;
  return null;
}

function generatedRuleUrl(platform, tag, extension) {
  return `${rawBase}/${platform}/unified/${tag}.${extension}`;
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function replaceYamlBlock(text, key, replacement) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${key}:` || line.startsWith(`${key}: `));
  if (start < 0) throw new Error(`YAML block ${key} not found`);
  let end = start + 1;
  while (end < lines.length && !/^[A-Za-z][A-Za-z0-9_-]*:/.test(lines[end])) end += 1;
  lines.splice(start, end - start, ...replacement.trimEnd().split("\n"));
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function removeYamlBlock(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${key}:` || line.startsWith(`${key}: `));
  if (start < 0) return text;
  let end = start + 1;
  while (end < lines.length && !/^[A-Za-z][A-Za-z0-9_-]*:/.test(lines[end])) end += 1;
  lines.splice(start, end - start);
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function mihomoGroups() {
  const lines = ["proxy-groups:"];
  for (const group of canonicalGroups) {
    if (group.tag === "GLOBAL") continue;
    if (group.type === "selector") {
      lines.push(`  - name: ${yamlQuote(group.tag)}`, "    type: select");
      const filter = groupFilters.get(group.tag);
      if (filter) {
        lines.push(
          "    use:",
          `      - ${yamlQuote("1.自建机场")}`,
          `    filter: ${yamlQuote(filter)}`,
        );
      } else {
        lines.push("    proxies:");
        for (const member of orderedMembers(group)) lines.push(`      - ${yamlQuote(member)}`);
      }
    } else if (group.type === "urltest") {
      const filter = groupFilters.get(group.tag);
      if (!filter) throw new Error(`missing node filter for ${group.tag}`);
      lines.push(
        `  - name: ${yamlQuote(group.tag)}`,
        "    type: url-test",
        "    use:",
        `      - ${yamlQuote("1.自建机场")}`,
        `    filter: ${yamlQuote(filter)}`,
        "    url: https://www.gstatic.com/generate_204",
        "    interval: 600",
        "    tolerance: 100",
        "    lazy: true",
      );
    } else if (group.type === "direct") {
      lines.push(
        `  - name: ${yamlQuote(group.tag)}`,
        "    type: select",
        "    proxies:",
        "      - DIRECT",
      );
    }
  }
  lines.push(
    `  - name: ${yamlQuote("🏠 回家节点")}`,
    "    type: select",
    "    use:",
    `      - ${yamlQuote("2.回家节点")}`,
  );
  return lines.join("\n");
}

function mihomoRuleProviders() {
  const lines = ["rule-providers:"];
  for (const ruleSet of singbox.route.rule_set) {
    const { tag } = ruleSet;
    const generated = generatedRuleSets.has(tag);
    const url = generated
      ? generatedRuleUrl("mihomo", tag, "yaml")
      : metaRuleSet(tag, "mrs");
    if (!url) throw new Error(`no Mihomo rule provider mapping for ${tag}`);
    const behavior = tag === "geoip-cn" || tag.startsWith("asn-")
      ? "ipcidr"
      : tag === "geosite-ads-all" || tag === "geosite-cn"
        ? "domain"
        : "classical";
    const extension = generated ? "yaml" : "mrs";
    lines.push(
      `  ${yamlQuote(tag)}:`,
      "    type: http",
      `    behavior: ${behavior}`,
      `    format: ${extension}`,
      `    url: ${yamlQuote(url)}`,
      `    path: ${yamlQuote(`./ruleset/${tag}.${extension}`)}`,
      "    interval: 86400",
    );
  }
  return lines.join("\n");
}

function mappedMihomoRules() {
  const rules = homeCidrs.map((cidr) => `IP-CIDR,${cidr},🏠 回家节点,no-resolve`);
  for (const rule of singbox.route.rules) {
    if (rule.action === "sniff" || rule.action === "hijack-dns" || rule.clash_mode) continue;
    if (rule.ip_is_private) {
      rules.push(...privateCidrs.map((cidr) => `${cidr.includes(":") ? "IP-CIDR6" : "IP-CIDR"},${cidr},🎯 全球直连,no-resolve`));
    } else if (rule.rule_set) {
      const policy = rule.action === "reject" ? "REJECT" : rule.outbound;
      rules.push(`RULE-SET,${rule.rule_set},${policy}`);
    }
  }
  rules.push(`MATCH,${singbox.route.final}`);
  return `rules:\n${rules.map((rule) => `  - ${yamlQuote(rule)}`).join("\n")}`;
}

let mihomo = sourceMihomoFile.content.replace(/^global-client-fingerprint:.*\n/m, "");
for (const key of [
  "geodata-mode",
  "geodata-loader",
  "geox-url",
  "geo-auto-update",
  "geo-update-interval",
  "external-ui",
]) {
  mihomo = removeYamlBlock(mihomo, key);
}
mihomo = replaceYamlBlock(mihomo, "proxy-groups", mihomoGroups());
mihomo = replaceYamlBlock(mihomo, "rules", mappedMihomoRules());
mihomo = replaceYamlBlock(mihomo, "rule-providers", mihomoRuleProviders());

function section(text, name) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(`[${name}]`);
  if (start < 0) throw new Error(`Surge section ${name} not found`);
  let end = start + 1;
  while (end < lines.length && !/^\[.+\]$/.test(lines[end])) end += 1;
  return lines.slice(start + 1, end).join("\n").trimEnd();
}

function surgeQuote(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

const surgeGroupLines = section(surgeBase, "Proxy Group").split(/\r?\n/);
const existingHomeGroup = surgeGroupLines.find((line) => /^\ud83c\udfe0 \u56de\u5bb6\u8282\u70b9\s*=/.test(line));
const existingAirportGroup = surgeGroupLines.find((line) => /^\ud83e\udd6c \u767d\u83dc\u4e91\s*=/.test(line));
if (!existingHomeGroup) throw new Error("Surge home group not found");
if (!existingAirportGroup) throw new Error("Surge airport source group not found");
const homeMembers = [...existingHomeGroup.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
const txHomeMember = homeMembers.find((member) => member.includes("SSR-TX"));
if (!txHomeMember) throw new Error("Surge Ruichi SS home node not found");
const normalizedHomeGroup = `🏠 回家节点 = select, ${[
  txHomeMember,
  ...homeMembers.filter((member) => member !== txHomeMember),
].map(surgeQuote).join(", ")}, no-alert=0, hidden=0`;

function surgeGroups() {
  const lines = [];
  for (const group of canonicalGroups) {
    if (group.type === "selector") {
      const members = orderedMembers(group);
      if (group.tag === "GLOBAL") members.push("🏠 回家节点");
      const filter = groupFilters.get(group.tag);
      if (filter) {
        lines.push(
          `${group.tag} = select, include-all-proxies=0, include-other-group=🥬 白菜云, policy-regex-filter=${filter}, no-alert=0`,
        );
      } else {
        lines.push(`${group.tag} = select, ${members.map(surgeQuote).join(", ")}, no-alert=0`);
      }
    } else if (group.type === "urltest") {
      const filter = groupFilters.get(group.tag);
      if (!filter) throw new Error(`missing node filter for ${group.tag}`);
      lines.push(
        `${group.tag} = smart, include-all-proxies=0, include-other-group=🥬 白菜云, policy-regex-filter=${filter}, no-alert=0`,
      );
    } else if (group.type === "direct") {
      lines.push(`${group.tag} = select, DIRECT, no-alert=0`);
    }
  }
  lines.push(normalizedHomeGroup);
  lines.push(`${existingAirportGroup}, hidden=1`);
  return lines.join("\n");
}

function surgeRuleUrl(tag) {
  return generatedRuleSets.has(tag)
    ? generatedRuleUrl("surge", tag, "list")
    : metaRuleSet(tag, "list");
}

function mappedSurgeRules() {
  const lines = ["# 回家节点"];
  for (const cidr of homeCidrs) {
    lines.push(`IP-CIDR,${cidr},${surgeQuote("🏠 回家节点")},no-resolve`);
  }
  for (const rule of singbox.route.rules) {
    if (rule.action === "sniff" || rule.action === "hijack-dns" || rule.clash_mode) continue;
    if (rule.ip_is_private) {
      for (const cidr of privateCidrs) {
        lines.push(`${cidr.includes(":") ? "IP-CIDR6" : "IP-CIDR"},${cidr},${surgeQuote("🎯 全球直连")},no-resolve`);
      }
    } else if (rule.rule_set) {
      const url = surgeRuleUrl(rule.rule_set);
      if (!url) throw new Error(`no Surge rule mapping for ${rule.rule_set}`);
      const policy = rule.action === "reject" ? "REJECT" : surgeQuote(rule.outbound);
      lines.push(`RULE-SET,${url},${policy}`);
    }
  }
  lines.push(`FINAL,${surgeQuote(singbox.route.final)},dns-failed`);
  return lines.join("\n");
}

const surge = `[General]\n${section(surgeBase, "General")}\n\n[Proxy]\n${section(surgeBase, "Proxy")}\n\n[Proxy Group]\n${surgeGroups()}\n\n[Rule]\n${mappedSurgeRules()}\n`;

const fileNames = {
  singbox: `unified-v1-singbox-${suffix}`,
  mihomo: `unified-v1-mihomo-${suffix}`,
  surge: `unified-v1-surge-${suffix}`,
};
if (Object.values(fileNames).some((name) => store.files.some((file) => file.name === name))) {
  throw new Error("target Sub-Store file already exists");
}

function cloneFile(source, name, content, process = []) {
  return {
    ...structuredClone(source),
    name,
    displayName: name,
    "display-name": name,
    remark: name,
    content,
    process: structuredClone(process),
  };
}

const newFiles = [
  cloneFile(sourceSingboxFile, fileNames.singbox, sourceSingboxFile.content, sourceSingboxFile.process),
  cloneFile(sourceMihomoFile, fileNames.mihomo, mihomo),
  cloneFile(sourceMihomoFile, fileNames.surge, surge),
];
store.files.push(...newFiles);

const targetGroups = new Set(canonicalGroupNames);
targetGroups.delete("GLOBAL");
targetGroups.add("🏠 回家节点");
for (const rule of singbox.route.rules) {
  if (rule.outbound && !canonicalGroupNames.has(rule.outbound)) {
    throw new Error(`canonical route references missing group ${rule.outbound}`);
  }
}
if (mihomo.includes("global-client-fingerprint") || !surge.includes("🏠 回家节点")) {
  throw new Error("generated config self-check failed");
}

await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
await fs.chmod(outputDir, 0o700);
await fs.writeFile(path.join(outputDir, "singbox.json"), `${sourceSingboxFile.content.trimEnd()}\n`, { mode: 0o600 });
await fs.writeFile(path.join(outputDir, "mihomo.yaml"), mihomo, { mode: 0o600 });
await fs.writeFile(path.join(outputDir, "surge.conf"), surge, { mode: 0o600 });
await fs.writeFile(path.join(outputDir, "sub-store.json"), `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify({ fileNames, generatedRuleSets: [...generatedRuleSets.keys()] }, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(
  JSON.stringify({
    fileNames,
    canonicalGroups: canonicalGroups.length,
    canonicalRuleSets: singbox.route.rule_set.length,
    canonicalRules: singbox.route.rules.length,
    generatedRuleSets: generatedRuleSets.size,
  }),
);
