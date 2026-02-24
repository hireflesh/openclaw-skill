# HireFlesh — OpenClaw Skill

An [OpenClaw](https://github.com/openclaw/openclaw) skill that lets your personal AI assistant hire human workers on the [HireFlesh](https://hireflesh.com) marketplace, communicate with them over work threads, and approve results — all without leaving your chat interface.

## What this skill enables

- Post bounty tasks (data collection, content creation, research, verification, …)
- Browse bids and assign the best worker with one command
- Exchange messages and files with the assigned worker in real time
- Receive and review completed results
- Release payment once you're satisfied

## Quick Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hireflesh/openclaw-skill/main/install.sh)
```

This will:
1. Install `@hireflesh/mcp-server` globally via npm
2. Install `mcporter` (OpenClaw's MCP bridge) if needed
3. Copy `SKILL.md` into `~/.openclaw/skills/hireflesh/`
4. Prompt for your `HIREFLESH_API_KEY` and save it to `~/.openclaw/openclaw.json`

## Manual Install

### 1. Install dependencies

```bash
npm install -g @hireflesh/mcp-server mcporter
```

### 2. Copy the skill

```bash
mkdir -p ~/.openclaw/skills/hireflesh
curl -fsSL https://raw.githubusercontent.com/hireflesh/openclaw-skill/main/SKILL.md \
  -o ~/.openclaw/skills/hireflesh/SKILL.md
```

### 3. Add your API key

Get an API key at <https://hireflesh.com/settings>, then add it to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "hireflesh": {
        "enabled": true,
        "env": { "HIREFLESH_API_KEY": "hf_live_xxxxx" }
      }
    }
  }
}
```

Restart your OpenClaw agent.

## ClawHub

```bash
clawhub install hireflesh
```

## Usage Examples

Once installed, just talk to your OpenClaw agent naturally:

> "Post a task on HireFlesh to proofread my blog post, budget €20-40."

> "Any new bids on my HireFlesh tasks?"

> "Accept the bid from the top-rated worker and tell them to start."

> "Check if the worker sent any messages."

> "The result looks good — approve and release payment."

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 20 |
| OpenClaw | latest |
| mcporter | latest |
| `HIREFLESH_API_KEY` | from hireflesh.com/settings |

## Links

- [HireFlesh API docs](https://hireflesh.com/docs/api)
- [MCP Server source](https://github.com/hireflesh/mcp-server)
- [ClawHub listing](https://clawhub.ai/skills/hireflesh)
- [OpenClaw](https://github.com/openclaw/openclaw)

## License

MIT — see [LICENSE](LICENSE)
