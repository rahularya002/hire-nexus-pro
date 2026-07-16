# Add Salary Range & Location to Candidate Database

## Schema (migration)
Add two columns to `public.candidates`:
- `location` (text, nullable)
- `salary_min` (numeric, nullable)
- `salary_max` (numeric, nullable)

Storing min/max separately (rather than one "range" string) so numeric filtering works cleanly. UI will display as a formatted range.

## Server / functions
Update `src/lib/candidates.functions.ts`:
- Include the new fields in select, create, update, and bulk-insert payloads.
- Extend the list/filter server fn to accept `location` (substring match) and `salaryMin` / `salaryMax` (overlap check: candidate range intersects requested range).

## UI — `src/routes/database.tsx`
1. **Table**: Add "Location" and "Salary Range" columns (formatted as e.g. `₹12–18 LPA` or `—` if empty).
2. **Add/Edit candidate dialog**: Two new inputs — Location (text), Salary Min / Salary Max (numeric pair).
3. **Filters panel**: 
   - Location: text input (contains)
   - Salary: min & max numeric inputs; matches candidates whose range overlaps.
4. **Bulk Excel import**: Add `location`, `salary_min`, `salary_max` columns to the template and parser.

## Out of scope
No changes to scout/sourced_candidates tables or matching logic in this pass.
