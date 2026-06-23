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
import { updateCandidate, type CandidateRow } from "@/lib/candidates.functions";

export function EditCandidateDialog({
  open,
  onOpenChange,
  candidate,
  invalidateKeys = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: CandidateRow;
  invalidateKeys?: ReadonlyArray<ReadonlyArray<unknown>>;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateCandidate);

  const [name, setName] = useState(candidate.name);
  const [role, setRole] = useState(candidate.role ?? "");
  const [currentCompany, setCurrentCompany] = useState(candidate.current_company ?? "");
  const [experience, setExperience] = useState(candidate.experience ?? "");
  const [location, setLocation] = useState(candidate.location ?? "");
  const [email, setEmail] = useState(candidate.email ?? "");
  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(candidate.linkedin_url ?? "");
  const [salary, setSalary] = useState(candidate.salary ?? "");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [skills, setSkills] = useState<string[]>(candidate.skills ?? []);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(candidate.name);
    setRole(candidate.role ?? "");
    setCurrentCompany(candidate.current_company ?? "");
    setExperience(candidate.experience ?? "");
    setLocation(candidate.location ?? "");
    setEmail(candidate.email ?? "");
    setPhone(candidate.phone ?? "");
    setLinkedinUrl(candidate.linkedin_url ?? "");
    setSalary(candidate.salary ?? "");
    setNotes(candidate.notes ?? "");
    setSkills(candidate.skills ?? []);
    setSkillInput("");
  }, [open, candidate]);

  const m = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: candidate.id,
          name: name.trim(),
          role: role.trim() || null,
          current_company: currentCompany.trim() || null,
          experience: experience.trim() || null,
          location: location.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          salary: salary.trim() || null,
          notes: notes.trim() || null,
          skills: skills.map((s) => s.trim()).filter(Boolean).slice(0, 40),
        },
      }),
    onSuccess: () => {
      toast.success("Candidate updated");
      qc.invalidateQueries({ queryKey: ["client-position-apps"] });
      qc.invalidateQueries({ queryKey: ["client-applications-all"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: [...key] });
      onOpenChange(false);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Could not update candidate"),
  });

  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    if (skills.includes(v)) { setSkillInput(""); return; }
    setSkills([...skills, v].slice(0, 40));
    setSkillInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit candidate</DialogTitle>
          <DialogDescription>Update what we know about this candidate after speaking with them.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="ec-name">Full name</Label>
              <Input id="ec-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-role">Current role</Label>
              <Input id="ec-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior ML Engineer" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-org">Current company</Label>
              <Input id="ec-org" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-exp">Experience</Label>
              <Input id="ec-exp" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="6 yrs" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-loc">Location</Label>
              <Input id="ec-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-email">Email</Label>
              <Input id="ec-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-phone">Phone</Label>
              <Input id="ec-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-li">LinkedIn URL</Label>
              <Input id="ec-li" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ec-salary">Salary / CTC</Label>
              <Input id="ec-salary" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="₹50 LPA" />
            </div>
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

          <div className="grid gap-1.5">
            <Label htmlFor="ec-notes">Notes</Label>
            <Textarea id="ec-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording from your conversation…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={m.isPending}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !name.trim()}>
            {m.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}