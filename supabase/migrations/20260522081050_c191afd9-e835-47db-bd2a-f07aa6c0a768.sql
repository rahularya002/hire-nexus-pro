
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD CONSTRAINT interviews_candidate_id_fkey   FOREIGN KEY (candidate_id)   REFERENCES public.candidates(id)   ON DELETE CASCADE,
  ADD CONSTRAINT interviews_position_id_fkey    FOREIGN KEY (position_id)    REFERENCES public.positions(id)    ON DELETE CASCADE;

ALTER TABLE public.placements
  ADD CONSTRAINT placements_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD CONSTRAINT placements_candidate_id_fkey   FOREIGN KEY (candidate_id)   REFERENCES public.candidates(id)   ON DELETE CASCADE,
  ADD CONSTRAINT placements_position_id_fkey    FOREIGN KEY (position_id)    REFERENCES public.positions(id)    ON DELETE CASCADE,
  ADD CONSTRAINT placements_client_id_fkey      FOREIGN KEY (client_id)      REFERENCES public.clients(id)      ON DELETE CASCADE;
