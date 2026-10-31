// Uses a DEMO fixture (fictional sources) generated from the backend's labelled demo scenario.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ResearchProvider, useResearch } from "../context/ResearchContext";
import { LangProvider, useLang } from "../context/LangContext";
import { ThemeProvider } from "../context/ThemeContext";
import App from "../App";
import { DashboardPage } from "../pages/DashboardPage";
import { LandingPage } from "../pages/LandingPage";
import { ResearchProgress, stageStates } from "../features/research/ResearchProgress";
import { EvidencePanel, claimToEvidenceItem } from "../features/evidence/EvidencePanel";
import { GapAskDraft, ConflictAskDraft } from "../components/AskOfficialDraft";
import { parseSseChunk } from "../services/api";
import type { HealthInfo, ProgressEvent, ResearchResponse } from "../types/research";
import demo from "./fixtures/demo-scholarship.json";

const DEMO = demo as unknown as ResearchResponse;
const HEALTH: HealthInfo = {
  status: "ok", llm: { provider: "xai-grok", configured: false, model: null }, search: { provider: "none", configured: false },
  mode: "heuristic", limits: { max_sources: 10, max_pdf_size_mb: 15, max_pdf_files: 5 },
};

function ev(stage: string, status: ProgressEvent["status"], message = ""): ProgressEvent {
  return { stage, label: stage, status, message, detail: {} };
}

type Runner = NonNullable<Parameters<typeof ResearchProvider>[0]["runner"]>;

function Harness({ health = HEALTH }: { health?: HealthInfo }) {
  const { phase } = useResearch();
  if (phase === "idle") return <LandingPage health={health} healthError={null} />;
  if (phase === "done") return <DashboardPage />;
  return <ResearchProgress />;
}

function renderWith(runner: Runner) {
  return render(
    <ThemeProvider>
      <LangProvider>
        <ResearchProvider runner={runner}>
          <Harness />
        </ResearchProvider>
      </LangProvider>
    </ThemeProvider>
  );
}

beforeAll(() => {
  // React Flow needs ResizeObserver in jsdom
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

describe("SSE parsing", () => {
  it("splits complete events and keeps the remainder", () => {
    const { events, rest } = parseSseChunk('event: progress\ndata: {"a":1}\n\n: keep-alive\n\nevent: result\ndata: {"b"');
    expect(events).toEqual([{ event: "progress", data: '{"a":1}' }]);
    expect(rest).toBe('event: result\ndata: {"b"');
  });
});

describe("progress", () => {
  it("derives stage state only from backend events", () => {
    const s = stageStates([ev("planning", "started"), ev("planning", "completed", "10 fields"), ev("claims", "failed", "boom")]);
    expect(s.planning).toEqual({ state: "completed", message: "10 fields" });
    expect(s.claims.state).toBe("failed");
    expect(s.report.state).toBe("pending");
  });
});

describe("research flow", () => {
  it("validates that some input is provided", () => {
    renderWith(vi.fn());
    fireEvent.change(screen.getByPlaceholderText(/Post-Matric/i), { target: { value: "Some scholarship" } });
    fireEvent.click(screen.getByRole("button", { name: /Start Research/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Add at least one URL or PDF/);
  });

  it("rejects invalid URLs", () => {
    renderWith(vi.fn());
    fireEvent.change(screen.getByLabelText("Source URL"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByLabelText("Add URL"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Not a valid http\(s\) URL/);
  });

  it("shows real progress, then the dashboard with actual results", async () => {
    let finish!: (r: ResearchResponse) => void;
    const runner: Runner = vi.fn((_input, _files, { onProgress }) => {
      onProgress(ev("planning", "completed", "10 expected information fields"));
      onProgress(ev("collecting", "started"));
      return new Promise<ResearchResponse>((res) => { finish = res; });
    });
    renderWith(runner);
    fireEvent.click(screen.getByRole("button", { name: /Demo A/i }));
    expect(await screen.findByText("10 expected information fields")).toBeInTheDocument();
    expect(screen.getByTestId("stage-collecting")).toHaveAttribute("data-state", "started");
    expect(screen.getByTestId("stage-report")).toHaveAttribute("data-state", "pending");
    expect((runner as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ demo_scenario: "scholarship", automatic_search: false });

    await act(async () => finish(DEMO));
    expect(await screen.findByText(DEMO.topic)).toBeInTheDocument();
    expect(screen.getByTestId("completeness-score")).toHaveTextContent(String(DEMO.research_completeness.score));
    expect(screen.getByText(/DEMO: analysing clearly labelled fictional fixture sources/)).toBeInTheDocument();
  });

  it("shows the actual failure message", async () => {
    renderWith(vi.fn().mockRejectedValue(new Error("Grok rate limit reached (HTTP 429)")));
    fireEvent.click(screen.getByRole("button", { name: /Demo B/i }));
    expect(await screen.findByText(/Research could not be completed/)).toBeInTheDocument();
    expect(screen.getByText(/Grok rate limit reached/)).toBeInTheDocument();
  });
});

describe("dashboard", () => {
  async function openDashboard() {
    renderWith(vi.fn().mockResolvedValue(DEMO));
    fireEvent.click(screen.getByRole("button", { name: /Demo A/i }));
    await screen.findByText(DEMO.topic);
  }

  it("renders conflicts with both quotations", async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole("button", { name: /^Conflicts/ }));
    const k = DEMO.conflicts[0];
    expect(screen.getByText(k.explanation)).toBeInTheDocument();
    expect(screen.getAllByText(`"${k.quotation_a}"`).length).toBeGreaterThan(0);
  });

  it("coverage matrix rows open their evidence", async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole("button", { name: /Coverage Matrix/ }));
    const row = screen.getByTestId("coverage-row-renewal_requirements");
    fireEvent.click(row);
    const gap = DEMO.information_gaps.find((g) => g.expected_field === "renewal_requirements")!;
    expect(screen.getByText(gap.explanation)).toBeInTheDocument();
  });

  it("checklist completion is tracked in session state only", async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole("button", { name: /Verification Checklist/ }));
    const total = DEMO.verification_checklist.length;
    expect(screen.getByTestId("checklist-progress")).toHaveTextContent(`0 / ${total} done`);
    fireEvent.click(screen.getByLabelText("Mark T1 done"));
    expect(screen.getByTestId("checklist-progress")).toHaveTextContent(`1 / ${total} done`);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("evidence breakdown shows the five components", async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole("button", { name: /Evidence Confidence/ }));
    const panel = screen.getByTestId("evidence-breakdown");
    for (const name of ["authority", "relevance", "freshness", "directness", "corroboration"])
      expect(within(panel).getByText(name)).toBeInTheDocument();
  });

  it("claim graph renders", async () => {
    await openDashboard();
    fireEvent.click(screen.getByRole("button", { name: /Claim Graph/ }));
    expect(screen.getByTestId("claim-graph")).toBeInTheDocument();
  });
});

