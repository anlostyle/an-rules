#!/usr/bin/env python3
"""从一个源文件 my-rules.list 生成 singbox/user-{hk,sg,us,jp,direct}.json。

你只维护 my-rules.list；那 5 个 json 是生成物（MoMo / Sub-Store 仍然读它们），不要手改。

源文件每行：  类型,值,出口   # 可选备注
  类型  DOMAIN | DOMAIN-SUFFIX | DOMAIN-KEYWORD | DOMAIN-REGEX | IP-CIDR
  出口  HK | SG | US | JP | DIRECT   （大小写不限）
  # 开头的整行是注释；空行忽略

用法：
  python3 scripts/build_user_rules.py          生成（有变化才写文件）
  python3 scripts/build_user_rules.py --check  只检查生成物是否和源文件一致（不一致返回 1）

出口的匹配先后由模板里的路由顺序决定：HK > SG > US > JP > DIRECT。同一个域名被不同出口的规则同时命中时，
先到先得，下面会把这类「重叠」列出来，方便你确认是不是有意为之（例如 wall.andp.cc 比 andp.cc 更具体）。
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "my-rules.list"
ORDER = ["hk", "sg", "us", "jp", "direct"]                       # 与模板里 route.rules 的先后一致
FIELD = {"DOMAIN": "domain", "DOMAIN-SUFFIX": "domain_suffix", "DOMAIN-KEYWORD": "domain_keyword",
         "DOMAIN-REGEX": "domain_regex", "IP-CIDR": "ip_cidr"}
DOMAINISH = ("domain", "domain_suffix", "domain_keyword", "domain_regex")   # sing-box 里这几类是「或」的关系，放同一条规则
ALIAS = {"HK": "hk", "SG": "sg", "US": "us", "JP": "jp", "DIRECT": "direct", "DIR": "direct"}


def parse(path: Path):
    entries, errors = [], []
    for n, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 3:
            errors.append(f"第 {n} 行格式不对（要「类型,值,出口」）：{raw.strip()}")
            continue
        typ, value, pol = parts[0].upper(), parts[1], ALIAS.get(parts[2].upper())
        if typ not in FIELD:
            errors.append(f"第 {n} 行类型不认识：{parts[0]}（可用 {' / '.join(FIELD)}）")
        elif pol is None:
            errors.append(f"第 {n} 行出口不认识：{parts[2]}（可用 HK / SG / US / JP / DIRECT）")
        elif not value:
            errors.append(f"第 {n} 行值是空的")
        else:
            entries.append((n, FIELD[typ], value.lower() if typ != "DOMAIN-REGEX" else value, pol))
    return entries, errors


def overlaps(entries):
    """不同出口之间会同时命中同一个域名的规则。返回 (硬错误, 提示)。"""
    errs, notes = [], []
    seen = {}
    for n, f, v, p in entries:
        k = (f, v)
        if k in seen and seen[k][1] != p:
            errs.append(f"第 {n} 行 {f}:{v} 同时写了两个出口（{seen[k][1]} 和 {p}，第 {seen[k][0]} 行）")
        seen.setdefault(k, (n, p))
    dom = [(n, f, v, p) for n, f, v, p in entries if f in DOMAINISH and f != "domain_regex"]
    for i, (n1, f1, v1, p1) in enumerate(dom):
        for n2, f2, v2, p2 in dom[i + 1:]:
            if p1 == p2:
                continue
            hit = False
            if f1 == "domain_keyword":
                hit = v1 in v2
            elif f2 == "domain_keyword":
                hit = v2 in v1
            elif f1 == "domain_suffix" and f2 in ("domain", "domain_suffix"):
                hit = v2 == v1 or v2.endswith("." + v1)
            elif f2 == "domain_suffix" and f1 == "domain":
                hit = v1 == v2 or v1.endswith("." + v2)
            if hit:
                win = min((p1, p2), key=ORDER.index)
                notes.append(f"重叠：{f1}:{v1}→{p1.upper()}（第 {n1} 行）与 {f2}:{v2}→{p2.upper()}（第 {n2} 行）可能命中同一域名，按顺序 {win.upper()} 生效")
    return errs, notes


def build(entries):
    out = {p: {} for p in ORDER}
    for _n, f, v, p in entries:
        lst = out[p].setdefault(f, [])
        if v not in lst:
            lst.append(v)
    files = {}
    for p in ORDER:
        rules = []
        dom = {f: out[p][f] for f in DOMAINISH if f in out[p]}
        if dom:
            rules.append(dom)
        if "ip_cidr" in out[p]:
            rules.append({"ip_cidr": out[p]["ip_cidr"]})
        files[ROOT / "singbox" / f"user-{p}.json"] = json.dumps({"version": 3, "rules": rules}, indent=2, ensure_ascii=False) + "\n"
    return files


def main() -> int:
    check = "--check" in sys.argv
    entries, errors = parse(SRC)
    more, notes = overlaps(entries)
    errors += more
    for e in errors:
        print("错误：" + e)
    if errors:
        return 1
    for n in notes:
        print(n)
    files = build(entries)
    changed = []
    for path, text in files.items():
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            changed.append(path.name)
            if not check:
                path.write_text(text, encoding="utf-8")
    if check:
        if changed:
            print("生成物和 my-rules.list 不一致：" + "、".join(changed) + "（运行 python3 scripts/build_user_rules.py）")
            return 1
        print(f"一致：{len(entries)} 条规则 → 5 个 user-*.json")
        return 0
    print(("已更新：" + "、".join(changed)) if changed else "没有变化") 
    print(f"共 {len(entries)} 条规则")
    return 0


if __name__ == "__main__":
    sys.exit(main())
