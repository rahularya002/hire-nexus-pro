import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInterview, type InterviewRow } from "@/lib/interviews.functions";

/**
 * Reschedule dialog used by both admin and client interview views.
 * Sets the interview's `scheduled_at` to the new datetime and flips its status
 * to `reschedule_requested` so the counterpart sees the new pending state.
 */
export function RescheduleInterviewDialog({
  interview,
  onClose,
  invalidateKeys = [["staff-interviews"], ["client-interviews"], ["interviews", "today"]],
}: {
  interview: InterviewRow | null;
  onClose: () => void;
  invalidateKeys?: ReadonlyArray<ReadonlyArray<string>>;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateInterview);

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("10:00");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!interview) return;
    if (interview.scheduled_at) {
      const d = new Date(interview.scheduled_at);
      setDate(d);
      setTime(d.toTimeString().slice(0, 5));
    } else {
      setDate(undefined);
      setTime("10:00");
    }
    setReason("");
  }, [interview?.id]);

  const m = useMutation({
    mutationFn: async () => {
      if (!interview || !date) throw new Error("Pick a date and time");
      const [h, mi] = time.split(":").map(Number);
      const dt = new Date(date);
      dt.setHours(h || 10, mi || 0, 0, 0);
      const notes = reason.trim()
        ? `${interview.notes ?? ""}${interview.notes ? "\n" : ""}Reschedule: ${reason.trim()}`.slice(0, 9_900)
        : undefined;
      return updateFn({
        data: {
          id: interview.id,
          scheduled_at: dt.toISOString(),
          status: "reschedule_requested",
          ...(notes ? { notes } : {}),
        },
      });
    },
    onSuccess: () => {
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: [...key] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Reschedule requested. The other side will be notified.");
      onClose();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't reschedule"),
  });

  return (
    <Dialog open={!!interview} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule interview</DialogTitle>
          <DialogDescription>
            {interview?.candidate?.name
              ? `For ${interview.candidate.name}${interview.position?.title ? ` · ${interview.position.title}` : ""}.`
              : null}
            {" "}Pick a new date and time. Status will switch to "Reschedule requested".
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>New date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label>New time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Conflict, candidate request, …"
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={m.isPending}>Cancel</Button>
          <Button disabled={!date || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Rescheduling…" : "Request reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}