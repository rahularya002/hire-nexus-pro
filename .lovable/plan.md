## Add Salary Range + Experience to Job Posting Form

### Schema
- Migration on `public.job_posts`: add `experience text` column (nullable). `comp_min` / `comp_max` / `currency` already exist and will be reused for salary range.

### Server (`src/lib/posting.functions.ts`)
- Extend Zod schema + `JobPost` type with `comp_min number|null`, `comp_max number|null`, `currency` (default "INR"), `experience string|null`.
- Persist these on insert in `createJobPost`.
- Update select lists that read job_posts to include the new fields where they surface.

### Form (`src/routes/posting.new.tsx`)
- Add three inputs in the grid: **Experience** (e.g. "3–6 years"), **Salary min**, **Salary max**, plus a small **Currency** select (INR/USD default INR).
- When prefilling from a Position, parse the position's `salary` string into min/max where possible and copy `experience`.
- Send the new fields to `createJobPost`.

### Display
- Public job page (`src/routes/jobs.$slug.tsx`) and post detail (`src/routes/posting.$postId.tsx`): show "Experience" and formatted salary range ("₹12–18 LPA") alongside location/employment.

### Out of scope
- No changes to channel publishing payloads beyond appending the salary/experience line to the shared text builder.