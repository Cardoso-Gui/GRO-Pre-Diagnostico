-- Emergency deactivation; preserves original assessments AND every audit entry.
-- Execute only with separately authorized database administration. No data is deleted.
begin;
update private.assessment_rectification_control set enabled=false where singleton;
revoke execute on function public.rectify_assessment(uuid,integer,uuid,text,jsonb) from authenticated;
revoke execute on function private.append_assessment_rectification(uuid,integer,uuid,text,jsonb) from authenticated;
-- Read RPC, history and the original remain available under the original assessment RLS.
-- can_rectify_assessment now returns false. Do not drop or truncate audit tables.
commit;
