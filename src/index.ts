/**
 * HireFlesh OpenClaw Plugin
 *
 * Registers HireFlesh marketplace tools directly into the OpenClaw agent.
 * Reads HIREFLESH_API_KEY from process.env (set via openclaw.json skills.entries.hireflesh.env).
 */

// Type-only import from the openclaw plugin SDK (peerDep, resolved at runtime)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — openclaw is provided at runtime by the host
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.HIREFLESH_BASE_URL ?? "https://hireflesh.com";

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const key = process.env.HIREFLESH_API_KEY;
  if (!key) {
    throw new Error(
      "HIREFLESH_API_KEY is not set. " +
      "Add it to your openclaw.json skills.entries.hireflesh.env, " +
      "or ask your agent to run get_pairing_code / check_pairing_status.",
    );
  }
  const url = `${BASE_URL}/api/v1${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HireFlesh API ${res.status}: ${body}`);
  }
  return res.json() as unknown;
}

async function publicRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HireFlesh API ${res.status}: ${body}`);
  }
  return res.json() as unknown;
}

// ---------------------------------------------------------------------------
// Tool result helpers
// ---------------------------------------------------------------------------

function text(content: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(content, null, 2) }],
    details: content,
  };
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}` }],
    details: { error: msg },
  };
}

// ---------------------------------------------------------------------------
// Inline schema builders — return plain JSON Schema objects compatible with
// OpenClaw's TypeBox-based tool registration (cast to any at the call site).
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Schema = any;

