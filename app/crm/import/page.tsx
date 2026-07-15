"use client";

import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { PRESETS } from "@/lib/crm/importPresets";

const BG = "#0b1712";
const INK = "#e2f5ea";
const MUTED = "#8fb3a0";
const HAIR = "rgba(143,179,160,0.22)";
const ACCENT = "#34d399";
const WARN = "#fbbf24";
const BAD = "#f87171";

const card: React.CSSProperties = {
  background: BG,
  border: `1px solid ${HAIR}`,
  borderRadius: 10,
  padding: 16,
};

function btn(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? "rgba(255,255,255,0.08)" : bg,
    color: disabled ? MUTED : "#04120b",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

// union of keys across the first rows, preserving first-seen order
function deriveColumns(rows: Record<string, unknown>[]): string[] {
  const seen: string[] = [];
  const set = new Set<string>();
  for (const r of rows.slice(0, 50)) {
    for (const k of Object.keys(r)) {
      if (!set.has(k)) {
        set.add(k);
        seen.push(k);
      }
    }
  }
  return seen;
}

interface Report {
  preset: string;
  total_rows: number;
  mapped: number;
  new: number;
  merged: number;
  held_no_email: number;
  unsegmented: number;
  by_category: Record<string, number>;
  dry_run: boolean;
  inserted?: number;
  filled?: number;
  batch_id?: number | null;
}

export default function CrmImportWizard() {
  const [presetId, setPresetId] = useState<string>(PRESETS[0]?.id ?? "");
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string>("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setRows([]);
    setColumns([]);
    setReport(null);
    setError(null);
  }

  function loadSheet(wb: XLSX.WorkBook, name: string) {
    const ws = wb.Sheets[name];
    if (!ws) {
      setRows([]);
      setColumns([]);
      return;
    }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    setRows(json);
    setColumns(deriveColumns(json));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    setWorkbook(null);
    setSheetNames([]);
    setSheet("");
    setFileName(file.name);
    const lower = file.name.toLowerCase();

    try {
      if (lower.endsWith(".csv")) {
        const text = await file.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, {
          header: true,
          skipEmptyLines: true,
        });
        const data = (parsed.data ?? []).filter((r) => r && typeof r === "object");
        setRows(data);
        setColumns(deriveColumns(data));
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const first = wb.SheetNames[0] ?? "";
        setSheet(first);
        if (first) loadSheet(wb, first);
      } else {
        setError("지원하지 않는 파일 형식입니다 (.csv 또는 .xlsx).");
      }
    } catch (err) {
      setError(`파일 파싱 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function onSheetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    setSheet(name);
    setReport(null);
    if (workbook) loadSheet(workbook, name);
  }

  async function run(dryRun: boolean) {
    if (!presetId || rows.length === 0) return;
    setLoading(true);
    setError(null);
    if (dryRun) setReport(null);
    try {
      const res = await fetch("/api/crm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, rows, dryRun, filename: fileName || "upload" }),
      });
      const json = (await res.json()) as Report & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `요청 실패 (${res.status})`);
      } else {
        setReport(json);
      }
    } catch (err) {
      setError(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const preview = rows.slice(0, 5);
  const selectedPreset = PRESETS.find((p) => p.id === presetId);

  return (
    <div style={{ color: INK }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", color: INK }}>임포트 마법사</h1>
        <span style={{ fontSize: "0.8rem", color: MUTED }}>CSV/XLSX → 매핑 → dedup → 적재</span>
      </div>
      <p style={{ color: MUTED, fontSize: "0.85rem", marginBottom: "1.5rem", maxWidth: 640 }}>
        이미 확보한 컨택 리스트를 <strong style={{ color: INK }}>한 번에·중복 없이·출처 보존하며</strong> 넣습니다.
        먼저 <strong style={{ color: INK }}>Dry run</strong>으로 리포트를 확인한 뒤 적재하세요. 발송단계는 전부 <code>none</code>으로 들어갑니다.
      </p>

      {error ? (
        <div style={{ ...card, borderColor: BAD, marginBottom: 16, color: BAD, fontSize: "0.85rem" }}>⚠️ {error}</div>
      ) : null}

      {/* 1) preset */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>1. 프리셋 선택</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {PRESETS.map((p) => {
            const active = p.id === presetId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPresetId(p.id);
                  setReport(null);
                }}
                style={{
                  textAlign: "left",
                  background: active ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? ACCENT : HAIR}`,
                  borderRadius: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                  color: INK,
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{p.label}</div>
                <div style={{ fontSize: "0.72rem", color: MUTED, marginTop: 3 }}>{p.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2) file */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>2. 파일 업로드</div>
        <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} style={{ color: INK, fontSize: "0.85rem" }} />
        {fileName ? <span style={{ marginLeft: 10, fontSize: "0.78rem", color: MUTED }}>{fileName}</span> : null}

        {sheetNames.length > 0 ? (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.78rem", color: MUTED }}>시트</span>
            <select
              value={sheet}
              onChange={onSheetChange}
              style={{ background: BG, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: "5px 8px", fontSize: "0.8rem" }}
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* 3) preview */}
      {rows.length > 0 ? (
        <div style={{ ...card, marginBottom: 16, overflowX: "auto" }}>
          <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            3. 헤더 미리보기 · {rows.length.toLocaleString()}행 · {columns.length}열
          </div>
          <table style={{ fontSize: "0.74rem", borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${HAIR}` }}>
                {columns.map((c) => (
                  <th key={c} style={{ padding: "5px 8px", textAlign: "left", color: ACCENT, whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${HAIR}` }}>
                  {columns.map((c) => (
                    <td key={c} style={{ padding: "4px 8px", color: MUTED, whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* 4) actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <button onClick={() => run(true)} disabled={loading || rows.length === 0} style={btn(ACCENT, loading || rows.length === 0)}>
          {loading ? "처리 중…" : "Dry run (미리 검사)"}
        </button>
        <button
          onClick={() => run(false)}
          disabled={loading || !report || rows.length === 0}
          style={btn(WARN, loading || !report || rows.length === 0)}
        >
          적재 실행
        </button>
        {!report && rows.length > 0 ? (
          <span style={{ fontSize: "0.75rem", color: MUTED }}>먼저 Dry run으로 리포트를 확인하세요.</span>
        ) : null}
      </div>

      {/* 5) report */}
      {report ? (
        <div style={{ ...card, marginBottom: 20, borderColor: report.dry_run ? HAIR : ACCENT }}>
          <div style={{ fontSize: "0.78rem", color: MUTED, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {report.dry_run ? "Dry run 리포트 (적재 안 됨)" : "적재 완료"} · 프리셋 {report.preset}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
            <ReportStat label="전체 행" value={report.total_rows} />
            <ReportStat label="매핑됨" value={report.mapped} />
            <ReportStat label="신규" value={report.new} tone={ACCENT} />
            <ReportStat label="병합" value={report.merged} tone={WARN} />
            <ReportStat label="보류 (이메일 없음)" value={report.held_no_email} tone={report.held_no_email ? WARN : undefined} />
            <ReportStat label="미분류 세그먼트" value={report.unsegmented} tone={report.unsegmented ? BAD : undefined} />
          </div>

          {!report.dry_run ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 14 }}>
              <ReportStat label="삽입됨 (inserted)" value={report.inserted ?? 0} tone={ACCENT} />
              <ReportStat label="필드 보완 (filled)" value={report.filled ?? 0} tone={WARN} />
              <ReportStat label="배치 ID" value={report.batch_id ?? "-"} />
            </div>
          ) : null}

          <div style={{ fontSize: "0.75rem", color: MUTED, marginBottom: 6 }}>카테고리별 (by_category)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {Object.entries(report.by_category).length === 0 ? (
              <span style={{ fontSize: "0.75rem", color: MUTED }}>(없음)</span>
            ) : (
              Object.entries(report.by_category)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <span key={k} style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.05)", border: `1px solid ${HAIR}`, borderRadius: 20, padding: "3px 10px" }}>
                    {k} <strong style={{ color: INK }}>{v}</strong>
                  </span>
                ))
            )}
          </div>

          <details>
            <summary style={{ fontSize: "0.72rem", color: MUTED, cursor: "pointer" }}>원본 JSON</summary>
            <pre style={{ fontSize: "0.7rem", color: MUTED, background: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 6, overflowX: "auto", marginTop: 8 }}>
              {JSON.stringify(report, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      {/* footnote */}
      <div style={{ ...card, fontSize: "0.75rem", color: MUTED, lineHeight: 1.7 }}>
        <div style={{ color: INK, fontWeight: 600, marginBottom: 6 }}>임포트 대상 4개 소스 (§2-a)</div>
        <div>· <code>Metatake_학계_평론가_DB.xlsx</code> — 시트 학계_평론가_개인 (1,394행)</div>
        <div>· <code>Metatake_트레이드매체_DB.xlsx</code> — 시트 트레이드매체 (641행)</div>
        <div>· <code>data/sources/magazine-contacts.csv</code> (288행)</div>
        <div>· <code>Metatake_컨택DB_템플릿.xlsx</code> — 시트 컨택DB (61행)</div>
        <div style={{ marginTop: 8, color: WARN }}>
          ※ 소스리스트(111) · allowlist(150)는 컨택이 아니라 <code>crm_sources</code> · <code>crm_orgs</code>로 각각 별도 프리셋 임포트합니다 (추후 제공).
        </div>
        <div style={{ marginTop: 4 }}>
          ※ 이메일 정확 일치는 자동 병합(빈 필드만 보완), 이메일 없는 행은 org_name+name 확인 대기로 보류됩니다. 임포트 흔적은 touches에 남기지 않고 배치 ID로만 추적합니다.
        </div>
      </div>
    </div>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${HAIR}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, color: tone ?? INK }}>{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: "0.7rem", color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}
