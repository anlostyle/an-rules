# Surge service-rule mirror for sing-box

These source-format sing-box rule sets are generated from the service rules in
the active iPhone Surge profile `白菜灵车漂移.conf`.

Refresh them with:

```sh
node scripts/sync-surge-service-rules.mjs
```

The conversion preserves domain, domain-suffix, domain-keyword, wildcard-domain,
IPv4, and IPv6 rules. ASN values are recorded in `manifest.json` and are mapped
to MetaCubeX ASN rule sets by the Sub-Store sing-box template. URL regex,
User-Agent, and client process rules are recorded as unsupported because a
router-side transparent proxy cannot reproduce those client-only matchers.

The Sub-Store migration mirrors the 20 business policy groups in the active
Surge profile, in the same display order: 国外媒体, Telegram, Twitter, Netflix,
Disney+, HBO, Spotify, TikTok, AI, Emby, Google, 微软服务, 苹果服务, Speedtest,
OneDrive, Bilibili, WeChat, 金融服务, E-Hentai, and PT站点. Each service has its
own sing-box selector instead of sharing a combined social-media or streaming
group.

Surge `icon-url` metadata cannot be represented by sing-box Selector outbounds
or its Clash API, so emoji prefixes provide the visible group icons instead.
Hong Kong, Japan, Singapore, the United States, and the global automatic group
use sing-box URLTest directly over matching raw nodes. Taiwan, South Korea,
Germany, and the United Kingdom are collected in one manual `🌐 其他地区`
selector. Subscription-status entries are excluded from all groups.
`JP-GREEN｜Vless` and `US-BWH｜Vless` remain available in `🐸 手动选择` but are
excluded from the global and country automatic URLTest groups.
The Clash API exposes 31 groups in total: 20 business groups, two routing
control groups (`🚀 默认代理` and `🐠 漏网之鱼`), eight infrastructure groups,
and `GLOBAL`.

URLTest is latency-based rather than an equivalent of Surge Smart. The generated
groups use a 10-minute interval, 100 ms tolerance, 30-minute idle timeout, and do
not interrupt established inbound connections when the preferred node changes.
