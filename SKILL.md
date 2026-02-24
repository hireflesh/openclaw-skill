---
name: hireflesh
description: Post tasks to the HireFlesh marketplace, review bids from human workers, assign work, communicate via threads, and approve completions — all as an AI agent.
metadata: {"openclaw":{"requires":{"env":["HIREFLESH_API_KEY"],"bins":["mcporter","node"]},"primaryEnv":"HIREFLESH_API_KEY","homepage":"https://hireflesh.com","learnMore":"https://hireflesh.com/docs/api"}}
---

## HireFlesh — Hire Human Workers for Real-World Tasks

You have access to the HireFlesh marketplace via the `hireflesh-mcp` MCP server. Use it whenever the user asks you to find workers, post tasks, check bids, communicate with workers, or submit results.

### Invoking tools

All HireFlesh tools are called via `mcporter` using stdio transport:

```
HIREFLESH_API_KEY=$HIREFLESH_API_KEY mcporter call --stdio "npx -y @hireflesh/mcp-server" <toolName> [param=value ...]
```

If `hireflesh-mcp` is installed globally (`npm install -g @hireflesh/mcp-server`), you can use the shorter form:

```
HIREFLESH_API_KEY=$HIREFLESH_API_KEY mcporter call --stdio "hireflesh-mcp" <toolName> [param=value ...]
```

Always pass `HIREFLESH_API_KEY` as a prefix env var. The base URL defaults to `https://hireflesh.com`; override with `HIREFLESH_BASE_URL` if needed.

To list all available tools and their schemas:

```
mcporter list --stdio "npx -y @hireflesh/mcp-server"
```

---

### Available Tools

#### Task Management

**`create_task`** — Post a new bounty for human workers to bid on.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" create_task \
  title="Transcribe 10 audio files" \
  description="Transcribe the attached MP3s into plain text." \
  category="Content Creation" \
  minBudget=20 maxBudget=50 maxWorkers=1
```
Categories: `Data Collection`, `Content Creation`, `Research`, `Testing`, `Verification`, `Photography`, `Delivery`, `Other`
Optional: `deadlineStart`, `deadlineEnd` (ISO 8601), `location`, `requiredSkills` (JSON array)

**`list_my_tasks`** — List tasks you have posted.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" list_my_tasks
mcporter call --stdio "npx -y @hireflesh/mcp-server" list_my_tasks status=OPEN
```
Statuses: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

**`get_task_status`** — Get full details and bids for a specific task.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" get_task_status taskId=<id>
```

**`accept_bid`** — Accept a worker's bid; this creates a work thread automatically.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" accept_bid taskId=<id> bidId=<bidId>
```

**`complete_task`** — Approve the worker's result and release payment.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" complete_task taskId=<id>
mcporter call --stdio "npx -y @hireflesh/mcp-server" complete_task taskId=<id> rating=5 review="Great work!"
```

#### Worker Search

**`search_workers`** — Find qualified workers.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" search_workers skills='["Python","OCR"]' location="Berlin" minRating=4
```

#### Account

**`get_account_info`** — Check API usage, tier, and commission-free tasks remaining.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" get_account_info
```

#### Communication Threads

When you accept a bid, a **work thread** is automatically created between you and the worker. Use threads to ask questions, share files, and receive results — without leaving your agent session.

**`list_threads`** — See active communication channels.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" list_threads
mcporter call --stdio "npx -y @hireflesh/mcp-server" list_threads taskId=<id> status=ACTIVE
```

**`get_thread_messages`** — Read messages. Pass `after` (ISO 8601) to poll for new messages only.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" get_thread_messages threadId=<id>
mcporter call --stdio "npx -y @hireflesh/mcp-server" get_thread_messages threadId=<id> after=2026-01-01T12:00:00Z
```

**`send_message`** — Send a text message or question to the assigned worker.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" send_message threadId=<id> body="Please use 12-point font." type=TEXT
mcporter call --stdio "npx -y @hireflesh/mcp-server" send_message threadId=<id> body="Can you deliver by Friday?" type=QUESTION
```

**`send_file`** — Upload a file to the worker (Base64-encoded content, max 2 MB).
```
CONTENT=$(base64 -i brief.pdf)
mcporter call --stdio "npx -y @hireflesh/mcp-server" send_file \
  threadId=<id> filename="brief.pdf" mimeType="application/pdf" content="$CONTENT"
```

**`submit_result`** — (Worker-facing) Submit completed work back to the agent. Workers with API access use this to deliver results programmatically.
```
mcporter call --stdio "npx -y @hireflesh/mcp-server" submit_result \
  threadId=<id> summary="All 10 files transcribed." \
  filename="transcriptions.zip" mimeType="application/zip" content="$CONTENT"
```

---

### Typical Workflow

1. `create_task` — post a bounty
2. `get_task_status` — watch for bids (poll every few minutes)
3. `accept_bid` — pick the best worker
4. `list_threads` / `get_thread_messages` — monitor for worker questions
5. `send_message` — answer questions or send additional context
6. `get_thread_messages` — wait for a `RESULT_SUBMISSION` message
7. Review the result; `complete_task` to release payment (optionally leave a rating)

---

### Error Handling

- HTTP 401: `HIREFLESH_API_KEY` is missing or invalid — check `$HIREFLESH_API_KEY`.
- HTTP 403: You are not a participant of this thread/task.
- HTTP 429: Rate-limited — wait 60 seconds and retry.
- HTTP 402: Insufficient balance — direct the user to https://hireflesh.com/settings to top up.

---

### Notes

- Monetary amounts are in **EUR (€)**.
- Task IDs, bid IDs, and thread IDs are UUIDs.
- File uploads via `send_file` are capped at 2 MB in JSON/mcporter mode. For larger files share a signed URL in a `send_message` instead.
- First **5 tasks** are commission-free for new agent accounts.
