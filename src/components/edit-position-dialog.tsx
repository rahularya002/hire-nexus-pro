import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePosition, type PositionRow } from "@/lib/positions.functions";

export function EditPositionDialog({
  open,
  onOpenChange,
  position,
  invalidateKeys = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: PositionRow;
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePosition);

  const [title, setTitle] = useState(position.title);
  const [location, setLocation] = useState(position.location ?? "");
  const [experience, setExperience] = useState(position.experience ?? "");
  const [salary, setSalary] = useState(position.salary ?? "");
  const [openings, setOpenings] = useState<number>(position.openings);
  const [priority, setPriority] = useState(position.priority);
  const [status, setStatus] = useState(position.status);
  const [description, setDescription] = useState(position.description ?? "");
  const [skills, setSkills] = useState<string[]>(position.skills ?? []);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(position.title);
    setLocation(position.location ?? "");
    setExperience(position.experience ?? "");
    setSalary(position.salary ?? "");
    setOpenings(position.openings);
    setPriority(position.priority);
    setStatus(position.status);
    setDescription(position.description ?? "");
    setSkills(position.skills ?? []);
    setSkillInput("");
  }, [open, position]);

  const m = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: position.id,
          client_id: position.client_id,
          title: title.trim(),
          location: location.trim() || null,
          experience: experience.trim() || null,
          salary: salary.trim() || null,
          openings: Math.max(1, Math.min(999, Number(openings) || 1)),
          priority,
          status,
          description: description.trim() || null,
          skills: skills.map((s) => s.trim()).filter(Boolean).slice(0, 30),
        },
      }),
    onSuccess: () => {
      toast.success("Requirement updated");
      qc.invalidateQueries({ queryKey: ["position", position.id] });
      qc.invalidateQueries({ queryKey: ["client-position", position.id] });
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["client-positions"] });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: [...key] });
      onOpenChange(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Could not update requirement"),
  });

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) { setSkillInput(""); return; }
    setSkills([...skills, v].slice(0, 30));
    setSkillInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit requirement</DialogTitle>
          <DialogDescription>Update the role details. Changes are visible to everyone with access.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-title">Title</Label>
            <Input id="ep-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Backend Engineer" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ep-loc">Location</Label>
              <Input id="ep-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote / Bengaluru" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-exp">Experience</Label>
              <Input id="ep-exp" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="5-8 years" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-sal">Salary</Label>
              <Input id="ep-sal" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="₹25-35 LPA" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ep-open">Openings</Label>
              <Input id="ep-open" type="number" min={1} max={999} value={openings}
                onChange={(e) => setOpenings(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="interviews">Interviews</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Role responsibilities, must-haves, etc." />
          </div>

          <div className="grid gap-1.5">
            <Label>Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" variant="outline" onClick={addSkill}><Plus className="size-4" /></Button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {skills.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary font-medium">
                    {s}
                    <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="text-muted-foreground hover:text-foreground">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !title.trim()}>
            {m.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}