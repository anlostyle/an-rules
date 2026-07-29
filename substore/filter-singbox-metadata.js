const config = JSON.parse($content);
const metadataTag = /^(?:剩余流量|套餐到期)：/;

const removedTags = new Set(
  [...(config.outbounds ?? []), ...(config.endpoints ?? [])]
    .map((outbound) => outbound?.tag)
    .filter((tag) => typeof tag === "string" && metadataTag.test(tag)),
);

config.outbounds = (config.outbounds ?? []).filter(
  (outbound) => !removedTags.has(outbound?.tag),
);
config.endpoints = (config.endpoints ?? []).filter(
  (endpoint) => !removedTags.has(endpoint?.tag),
);

for (const outbound of config.outbounds) {
  if (Array.isArray(outbound.outbounds)) {
    outbound.outbounds = outbound.outbounds.filter(
      (tag) => !removedTags.has(tag),
    );
  }
}

console.log(
  `[sing-box metadata filter] removed ${removedTags.size} subscription-status entries`,
);
$content = JSON.stringify(config, null, 2);