function T_String(opts?: Record<string, unknown>): Schema {
  return { type: "string", ...opts };
}
function T_Number(opts?: Record<string, unknown>): Schema {
  return { type: "number", ...opts };
}
function T_Optional(schema: Schema): Schema {
  return schema; // optionality is declared via the required array in T_Object
}
function T_Object(props: Record<string, Schema>, required?: string[]): Schema {
  return {
    type: "object",
    properties: props,
    ...(required && required.length ? { required } : {}),
  };
}
function T_Enum(values: string[], opts?: Record<string, unknown>): Schema {
  return { type: "string", enum: values, ...opts };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

type P = Record<string, unknown>;

const tools = [
  // -------------------------------------------------------------------------
  {
    name: "hireflesh_create_task",
    label: "HireFlesh: Create Task",
    description:
      "Post a new bounty task to the HireFlesh marketplace for human workers to bid on. " +
      "Titles must NOT start with prefixes like 'Task:', 'Job:', 'Task 1:' — use a specific action phrase. " +
      "Budget is in EUR.",
    parameters: T_Object(
      {
        title: T_String({ description: "Task title (max 200 chars). Use a specific action phrase." }),
        description: T_String({ description: "Detailed description of what the worker must do and deliver." }),
        category: T_Enum(
          ["Data Collection", "Content Creation", "Research", "Testing", "Verification", "Photography", "Delivery", "Other"],
          { description: "Task category" },
        ),
        minBudget: T_Number({ description: "Minimum budget in EUR" }),
        maxBudget: T_Number({ description: "Maximum budget in EUR" }),
        maxWorkers: T_Optional(T_Number({ description: "Max workers to hire (default 1)" })),
        deadlineStart: T_Optional(T_String({ description: "ISO 8601 datetime — when bidding closes / work starts" })),
        deadlineEnd: T_Optional(T_String({ description: "ISO 8601 datetime — task completion deadline" })),
        location: T_Optional(T_String({ description: "Physical location (for in-person tasks)" })),
        requiredSkills: T_Optional(T_String({ description: "JSON array of skill strings, e.g. [\"Python\",\"OCR\"]" })),
      },
      ["title", "description", "category", "minBudget", "maxBudget"],
    ),
    async execute(_id: string, params: P) {
      try {
        const body: Record<string, unknown> = {
          title: params.title,
          description: params.description,
          category: params.category,
          minBudget: params.minBudget,
          maxBudget: params.maxBudget,
        };
        if (params.maxWorkers !== undefined) body.maxWorkers = params.maxWorkers;
        if (params.deadlineStart)           body.deadlineStart = params.deadlineStart;
        if (params.deadlineEnd)             body.deadlineEnd = params.deadlineEnd;
        if (params.location)                body.location = params.location;
        if (params.requiredSkills) {
          try { body.requiredSkills = JSON.parse(params.requiredSkills as string); } catch { /**/ }
        }
        const result = await apiRequest("/tasks", {
          method: "POST",
          body: JSON.stringify(body),
        });
        return text(result);
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_list_my_tasks",
    label: "HireFlesh: List My Tasks",
    description: "List tasks you have posted on HireFlesh. Optionally filter by status.",
    parameters: T_Object({
      status: T_Optional(T_Enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"], { description: "Filter by task status" })),
    }),
    async execute(_id: string, params: P) {
      try {
        const qs = params.status ? `?status=${encodeURIComponent(params.status as string)}` : "";
        return text(await apiRequest(`/tasks${qs}`));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_get_task_status",
    label: "HireFlesh: Get Task Status",
    description: "Get full details and bids for a specific HireFlesh task.",
    parameters: T_Object(
      { taskId: T_String({ description: "The task ID" }) },
      ["taskId"],
    ),
    async execute(_id: string, params: P) {
      try {
        return text(await apiRequest(`/tasks/${params.taskId}`));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_accept_bid",
    label: "HireFlesh: Accept Bid",
    description: "Accept a worker's bid on a task. This creates a work thread automatically.",
    parameters: T_Object(
      {
        taskId: T_String({ description: "The task ID" }),
        bidId: T_String({ description: "The bid ID to accept" }),
      },
      ["taskId", "bidId"],
    ),
    async execute(_id: string, params: P) {
      try {
        return text(await apiRequest(`/tasks/${params.taskId}/bids/${params.bidId}/accept`, { method: "POST" }));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_complete_task",
    label: "HireFlesh: Complete Task",
    description: "Approve the worker's result and release payment. Optionally leave a rating and review.",
    parameters: T_Object(
      {
        taskId: T_String({ description: "The task ID" }),
        rating: T_Optional(T_Number({ description: "Rating from 1 to 5", minimum: 1, maximum: 5 })),
        review: T_Optional(T_String({ description: "Written review (1-2 sentences)" })),
      },
      ["taskId"],
    ),
    async execute(_id: string, params: P) {
      try {
        const body: Record<string, unknown> = {};
        if (params.rating !== undefined) body.rating = params.rating;
        if (params.review)               body.review = params.review;
        return text(await apiRequest(`/tasks/${params.taskId}/complete`, {
          method: "POST",
          body: JSON.stringify(body),
        }));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_search_workers",
    label: "HireFlesh: Search Workers",
    description: "Find qualified human workers on HireFlesh by skills, location, or minimum rating.",
    parameters: T_Object({
      skills: T_Optional(T_String({ description: "JSON array of required skills, e.g. [\"Python\",\"OCR\"]" })),
      location: T_Optional(T_String({ description: "Location filter (city or region)" })),
      minRating: T_Optional(T_Number({ description: "Minimum worker rating (0-5)", minimum: 0, maximum: 5 })),
    }),
    async execute(_id: string, params: P) {
      try {
        const q: string[] = [];
        if (params.skills) {
          try {
            const arr = JSON.parse(params.skills as string) as string[];
            arr.forEach((s) => q.push(`skills[]=${encodeURIComponent(s)}`));
          } catch { /**/ }
        }
        if (params.location)  q.push(`location=${encodeURIComponent(params.location as string)}`);
        if (params.minRating !== undefined) q.push(`minRating=${params.minRating}`);
        return text(await apiRequest(`/workers/search${q.length ? "?" + q.join("&") : ""}`));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_get_account_info",
    label: "HireFlesh: Get Account Info",
    description: "Check your HireFlesh API usage, tier, and remaining commission-free tasks.",
    parameters: T_Object({}),
    async execute(_id: string, _params: P) {
      try {
        return text(await apiRequest("/account"));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_list_threads",
    label: "HireFlesh: List Threads",
    description: "List your active work communication threads with assigned workers.",
    parameters: T_Object({
      taskId: T_Optional(T_String({ description: "Filter by task ID" })),
      status: T_Optional(T_Enum(["ACTIVE", "COMPLETED", "ARCHIVED"], { description: "Filter by thread status" })),
    }),
    async execute(_id: string, params: P) {
      try {
        const q: string[] = [];
        if (params.taskId) q.push(`taskId=${encodeURIComponent(params.taskId as string)}`);
        if (params.status) q.push(`status=${encodeURIComponent(params.status as string)}`);
        return text(await apiRequest(`/threads${q.length ? "?" + q.join("&") : ""}`));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_get_thread_messages",
    label: "HireFlesh: Get Thread Messages",
    description: "Read messages from a work thread. Pass 'after' (ISO 8601) to poll for new messages only.",
    parameters: T_Object(
      {
        threadId: T_String({ description: "The thread ID" }),
        after: T_Optional(T_String({ description: "ISO 8601 timestamp — only return messages after this time" })),
        limit: T_Optional(T_Number({ description: "Max messages to return (default 50, max 100)" })),
      },
      ["threadId"],
    ),
    async execute(_id: string, params: P) {
      try {
        const q: string[] = [];
        if (params.after) q.push(`after=${encodeURIComponent(params.after as string)}`);
        if (params.limit) q.push(`limit=${params.limit}`);
        return text(await apiRequest(`/threads/${params.threadId}/messages${q.length ? "?" + q.join("&") : ""}`));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_send_thread_message",
    label: "HireFlesh: Send Thread Message",
    description: "Send a message to a worker via a work thread. Use polite, direct language.",
    parameters: T_Object(
      {
        threadId: T_String({ description: "The thread ID" }),
        body: T_String({ description: "Message text. Be polite, direct, and clear." }),
      },
      ["threadId", "body"],
    ),
    async execute(_id: string, params: P) {
      try {
        return text(await apiRequest(`/threads/${params.threadId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: params.body }),
        }));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_get_pairing_code",
    label: "HireFlesh: Get Pairing Code",
    description:
      "Generate a short pairing code the operator can enter at hireflesh.com/dashboard to link " +
      "this agent without manual copy-paste of an API key. " +
      "Call check_pairing_status afterwards to retrieve and save the key.",
    parameters: T_Object({}),
    async execute(_id: string, _params: P) {
      try {
        return text(await publicRequest("/api/pairing/request", { method: "POST" }));
      } catch (e) { return err(e); }
    },
  },

  // -------------------------------------------------------------------------
  {
    name: "hireflesh_check_pairing_status",
    label: "HireFlesh: Check Pairing Status",
    description:
      "Check whether the operator has approved the pairing code. " +
      "If approved, returns the API key and saves it to process.env.HIREFLESH_API_KEY for this session.",
    parameters: T_Object(
      { pairingId: T_String({ description: "The pairing ID returned by get_pairing_code" }) },
      ["pairingId"],
    ),
    async execute(_id: string, params: P) {
      try {
        const result = await publicRequest(`/api/pairing/status/${params.pairingId}`) as Record<string, unknown>;
        if (result && typeof result === "object" && result.apiKey) {
          process.env.HIREFLESH_API_KEY = result.apiKey as string;
        }
        return text(result);
      } catch (e) { return err(e); }
    },
  },
];

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default function register(api: OpenClawPluginApi) {
  for (const tool of tools) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.registerTool(tool as any, { optional: true });
  }
}
