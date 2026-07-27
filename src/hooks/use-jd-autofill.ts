import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateJobDescription } from "@/lib/jd-generate.functions";

type Context = {
  companyName?: string | null;
  location?: string | null;
  experience?: string | null;
  salary?: string | null;
  employmentType?: string | null;
  skills?: string[] | null;
};

/**
 * Auto-drafts a job description from the title.
 * - Auto-runs on title blur, only while the description is still empty.
 * - Never overwrites text the user (or a parsed JD) already put there.
 * - `generate()` is the manual "Generate / Regenerate" action and always overwrites.
 */
export function useJdAutofill({
  title,
  description,
  setDescription,
  context,
  enabled = true,
}: {
  title: string;
  description: string;
  setDescription: (v: string) => void;
  context?: Context;
  enabled?: boolean;
}) {
  const generateFn = useServerFn(generateJobDescription);
  const [generating, setGenerating] = useState(false);

  const descRef = useRef(description);
  descRef.current = description;
  const titleRef = useRef(title);
  titleRef.current = title;
  const ctxRef = useRef(context);
  ctxRef.current = context;
  const busyRef = useRef(false);
  const lastTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!description.trim()) lastTitleRef.current = null;
  }, [description]);

  const run = useCallback(
    async (auto: boolean) => {
      const t = titleRef.current.trim();
      if (!enabled) return;
      if (t.length < 3) {
        if (!auto) toast.error("Add a job title first");
        return;
      }
      if (busyRef.current) return;
      if (auto && descRef.current.trim()) return;
      if (auto && lastTitleRef.current === t) return;

      busyRef.current = true;
      setGenerating(true);
      const toastId = auto ? undefined : toast.loading("Drafting description…");
      try {
        const c = ctxRef.current ?? {};
        const { description: text } = await generateFn({
          data: {
            title: t,
            companyName: c.companyName || null,
            location: c.location || null,
            experience: c.experience || null,
            salary: c.salary || null,
            employmentType: c.employmentType || null,
            skills: c.skills?.length ? c.skills.slice(0, 40) : null,
          },
        });
        lastTitleRef.current = t;
        setDescription(text);
        if (toastId) toast.success("Description drafted — edit as needed", { id: toastId });
        else toast.success("Description drafted from the title — edit as needed");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Couldn't generate a description";
        if (toastId) toast.error(msg, { id: toastId });
        else console.warn("JD autofill failed:", msg);
      } finally {
        busyRef.current = false;
        setGenerating(false);
      }
    },
    [enabled, generateFn, setDescription],
  );

  return {
    generating,
    /** Manual action — always regenerates. */
    generate: useCallback(() => run(false), [run]),
    /** Attach to the title input's onBlur. */
    onTitleBlur: useCallback(() => {
      void run(true);
    }, [run]),
  };
}
