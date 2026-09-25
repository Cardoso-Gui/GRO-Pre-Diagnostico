LOCK TABLE public.assessments IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.assessments ADD COLUMN report_revision integer CHECK (report_revision >= 0);
CREATE TABLE private.report_revision_counters(client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE, last_revision integer NOT NULL CHECK(last_revision>=0));
ALTER TABLE private.report_revision_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.report_revision_counters FROM PUBLIC, anon, authenticated;
ALTER TABLE public.assessments DISABLE TRIGGER assessments_a_stamp;
ALTER TABLE public.assessments DISABLE TRIGGER assessments_b_guard;
WITH numbered AS (SELECT id,(row_number() OVER(PARTITION BY client_id ORDER BY completed_at,id)-1)::integer AS n FROM public.assessments WHERE status='completed')
UPDATE public.assessments a SET report_revision=n.n FROM numbered n WHERE a.id=n.id;
ALTER TABLE public.assessments ENABLE TRIGGER assessments_a_stamp;
ALTER TABLE public.assessments ENABLE TRIGGER assessments_b_guard;
INSERT INTO private.report_revision_counters SELECT client_id,max(report_revision) FROM public.assessments WHERE status='completed' GROUP BY client_id;
CREATE UNIQUE INDEX assessments_client_report_revision_key ON public.assessments(client_id,report_revision) WHERE report_revision IS NOT NULL;
CREATE FUNCTION private.assign_report_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' THEN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.team_members WHERE user_id=auth.uid() AND active) THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
  INSERT INTO private.report_revision_counters AS c(client_id,last_revision) VALUES(NEW.client_id,0)
  ON CONFLICT(client_id) DO UPDATE SET last_revision=c.last_revision+1
  RETURNING last_revision INTO NEW.report_revision;
 ELSE NEW.report_revision:=NULL;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.assign_report_revision() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER assessments_c_report_revision BEFORE INSERT OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION private.assign_report_revision();
