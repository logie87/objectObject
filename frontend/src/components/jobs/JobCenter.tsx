import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiPost } from "../../lib/api";

export type AlignPayload = {
  students: string[];
  courses: string[];
  units: string[];
};

export type AlignResultMeta = {
  jobId: string;
  startedAt: number;   // epoch ms
  finishedAt?: number; // epoch ms
  summary?: {
    studentCount: number;
    worksheetCount: number;
    avgPerStudent?: Record<string, number>;
    avgPerWorksheet?: Record<string, number>;
    overall?: number;
  };
};

export type AlignResult = {
  meta: any;
  matrix: any;
  details: any;
  row_averages: number[];
  column_averages: number[];
};

type Status = "idle" | "running" | "done" | "error";

type JobState = {
  status: Status;
  jobId: string | null;
  payload: AlignPayload | null;
  meta: AlignResultMeta | null;
  result: AlignResult | null;
  error?: string | null;
};

type Ctx = {
  job: JobState;
  start: (p: AlignPayload) => void;
  open: () => void;
  close: () => void;
  reopenFromSidebar: () => void;
  clear: () => void;
  isModalOpen: boolean;
};

const STORAGE_KEY = "job:iepAlign:v1";

const JobCenterContext = createContext<Ctx | null>(null);

export function useJobCenter(): Ctx {
  const ctx = useContext(JobCenterContext);
  if (!ctx) throw new Error("JobCenterProvider missing");
  return ctx;
}

// tiny pub/sub for toast without prop drilling
const listeners = new Set<(msg: { title: string; action?: () => void }) => void>();
export function toast(msg: { title: string; action?: () => void }) {
  listeners.forEach(l => l(msg));
}
export function subscribeToast(fn: (msg: { title: string; action?: () => void }) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const JobCenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [job, setJob] = useState<JobState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { status: "idle", jobId: null, payload: null, meta: null, result: null };
    } catch {
      return { status: "idle", jobId: null, payload: null, meta: null, result: null };
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inflight = useRef<AbortController | null>(null);

  // persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
  }, [job]);

  // if reloaded with "running", degrade gracefully: mark as idle-but-reopenable
  useEffect(() => {
    if (job.status === "running" && !inflight.current) {
      // We don't actually know if a request was mid-flight; keep it "running"
      // but allow user to reopen; if they re-run, we’ll start fresh.
      // No auto-retry here to avoid double work.
    }
  }, [job.status]);

  const open = useCallback(() => setIsModalOpen(true), []);
  const close = useCallback(() => setIsModalOpen(false), []);

  const clear = useCallback(() => {
    if (inflight.current) inflight.current.abort();
    inflight.current = null;
    setJob({ status: "idle", jobId: null, payload: null, meta: null, result: null });
  }, []);

  const runAlignment = useCallback(async (p: AlignPayload, jobId: string, signal: AbortSignal) => {
    const payload = { student_ids: p.students, courses: p.courses, units: p.units };
    const startedAt = Date.now();

    let result: AlignResult | null = null;
    try {
      // NOTE: backend is synchronous; this returns the full alignment object
      result = await apiPost<AlignResult>("/align/iep-selected", payload, { signal });

      // compute summary
      const avgPerWorksheet: Record<string, number> = {};
      const avgPerStudent: Record<string, number> = {};
      const students = (result.matrix?.students ?? []) as string[];
      const worksheets = (result.matrix?.worksheets ?? []) as string[];
      const rowAvgs = (result.row_averages ?? []) as number[];
      const colAvgs = (result.column_averages ?? []) as number[];

      worksheets.forEach((w, i) => { avgPerWorksheet[w] = rowAvgs[i] ?? NaN; });
      students.forEach((s, j) => { avgPerStudent[s] = colAvgs[j] ?? NaN; });

      const overall = (() => {
        const vals = [...rowAvgs, ...colAvgs].filter(x => typeof x === "number" && !Number.isNaN(x));
        if (!vals.length) return undefined;
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round((sum / vals.length) * 10) / 10;
      })();

      const meta: AlignResultMeta = {
        jobId,
        startedAt,
        finishedAt: Date.now(),
        summary: {
          studentCount: students.length,
          worksheetCount: worksheets.length,
          avgPerStudent,
          avgPerWorksheet,
          overall
        }
      };

      setJob({ status: "done", jobId, payload: p, meta, result, error: null });

      toast({
        title: "Alignment ready — open",
        action: () => setIsModalOpen(true),
      });
    } catch (e: any) {
      if (signal.aborted) return; // user aborted/cleared
      setJob(prev => ({ ...prev, status: "error", error: String(e?.message || e) }));
      toast({ title: "Alignment failed — click to retry", action: () => setIsModalOpen(true) });
    } finally {
      inflight.current = null;
    }
  }, []);

  const start = useCallback((p: AlignPayload) => {
    if (inflight.current) inflight.current.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    const jobId = `${Date.now()}`;
    setJob({ status: "running", jobId, payload: p, meta: { jobId, startedAt: Date.now() }, result: null, error: null });
    setIsModalOpen(true);
    void runAlignment(p, jobId, ctrl.signal);
  }, [runAlignment]);

  const reopenFromSidebar = useCallback(() => setIsModalOpen(true), []);

  const ctx: Ctx = useMemo(() => ({
    job, start, open, close, clear, isModalOpen, reopenFromSidebar
  }), [job, start, open, close, clear, isModalOpen, reopenFromSidebar]);

  return (
    <JobCenterContext.Provider value={ctx}>
      {children}
    </JobCenterContext.Provider>
  );
};
