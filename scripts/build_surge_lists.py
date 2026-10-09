#!/usr/bin/env python3
"""生成 Surge 用的规则文件（surge/unified/），让手机 Surge 和 MoMo(sing-box) 用同一批规则。

两类来源：
  user    singbox/user-{hk,sg,us,jp,direct}.json  ->  surge/unified/user-*.list      (RULE-SET)
  meta    MetaCubeX meta-rules-dat 的文本规则      ->  surge/unified/geosite-*.txt   (DOMAIN-SET)
                                                       surge/unified/geoip-cn.list   (RULE-SET)
MetaCubeX 的 .list 是 mihomo 写法（`+.example.com`、纯 CIDR），Surge 不认，所以要转换。
MoMo 直接用 MetaCubeX 的 .srs，这里转出来的内容与之同源；GitHub Actions 每天跑一次 meta 部分。

用法：
  python3 scripts/build_surge_lists.py          两类都生成
  python3 scripts/build_surge_lists.py user     只生成 user-*.list（本地即可，不联网）
  python3 scripts/build_surge_lists.py meta     只转换 MetaCubeX 规则（需要联网）
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "surge" / "unified"
META = "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo"
GEOSITE = {  # 输出文件名 -> MetaCubeX geosite 名；与 Sub-Store sing-box 模板里的 rule_set 一一对应
    "geosite-ai-chat-not-cn": "category-ai-chat-!cn",
    "geosite-agilebits": "agilebits",
    "geosite-ebay": "ebay",
    "geosite-cn": "cn",
}
USER = ["hk", "sg", "us", "jp", "direct"]


def write(path, lines):
    text = "\n".join(lines) + "\n"
    if path.exists() and path.read_text() == text:
        return
    path.write_text(text)
    print(f"updated {path.relative_to(ROOT)} ({len(lines)} lines)")


def ip_rule(cidr, no_resolve=True):
    rule = f"{'IP-CIDR6' if ':' in cidr else 'IP-CIDR'},{cidr}"
    return f"{rule},no-resolve" if no_resolve else rule


def build_user():
    for name in USER:
        lines = []
        for rule in json.loads((ROOT / "singbox" / f"user-{name}.json").read_text())["rules"]:
            lines += [f"DOMAIN,{v}" for v in rule.get("domain", [])]
            lines += [f"DOMAIN-SUFFIX,{v}" for v in rule.get("domain_suffix", [])]
            lines += [f"DOMAIN-KEYWORD,{v}" for v in rule.get("domain_keyword", [])]
            lines += [ip_rule(v) for v in rule.get("ip_cidr", [])]
            if rule.get("domain_regex"):
                sys.exit(f"user-{name}: Surge 不支持 domain_regex，请改写成其它类型")
        write(OUT / f"user-{name}.list", lines)


def fetch(path):
    with urllib.request.urlopen(f"{META}/{urllib.request.quote(path)}", timeout=120) as r:
        lines = [l.strip() for l in r.read().decode().splitlines()]
    lines = [l for l in lines if l and not l.startswith("#")]
    if not lines:
        sys.exit(f"{path}: 下载内容为空，放弃写入")
    return lines


def build_meta():
    for out, name in GEOSITE.items():
        lines = []
        for l in fetch(f"geosite/{name}.list"):
            if l.startswith("+."):
                lines.append("." + l[2:])  # DOMAIN-SET：前导点 = 域名本身及所有子域
            elif l.startswith(("full:", "keyword:", "regexp:")) or "," in l:
                sys.exit(f"geosite/{name}: 未知格式 {l!r}")
            else:
                lines.append(l)
        write(OUT / f"{out}.txt", lines)
    # 不带 no-resolve：和原来一样，前面域名规则都没命中时解析域名再按 IP 判断
    write(OUT / "geoip-cn.list", [ip_rule(l, no_resolve=False) for l in fetch("geoip/cn.list")])


if __name__ == "__main__":
    what = sys.argv[1:] or ["user", "meta"]
    if "user" in what:
        build_user()
    if "meta" in what:
        build_meta()
