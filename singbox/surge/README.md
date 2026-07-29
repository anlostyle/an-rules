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

The Sub-Store migration intentionally mirrors Surge's service-rule coverage
without copying its full policy-group topology. Related services share compact
policy groups, while Hong Kong, Japan, Singapore, the United States, and the
global automatic group use sing-box URLTest directly over matching raw nodes.
This keeps the Clash API at 19 visible groups (including `GLOBAL`) instead of
exposing every provider landing group.

URLTest is latency-based rather than an equivalent of Surge Smart. The generated
groups use a 10-minute interval, 100 ms tolerance, 30-minute idle timeout, and do
not interrupt established inbound connections when the preferred node changes.
