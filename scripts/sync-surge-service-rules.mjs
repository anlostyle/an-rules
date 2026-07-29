#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const surgeConfigPath =
  process.argv[2] ??
  "/Users/anmini/Library/Mobile Documents/iCloud~com~nssurge~inc/Documents/白菜灵车漂移.conf";
const repoRoot = path.resolve(import.meta.dirname, "..");
const outputDir = path.join(repoRoot, "singbox", "surge");

const policyFiles = new Map([
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

const fieldMap = new Map([
  ["DOMAIN", "domain"],
  ["DOMAIN-SUFFIX", "domain_suffix"],
  ["DOMAIN-KEYWORD", "domain_keyword"],
  ["IP-CIDR", "ip_cidr"],
  ["IP-CIDR6", "ip_cidr"],
]);

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  fields.push(value.trim());
  return fields;
}

function wildcardToRegex(value) {
  const escaped = value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return `^${escaped.replaceAll("*", ".*")}$`;
}

function addValue(fields, key, value) {
  if (!value) return;
  if (!fields.has(key)) fields.set(key, new Set());
  fields.get(key).add(value);
}

function parseRuleLine(line, fields, skippedTypes) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;
  const [type, value] = parseCsvLine(trimmed);
  if (!type || !value) return;
  if (fieldMap.has(type)) {
    addValue(fields, fieldMap.get(type), value);
  } else if (type === "DOMAIN-WILDCARD") {
    addValue(fields, "domain_regex", wildcardToRegex(value));
  } else if (type === "IP-ASN") {
    addValue(fields, "ip_asn", value.replace(/^AS/i, ""));
  } else {
    skippedTypes.add(type);
  }
}

const configText = await fs.readFile(surgeConfigPath, "utf8");
const lines = configText.split(/\r?\n/);
const policySources = new Map();
const inlineRules = new Map();
let inRuleSection = false;

for (const line of lines) {
  if (line === "[Rule]") {
    inRuleSection = true;
    continue;
  }
  if (inRuleSection && /^\[.+\]$/.test(line)) break;
  if (!inRuleSection || !/^[A-Z]/.test(line)) continue;

  const [type, value, policy] = parseCsvLine(line.replace(/\s+\/\/.*$/, ""));
  if (!policyFiles.has(policy)) continue;
  if (type === "RULE-SET" && /^https?:\/\//.test(value)) {
    if (!policySources.has(policy)) policySources.set(policy, []);
    policySources.get(policy).push(value);
  } else {
    if (!inlineRules.has(policy)) inlineRules.set(policy, []);
    inlineRules.get(policy).push(line);
  }
}

await fs.mkdir(outputDir, { recursive: true });
const manifest = {
  source: path.basename(surgeConfigPath),
  generatedAt: new Date().toISOString(),
  policies: {},
};

for (const [policy, fileSlug] of policyFiles) {
  const fields = new Map();
  const skippedTypes = new Set();
  const sources = policySources.get(policy) ?? [];

  for (const source of sources) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${source}: HTTP ${response.status}`);
    }
    const content = await response.text();
    for (const line of content.split(/\r?\n/)) {
      parseRuleLine(line, fields, skippedTypes);
    }
  }

  for (const line of inlineRules.get(policy) ?? []) {
    parseRuleLine(line, fields, skippedTypes);
  }

  const ipAsns = [...(fields.get("ip_asn") ?? [])].sort();
  fields.delete("ip_asn");
  const rule = Object.fromEntries(
    [...fields.entries()]
      .map(([key, values]) => [key, [...values].sort()])
      .filter(([, values]) => values.length > 0),
  );
  const output = { version: 3, rules: [rule] };
  const outputPath = path.join(outputDir, `${fileSlug}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  manifest.policies[policy] = {
    file: `singbox/surge/${fileSlug}.json`,
    sources,
    counts: Object.fromEntries(
      Object.entries(rule).map(([key, values]) => [key, values.length]),
    ),
    ipAsns,
    skippedTypes: [...skippedTypes].sort(),
  };
}

await fs.writeFile(
  path.join(outputDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

for (const [policy, details] of Object.entries(manifest.policies)) {
  const total = Object.values(details.counts).reduce((sum, count) => sum + count, 0);
  console.log(
    `${policy}\t${total} rules\t${details.ipAsns.length} ASNs\t${details.skippedTypes.join("|") || "-"}`,
  );
}
