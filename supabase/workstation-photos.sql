insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('workstation-photos','workstation-photos',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy workstation_photos_read on storage.objects for select to authenticated using (
 bucket_id='workstation-photos' and exists(select 1 from public.clients c where c.id::text=(storage.foldername(name))[1] and ((select private.is_global_admin()) or c.team_id=(select private.current_team_id())))
);
create policy workstation_photos_insert on storage.objects for insert to authenticated with check (
 bucket_id='workstation-photos' and (storage.foldername(name))[2]=(select auth.uid())::text
 and exists(select 1 from public.clients c where c.id::text=(storage.foldername(name))[1] and ((select private.is_global_admin()) or c.team_id=(select private.current_team_id())) and not c.archived)
);
-- No update/delete policies: replacing a photo must not change completed reports.
