#!/usr/bin/env bash
# HireFlesh OpenClaw skill installer
# Usage: bash install.sh
set -euo pipefail

echo "🦞 HireFlesh OpenClaw Skill Installer"
echo "======================================"

# 1. Check Node.js
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is required but not found. Install from https://nodejs.org"
  exit 1
fi

# 2. Install the HireFlesh MCP server globally
echo ""
echo "📦 Installing @hireflesh/mcp-server globally..."
npm install -g @hireflesh/mcp-server
echo "✅ hireflesh-mcp binary ready"

# 3. Check / install mcporter
if ! command -v mcporter &>/dev/null; then
  echo ""
  echo "📦 Installing mcporter (needed to call MCP servers from OpenClaw)..."
  npm install -g mcporter
  echo "✅ mcporter installed"
else
  echo "✅ mcporter already installed ($(mcporter --version 2>/dev/null || echo 'unknown version'))"
fi

# 4. Install the skill into OpenClaw's skill directory
SKILL_DIR="${HOME}/.openclaw/skills/hireflesh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "📋 Installing skill to ${SKILL_DIR}..."
mkdir -p "${SKILL_DIR}"
cp "${SCRIPT_DIR}/SKILL.md" "${SKILL_DIR}/SKILL.md"
echo "✅ Skill installed"

# 5. Prompt for API key
echo ""
if [ -z "${HIREFLESH_API_KEY:-}" ]; then
  echo "🔑 Enter your HireFlesh API key (from https://hireflesh.com/settings):"
  read -r -s HIREFLESH_API_KEY
  echo ""
fi

# 6. Persist key in openclaw.json
OPENCLAW_CONFIG="${HOME}/.openclaw/openclaw.json"
if command -v python3 &>/dev/null && [ -f "${OPENCLAW_CONFIG}" ]; then
  echo "💾 Adding HIREFLESH_API_KEY to ${OPENCLAW_CONFIG}..."
  python3 - <<PYEOF
import json, sys

cfg_path = "${OPENCLAW_CONFIG}"
api_key  = "${HIREFLESH_API_KEY}"

try:
    with open(cfg_path) as f:
        cfg = json.load(f)
except Exception:
    cfg = {}

cfg.setdefault("skills", {}).setdefault("entries", {})["hireflesh"] = {
    "enabled": True,
    "env": {"HIREFLESH_API_KEY": api_key},
}

with open(cfg_path, "w") as f:
    json.dump(cfg, f, indent=2)

print("  Saved.")
PYEOF
else
  echo ""
  echo "⚠️  Could not auto-update ${OPENCLAW_CONFIG}."
  echo "   Add the following manually:"
  echo ""
  echo '   "skills": {'
  echo '     "entries": {'
  echo '       "hireflesh": {'
  echo '         "enabled": true,'
  echo "         \"env\": { \"HIREFLESH_API_KEY\": \"${HIREFLESH_API_KEY}\" }"
  echo '       }'
  echo '     }'
  echo '   }'
fi

echo ""
echo "🎉 Done! Restart your OpenClaw agent to load the HireFlesh skill."
echo ""
echo "   Try: 'Post a task on HireFlesh to proofread my blog post.'"
