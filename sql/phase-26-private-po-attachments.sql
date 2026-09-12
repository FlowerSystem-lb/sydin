-- SydIN Phase 26: supplier invoices are private
--
-- The po-attachments bucket was public-read: anyone holding a link could
-- open a supplier invoice. The bucket is now private and only the owner
-- (first folder segment = their user id) can read; the app opens files
-- through short-lived signed URLs (app/lib/purchaseOrders.ts,
-- getPurchaseOrderAttachmentUrl). Applied to the live project on
-- 12 Sep 2026 as migration phase_26_private_po_attachments.

begin;

update storage.buckets set public = false where id = 'po-attachments';

drop policy if exists "PO attachments are publicly readable" on storage.objects;
drop policy if exists "Users can read own PO attachments" on storage.objects;
create policy "Users can read own PO attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
