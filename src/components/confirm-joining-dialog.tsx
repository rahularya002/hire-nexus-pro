import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { createClientPlacement } from "@/lib/interviews.functions";
import { NumberInput } from "@/components/ui/number-input";

type Props = {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName?: string | null;
  positionTitle?: string | null;
};

export function ConfirmJoiningDialog({ open, onClose, applicationId, candidateName, positionTitle }: Props) {
  const qc = useQueryClient();
  const create = useServerFn(createClientPlacement);
  const today = new Date().toISOString().slice(0, 10);
  const [offerDate, setOfferDate] = useState<string>(today);
  const [joiningDate, setJoiningDate] = useState<string>(today);
  const [ctcDisplay, setCtcDisplay] = useState("");
  const [ctcInr, setCtcInr] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setOfferDate(today);
      setJoiningDate(today);
      setCtcDisplay("");
      setCtcInr("");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          application_id: applicationId,
          offer_date: offerDate || null,
          joining_date: joiningDate,
          ctc_display: ctcDisplay.trim() || null,
          ctc_inr: ctcInr ? Number(ctcInr) : null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-placements"] });
      qc.invalidateQueries({ queryKey: ["client-pending-placements"] });
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["client-interviews"] });
      qc.invalidateQueries({ queryKey: ["staff-interviews"] });
      qc.invalidateQueries({ queryKey: ["client-pipeline"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <div>
              <div className="text-sm font-semibold">Confirm candidate joining</div>
              {(candidateName || positionTitle) && (
                <div className="text-[11px] text-muted-foreground">
                  {candidateName ?? "Candidate"}{positionTitle ? ` · ${positionTitle}` : ""}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!joiningDate) return;
            mutation.mutate();
          }}
          className="p-5 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Offer date">
              <input
                type="date"
                value={offerDate}
                onChange={(e) => setOfferDate(e.target.value)}
                className="input-base"
              />
            </Field>
            <Field label="Joining date" required>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="input-base"
              />
            </Field>
          </div>

          <Field label="Final CTC (display)">
            <input
              type="text"
              placeholder="e.g. ₹18 LPA"
              value={ctcDisplay}
              onChange={(e) => setCtcDisplay(e.target.value)}
              className="input-base"
            />
          </Field>

          <Field label="CTC in INR (annual, optional)">
            <NumberInput min={0} placeholder="1800000" value={ctcInr} onChange={setCtcInr} />
          </Field>

          <Field label="Notes (optional)">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base resize-y"
              placeholder="Any handover notes for the recruiter…"
            />
          </Field>

          {mutation.isError && (
            <div className="text-xs text-destructive">{(mutation.error as Error).message}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="h-9 px-3 rounded-md text-sm border border-border hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !joiningDate}
              className="h-9 px-4 rounded-md text-sm bg-success text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              {mutation.isPending ? "Saving…" : "Confirm placement"}
            </button>
          </div>
        </form>
      </div>

      <style>{`.input-base{width:100%;height:2.25rem;border-radius:0.375rem;border:1px solid oklch(0.45 0.02 60 / 0.45);background:oklch(0.14 0.02 45);padding:0 0.625rem;font-size:0.8125rem;outline:none;transition:border-color 150ms,color 150ms,box-shadow 150ms;color:var(--color-foreground)}
      .input-base::placeholder{color:oklch(0.55 0.02 60 / 0.6)}
      .input-base:focus{border-color:oklch(0.72 0.18 50 / 0.7);box-shadow:0 0 0 1px oklch(0.72 0.18 50 / 0.25)}
      textarea.input-base{height:auto;padding:0.5rem 0.625rem}`}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
        {label}{required && <span className="text-destructive"> *</span>}
      </div>
      {children}
    </label>
  );
}