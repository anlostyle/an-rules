#!/bin/sh
# 在本仓库装一个 pre-commit 钩子：提交前自动用 my-rules.list 重新生成 singbox/user-*.json 并加入本次提交；
# 源文件写错了（类型 / 出口不认识、同一条规则写了两个出口）就拦住提交。
cd "$(git rev-parse --show-toplevel)" || exit 1
cat > .git/hooks/pre-commit <<'HOOK'
#!/bin/sh
python3 scripts/build_user_rules.py || { echo "my-rules.list 有错误，提交已取消"; exit 1; }
git add singbox/user-hk.json singbox/user-sg.json singbox/user-us.json singbox/user-jp.json singbox/user-direct.json
HOOK
chmod +x .git/hooks/pre-commit
echo "已安装 .git/hooks/pre-commit"
