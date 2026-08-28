-- ===========================================================================
-- Phase 18 — close the product-photo storage hole
-- ===========================================================================
-- APPLIED 2026-08-27 via the Supabase migration API, and verified after.
-- Kept here as the record of what changed and why.
--
-- WHAT WAS WRONG
-- --------------
-- The upload rule on the `products` bucket read, in full:
--
--     with check (bucket_id = 'products')
--
-- It checked *which bucket* and nothing else. Any signed-in user could write a
-- file into any path in that bucket, including inside another customer's folder.
-- `business-logos` and `po-attachments` both check
-- `(storage.foldername(name))[1] = auth.uid()::text` — `products`, the one that
-- holds every customer's inventory photos, was the one that did not.
--
-- Two more gaps in the same place:
--   * No DELETE rule at all, so a deleted item left its photo in storage
--     permanently and the bill only ever grew.
--   * No bucket-level size or type limit. The app's 5 MB and JPG/PNG/WebP
--     checks ran in the browser, and the key the browser holds is public — so
--     both could be walked around by calling Supabase directly.
--
-- THE APP HAD TO BE FIXED FIRST
-- -----------------------------
-- This migration could not be applied on its own. Four screens upload product
-- photos; only two of them wrote to `<user-id>/...`. The Inventory list and the
-- item detail page both did:
--
--     const fileName = `${Date.now()}-${editImage.name}`;
--
-- — no folder, and the browser's original filename kept verbatim. Enforcing the
-- ownership check while those two existed would have broken editing an item's
-- photo. Both now use `createProductImagePath` from `app/lib/productImage.ts`,
-- which is the single definition of how a product photo is validated and named.
-- That went in first; this followed.
--
-- WHY SELECT IS STILL PUBLIC
-- --------------------------
-- Two reasons, both deliberate. The customer-facing QR page shows a product
-- photo to someone with no account. And older files sit at the bucket root with
-- no folder, from before the path helper existed; an ownership check on reads
-- would make those items lose their photos.
--
-- STILL OPEN AFTER THIS
-- ---------------------
-- `po-attachments` — supplier invoices — is a public-read bucket, and the app
-- stores `getPublicUrl(...)` results directly in the database. Making it private
-- means switching those to signed URLs, which is an application change rather
-- than a policy change, so it is tracked separately in the Plan of Record rather
-- than bundled in here and left half-done.
--
-- REVERSING THIS
-- --------------
-- Restore the old rule with:
--   drop policy "Users can upload own product images" on storage.objects;
--   create policy "Authenticated users can upload product images"
--     on storage.objects for insert to authenticated
--     with check (bucket_id = 'products');
-- Nothing was dropped other than that one policy, and no file was touched.
-- ===========================================================================

drop policy if exists "Authenticated users can upload product images" on storage.objects;

create policy "Users can upload own product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete own product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update own product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id in ('products','business-logos');

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf']
 where id = 'po-attachments';

-- ===========================================================================
-- Verification — both were run after applying.
-- ===========================================================================

-- 1. Expected: four rows. INSERT, UPDATE and DELETE each carrying the
--    foldername check; SELECT public, with only the bucket test.
select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname ilike '%product%'
order by cmd;

-- 2. Expected: every bucket has a size limit and a MIME list — no nulls.
select id, public,
       round(file_size_limit / 1024.0 / 1024.0, 1) as limit_mb,
       allowed_mime_types
from storage.buckets
order by id;
