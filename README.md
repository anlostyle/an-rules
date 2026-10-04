# an-rules

Personal sing-box rule sets.

Raw URLs use `https://raw.githubusercontent.com/anlostyle/an-rules/main/singbox/<name>.json`.

## 个人规则：只改一个文件

个人 sing-box 规则只维护 **`my-rules.list`**，每行 `类型,值,出口`（出口：HK / SG / US / JP / DIRECT）。
`singbox/user-{hk,sg,us,jp,direct}.json` 是**生成物**（MoMo / Sub-Store 仍然读它们），不要手改：

```
python3 scripts/build_user_rules.py          # 生成
python3 scripts/build_user_rules.py --check  # 只检查是否一致
sh scripts/install-hooks.sh                  # 装 pre-commit 钩子：提交时自动生成并一起提交（新克隆的仓库要装一次）
```

出口的先后由模板里的路由顺序决定：HK > SG > US > JP > DIRECT；同一域名被不同出口命中时先到先得，脚本会把「重叠」列出来。
哪个站不能走某个出口，只改那一行的出口即可。
