import type { HealthInfo, ProgressEvent, ResearchInput, ResearchResponse } from "../types/research";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = `Request failed (HTTP ${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail))
      message = body.detail.map((d: { loc?: string[]; msg: string }) => `${d.loc?.slice(-1)[0] ?? ""}: ${d.msg}`).join("; ");
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status);
}

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

function buildForm(input: ResearchInput, files: File[]): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(input));
  files.forEach((f) => form.append("files", f, f.name));
  return form;
}

export interface StreamHandlers {
  onProgress: (event: ProgressEvent) => void;
  signal?: AbortSignal;
}

/** Parse a text/event-stream body into (event, data) pairs. Exported for tests. */
export function parseSseChunk(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

/** Run research over SSE: real backend stage updates followed by the final structured result. */
export async function runResearchStream(
  input: ResearchInput,
  files: File[],
  { onProgress, signal }: StreamHandlers,
): Promise<ResearchResponse> {
  const res = await fetch(`${API_BASE}/api/research/stream`, { method: "POST", body: buildForm(input, files), signal });
  if (!res.ok) throw await errorFrom(res);
  if (!res.body) throw new ApiError("Streaming is not supported by this browser");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseChunk(buffer);
    buffer = rest;
    for (const { event, data } of events) {
      if (event === "progress") onProgress(JSON.parse(data));
      else if (event === "result") return JSON.parse(data) as ResearchResponse;
      else if (event === "error") throw new ApiError(JSON.parse(data).message ?? "Research failed");
    }
  }
  throw new ApiError("The connection closed before the research finished. Please try again.");
}

async function download(path: string, report: ResearchResponse, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!res.ok) throw await errorFrom(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const exportPdf = (r: ResearchResponse) => download("/api/export/pdf", r, `scout-${r.research_id}.pdf`);
export const exportJson = (r: ResearchResponse) => download("/api/export/json", r, `scout-${r.research_id}.json`);
