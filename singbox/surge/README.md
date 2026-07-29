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
