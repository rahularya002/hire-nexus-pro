import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { bulkOnboardClients, type BulkClientResult } from "@/lib/clients.functions";

type ParsedRow = {
  name: string;
  industry?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  pan_number?: string;
  gst_number?: string;
  registered_address?: string;
  notes?: string;
  login_email?: string;
  login_password?: string;
  full_name?: string;
  _error?: string;
};

const TEMPLATE_COLUMNS = [
  "name",
  "industry",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website",
  "pan_number",
  "gst_number",
  "registered_address",
  "notes",
  "login_email",
  "login_password",
  "full_name",
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_COLUMNS,
    [
      "Tata Digital",
      "Technology",
      "Priya Sharma",
      "priya@tatadigital.com",
      "+91 98765 43210",
      "https://tatadigital.com",
      "ABCDE1234F",
      "22ABCDE1234F1Z5",
      "1 Mount Rd, Chennai, TN 600002",
      "Existing account, migrated from spreadsheet",
      "",
      "",
      "Priya Sharma",
    ],
  ]);
  const info = XLSX.utils.aoa_to_sheet([
    ["Field", "Required", "Notes"],
    ["name", "Yes", "Company / client name"],
    ["contact_email", "Yes*", "Used as login_email when login_email is blank"],
    ["login_email", "No", "Falls back to contact_email"],
    ["login_password", "No", "Auto-generated (12 chars) if blank; min 8 chars if provided"],
    ["industry", "No", ""],
    ["contact_name / full_name", "No", "Used on the client's profile"],
    ["pan_number / gst_number", "No", "Optional tax IDs"],
    ["registered_address / website / notes", "No", ""],
    ["", "", ""],
    ["Limit", "", "Max 200 rows per upload"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.utils.book_append_sheet(wb, info, "Instructions");
  XLSX.writeFile(wb, "clients-template.xlsx");
}

function validEmail(s?: string) {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function BulkImportClientsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const bulkFn = useServerFn(bulkOnboardClients);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkClientResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { valid, invalid } = useMemo(() => {
    const seen = new Set<string>();
    const list = rows.map((r) => {
      const login = (r.login_email || r.contact_email || "").trim().toLowerCase();
      const errors: string[] = [];
      if (!r.name?.trim()) errors.push("missing name");
      if (!login) errors.push("missing email");
      else if (!validEmail(login)) errors.push("invalid email");
      else if (seen.has(login)) errors.push("duplicate email in sheet");
      else seen.add(login);
      return { ...r, _error: errors.length ? errors.join(", ") : undefined };
    });
    return {
      valid: list.filter((r) => !r._error),
      invalid: list.filter((r) => r._error),
    };
  }, [rows]);

  async function handleFile(f: File) {
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: ParsedRow[] = json
        .map((r) => {
          const out: ParsedRow = { name: String(r["name"] ?? "").trim() };
          for (const key of TEMPLATE_COLUMNS) {
            const v = r[key];
            if (v === undefined || v === null || v === "") continue;
            (out as any)[key] = String(v).trim();
          }
          return out;
        })
        .filter((r) => r.name || r.contact_email || r.login_email);
      if (parsed.length === 0) {
        toast.error("No rows found in the first sheet.");
        return;
      }
      if (parsed.length > 200) {
        toast.error("Max 200 rows per upload.");
        return;
      }
      setRows(parsed);
      setFileName(f.name);
      setResults(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to parse file.");
    }
  }

  async function runImport() {
    if (valid.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = valid.map((r) => ({
        name: r.name.trim(),
        industry: r.industry || undefined,
        contact_name: r.contact_name || undefined,
        contact_email: r.contact_email || r.login_email || undefined,
        contact_phone: r.contact_phone || undefined,
        website: r.website || undefined,
        pan_number: r.pan_number || undefined,
        gst_number: r.gst_number || undefined,
        registered_address: r.registered_address || undefined,
        notes: r.notes || undefined,
        login_email: (r.login_email || r.contact_email || "").trim(),
        login_password: r.login_password || undefined,
        full_name: r.full_name || r.contact_name || undefined,
      }));
      const res = await bulkFn({ data: { rows: payload as any } });
      setResults(res.results);
      const ok = res.results.filter((r) => r.status === "ok").length;
      const err = res.results.length - ok;
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Imported ${ok} client${ok === 1 ? "" : "s"}${err ? ` · ${err} failed` : ""}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadCredentials() {
    if (!results) return;
    const portalUrl =
      typeof window !== "undefined" ? `${window.location.origin}/client/login` : "/client/login";
    const aoa = [
      ["Client", "Contact name", "Login email", "Password", "Portal URL", "Status", "Error"],
      ...results.map((r) => [
        r.client_name,
        "",
        r.login_email ?? "",
        r.login_password ?? "",
        portalUrl,
        r.status,
        r.error ?? "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credentials");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    XLSX.writeFile(wb, `client-credentials-${stamp}.xlsx`);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/10 grid place-items-center text-primary">
            <FileSpreadsheet className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Bulk import clients</div>
            <div className="text-xs text-muted-foreground">
              Upload an Excel sheet — we'll create client accounts and return login credentials to share.
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary/60"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {!results && (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm inline-flex items-center gap-1.5 hover:bg-secondary/60"
                >
                  <Download className="size-4" /> Download template
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5"
                >
                  <Upload className="size-4" /> {fileName ? "Replace file" : "Choose Excel file"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                {fileName && (
                  <div className="text-xs text-muted-foreground self-center">
                    {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              {rows.length > 0 && (
                <>
                  <div className="flex gap-4 text-xs">
                    <div className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="size-3.5" /> {valid.length} valid
                    </div>
                    {invalid.length > 0 && (
                      <div className="inline-flex items-center gap-1 text-destructive">
                        <AlertCircle className="size-3.5" /> {invalid.length} skipped
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-secondary/40 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">#</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-left p-2 font-medium">Login email</th>
                            <th className="text-left p-2 font-medium">Password</th>
                            <th className="text-left p-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...valid, ...invalid].map((r, i) => {
                            const login = r.login_email || r.contact_email || "";
                            return (
                              <tr key={i} className="border-t border-border">
                                <td className="p-2 text-muted-foreground">{i + 1}</td>
                                <td className="p-2">{r.name || <span className="text-destructive">—</span>}</td>
                                <td className="p-2">{login || <span className="text-destructive">—</span>}</td>
                                <td className="p-2 text-muted-foreground font-mono">
                                  {r.login_password ? "provided" : "auto"}
                                </td>
                                <td className="p-2">
                                  {r._error ? (
                                    <span className="text-destructive">{r._error}</span>
                                  ) : (
                                    <span className="text-success">ready</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {results && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Client</th>
                        <th className="text-left p-2 font-medium">Login email</th>
                        <th className="text-left p-2 font-medium">Password</th>
                        <th className="text-left p-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.row} className="border-t border-border">
                          <td className="p-2 text-muted-foreground">{r.row}</td>
                          <td className="p-2">{r.client_name}</td>
                          <td className="p-2">{r.login_email ?? "—"}</td>
                          <td className="p-2 font-mono">{r.login_password ?? "—"}</td>
                          <td className="p-2">
                            {r.status === "ok" ? (
                              <span className="text-success inline-flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" /> created
                              </span>
                            ) : (
                              <span className="text-destructive">{r.error ?? "failed"}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-warning-foreground/90 flex gap-2">
                <AlertCircle className="size-4 mt-0.5 shrink-0 text-warning" />
                <span>
                  Passwords are shown once. Download the credentials sheet now and share it with each
                  client — we can't retrieve them later.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-3 py-2"
          >
            {results ? "Close" : "Cancel"}
          </button>
          {!results ? (
            <button
              type="button"
              disabled={submitting || valid.length === 0}
              onClick={runImport}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Import {valid.length} client{valid.length === 1 ? "" : "s"}
            </button>
          ) : (
            <button
              type="button"
              onClick={downloadCredentials}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"
            >
              <Download className="size-4" /> Download credentials
            </button>
          )}
        </div>
      </div>
    </div>
  );
}