describe("temporary browser state", () => {
  it("a refresh (fresh mount) starts empty — nothing is persisted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const first = render(<App />);
    expect(await screen.findByText(/New research/)).toBeInTheDocument();
    first.unmount();
    render(<App />);
    await waitFor(() => expect(screen.getByText(/New research/)).toBeInTheDocument());
    expect(screen.queryByText(DEMO.topic)).not.toBeInTheDocument();
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
    vi.unstubAllGlobals();
  });
});

/* ── New Feature Tests ─────────────────────────────────────────────────── */

describe("EvidencePanel", () => {
  const source = DEMO.sources[0];
  const claim = DEMO.claims[0];
  const item = claimToEvidenceItem(claim, source);

  it("renders source text with verbatim quote and metadata", () => {
    const onClose = vi.fn();
    render(
      <LangProvider>
        <EvidencePanel item={item} onClose={onClose} />
      </LangProvider>
    );

    expect(screen.getByText(source.title)).toBeInTheDocument();
    expect(screen.getByText(/Verbatim quote/i)).toBeInTheDocument();
    expect(screen.getByText(`"${claim.supporting_quote}"`)).toBeInTheDocument();
    if (source.publication_date) {
      expect(screen.getByText(new RegExp(source.publication_date))).toBeInTheDocument();
    }
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <LangProvider>
        <EvidencePanel item={item} onClose={onClose} />
      </LangProvider>
    );

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("LangContext toggle", () => {
  function LangConsumer() {
    const { lang, toggle, t } = useLang();
    return (
      <div>
        <span data-testid="current-lang">{lang}</span>
        <button onClick={toggle}>Toggle Lang</button>
        <span data-testid="app-tagline">{t.appTagline}</span>
        <span data-testid="checklist-label">{t.checklistNav}</span>
      </div>
    );
  }

  it("switches language between English and Hindi and updates labels", () => {
    render(
      <LangProvider>
        <LangConsumer />
      </LangProvider>
    );

    expect(screen.getByTestId("current-lang")).toHaveTextContent("en");
    expect(screen.getByTestId("app-tagline")).toHaveTextContent("Scout: find what's missing before you decide.");
    expect(screen.getByTestId("checklist-label")).toHaveTextContent("Verification Checklist");

    // Toggle to Hindi
    fireEvent.click(screen.getByText("Toggle Lang"));
    expect(screen.getByTestId("current-lang")).toHaveTextContent("hi");
    expect(screen.getByTestId("checklist-label")).toHaveTextContent("सत्यापन चेकलिस्ट");

    // Toggle back to English
    fireEvent.click(screen.getByText("Toggle Lang"));
    expect(screen.getByTestId("current-lang")).toHaveTextContent("en");
  });
});

describe("AskOfficialDraft", () => {
  const criticalGap = DEMO.information_gaps.find((g) => g.priority === "critical" || g.priority === "high") || DEMO.information_gaps[0];
  const conflict = DEMO.conflicts[0];

  it("renders draft question with 'AI-suggested, verify' label and copy button for gaps", () => {
    render(
      <LangProvider>
        <GapAskDraft gap={criticalGap} topic={DEMO.topic} />
      </LangProvider>
    );

    expect(screen.getByText("Ask the official source")).toBeInTheDocument();
    expect(screen.getByText("AI-suggested, verify")).toBeInTheDocument();

    // Expand draft
    fireEvent.click(screen.getByText("Ask the official source"));
    expect(screen.getByTestId("gap-draft-text")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy/i })).toBeInTheDocument();
  });

  it("renders conflict draft with verbatim quotations preserved in draft text", () => {
    render(
      <LangProvider>
        <ConflictAskDraft conflict={conflict} topic={DEMO.topic} />
      </LangProvider>
    );

    expect(screen.getByText("Ask the official source")).toBeInTheDocument();
    expect(screen.getByText("AI-suggested, verify")).toBeInTheDocument();

    // Expand draft
    fireEvent.click(screen.getByText("Ask the official source"));
    const draftText = screen.getByTestId("conflict-draft-text");
    expect(draftText).toHaveTextContent(conflict.quotation_a);
    expect(draftText).toHaveTextContent(conflict.quotation_b);
  });
});
