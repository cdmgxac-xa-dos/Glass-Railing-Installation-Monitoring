-- =============================================================================
-- Client Shop Drawing Transparency Tracker — workflow RPC functions
--
-- Every state-changing action in the app goes through one of these
-- SECURITY DEFINER functions rather than a raw table UPDATE. This is what
-- actually enforces the permission matrix and status workflow from the
-- spec (RLS on drawing_items/drawing_pdfs/review_history only allows direct
-- writes for xa_admin — everyone else must go through here, where each
-- function checks the caller's role AND the item's current state before
-- doing anything).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- log_review — internal helper, appends one immutable audit row
-- ---------------------------------------------------------------------------

create or replace function log_review(p_item uuid, p_action review_action, p_comments text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into review_history (drawing_item_id, user_id, role, action, comments)
  values (p_item, auth.uid(), current_role(), p_action, p_comments);
end;
$$;

-- ---------------------------------------------------------------------------
-- XA — drawing item management
-- ---------------------------------------------------------------------------

create or replace function xa_create_drawing_item(
  p_item_no text,
  p_description text,
  p_category text default null,
  p_sheet_no text default null,
  p_reference text default null,
  p_unit text default null,
  p_qty numeric default null,
  p_plan_reference text default null,
  p_target_submission_date date default null
) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can create drawing items' using errcode = '42501';
  end if;

  insert into drawing_items (item_no, description, category, sheet_no, reference, unit, qty, plan_reference, target_submission_date)
  values (p_item_no, p_description, p_category, p_sheet_no, p_reference, p_unit, p_qty, p_plan_reference, p_target_submission_date)
  returning * into v_row;

  perform log_review(v_row.id, 'created');
  return v_row;
end;
$$;

create or replace function xa_update_drawing_item(
  p_item_id uuid,
  p_description text default null,
  p_category text default null,
  p_sheet_no text default null,
  p_reference text default null,
  p_unit text default null,
  p_qty numeric default null,
  p_plan_reference text default null,
  p_target_submission_date date default null,
  p_remarks text default null
) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can edit drawing items' using errcode = '42501';
  end if;

  update drawing_items set
    description = coalesce(p_description, description),
    category = coalesce(p_category, category),
    sheet_no = coalesce(p_sheet_no, sheet_no),
    reference = coalesce(p_reference, reference),
    unit = coalesce(p_unit, unit),
    qty = coalesce(p_qty, qty),
    plan_reference = coalesce(p_plan_reference, plan_reference),
    target_submission_date = coalesce(p_target_submission_date, target_submission_date),
    remarks = coalesce(p_remarks, remarks)
  where id = p_item_id
  returning * into v_row;

  if not found then
    raise exception 'Drawing item not found';
  end if;

  perform log_review(v_row.id, 'edited');
  return v_row;
end;
$$;

create or replace function xa_delete_drawing_item(p_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can delete drawing items' using errcode = '42501';
  end if;

  delete from drawing_items where id = p_item_id;
end;
$$;

create or replace function xa_assign_draftsman(
  p_item_id uuid,
  p_draftsman_id uuid,
  p_target_date date default null,
  p_comments text default null
) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
  v_old_status drawing_status;
  v_draftsman_role app_role;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can assign draftsmen' using errcode = '42501';
  end if;

  select role into v_draftsman_role from profiles where id = p_draftsman_id;
  if v_draftsman_role is distinct from 'draftsman' then
    raise exception 'Target user is not a draftsman';
  end if;

  select status into v_old_status from drawing_items where id = p_item_id;
  if not found then
    raise exception 'Drawing item not found';
  end if;

  update drawing_items set
    assigned_draftsman = p_draftsman_id,
    target_submission_date = coalesce(p_target_date, target_submission_date),
    status = 'assigned',
    revision_number = case when v_old_status = 'revision_required' then revision_number + 1 else revision_number end
  where id = p_item_id
  returning * into v_row;

  perform log_review(
    v_row.id,
    case when v_old_status = 'revision_required' then 'revision_reassigned' else 'assigned' end,
    p_comments
  );
  return v_row;
end;
$$;

create or replace function xa_submit_to_daaa(p_item_id uuid, p_comments text default null) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can submit drawings to DAAA' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'submitted_to_daaa', submission_date = current_date
  where id = p_item_id and status = 'internal_review'
  returning * into v_row;

  if not found then
    raise exception 'Drawing must be in Internal Review before it can be submitted to DAAA';
  end if;

  perform log_review(v_row.id, 'submitted_to_daaa', p_comments);
  return v_row;
end;
$$;

create or replace function xa_return_to_draftsman(p_item_id uuid, p_comments text default null) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can return a drawing to the draftsman' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'drafting'
  where id = p_item_id and status = 'internal_review'
  returning * into v_row;

  if not found then
    raise exception 'Drawing must be in Internal Review to return it to the draftsman';
  end if;

  perform log_review(v_row.id, 'returned_to_draftsman', p_comments);
  return v_row;
end;
$$;

create or replace function xa_mark_completed(p_item_id uuid, p_comments text default null) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can mark a drawing completed' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'completed'
  where id = p_item_id and status = 'approved'
  returning * into v_row;

  if not found then
    raise exception 'Drawing must be Approved before it can be marked Completed';
  end if;

  perform log_review(v_row.id, 'marked_completed', p_comments);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- PDF uploads — shared implementation, called by the two role-specific
-- wrappers below so the revision bookkeeping only lives in one place.
-- ---------------------------------------------------------------------------

create or replace function upload_drawing_pdf(p_item_id uuid, p_storage_path text, p_file_name text)
returns drawing_pdfs
language plpgsql security definer set search_path = public as $$
declare
  v_pdf drawing_pdfs;
  v_revision integer;
begin
  select revision_number into v_revision from drawing_items where id = p_item_id;
  if not found then
    raise exception 'Drawing item not found';
  end if;

  update drawing_pdfs set is_current = false
  where drawing_item_id = p_item_id and is_current = true;

  insert into drawing_pdfs (drawing_item_id, revision_number, storage_path, file_name, uploaded_by, is_current)
  values (p_item_id, v_revision, p_storage_path, p_file_name, auth.uid(), true)
  returning * into v_pdf;

  update drawing_items set current_pdf_id = v_pdf.id where id = p_item_id;

  perform log_review(p_item_id, 'uploaded_pdf', p_file_name);
  return v_pdf;
end;
$$;

create or replace function xa_upload_pdf(p_item_id uuid, p_storage_path text, p_file_name text)
returns drawing_pdfs
language plpgsql security definer set search_path = public as $$
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can upload drawings here' using errcode = '42501';
  end if;
  return upload_drawing_pdf(p_item_id, p_storage_path, p_file_name);
end;
$$;

create or replace function draftsman_upload_pdf(p_item_id uuid, p_storage_path text, p_file_name text)
returns drawing_pdfs
language plpgsql security definer set search_path = public as $$
declare
  v_assigned uuid;
  v_status drawing_status;
begin
  if current_role() <> 'draftsman' then
    raise exception 'Only the assigned draftsman can upload here' using errcode = '42501';
  end if;

  select assigned_draftsman, status into v_assigned, v_status from drawing_items where id = p_item_id;
  if v_assigned is distinct from auth.uid() then
    raise exception 'You are not assigned to this drawing' using errcode = '42501';
  end if;
  if v_status <> 'drafting' then
    raise exception 'Drawing must be in Drafting to upload a new PDF';
  end if;

  return upload_drawing_pdf(p_item_id, p_storage_path, p_file_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Draftsman — assigned-task workflow
-- ---------------------------------------------------------------------------

create or replace function draftsman_start_task(p_item_id uuid) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'draftsman' then
    raise exception 'Only a draftsman can start a task' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'drafting'
  where id = p_item_id and assigned_draftsman = auth.uid() and status = 'assigned'
  returning * into v_row;

  if not found then
    raise exception 'You are not assigned to this drawing, or it is not in Assigned status';
  end if;

  perform log_review(v_row.id, 'started_drafting');
  return v_row;
end;
$$;

create or replace function draftsman_mark_complete(p_item_id uuid, p_comments text default null) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'draftsman' then
    raise exception 'Only a draftsman can mark a drawing complete' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'internal_review'
  where id = p_item_id
    and assigned_draftsman = auth.uid()
    and status = 'drafting'
    and current_pdf_id is not null
  returning * into v_row;

  if not found then
    raise exception 'Upload a PDF before marking this drawing complete';
  end if;

  perform log_review(v_row.id, 'marked_complete', p_comments);
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Free-form remarks — any of the four roles can post to the comment thread;
-- draftsmen are limited to drawings assigned to them.
-- ---------------------------------------------------------------------------

create or replace function add_comment(p_item_id uuid, p_comments text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role;
  v_assigned uuid;
begin
  v_role := current_role();
  if v_role is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_comments is null or length(trim(p_comments)) = 0 then
    raise exception 'Comment cannot be empty';
  end if;

  if v_role = 'draftsman' then
    select assigned_draftsman into v_assigned from drawing_items where id = p_item_id;
    if v_assigned is distinct from auth.uid() then
      raise exception 'You are not assigned to this drawing' using errcode = '42501';
    end if;
  end if;

  perform log_review(p_item_id, 'remark_added', p_comments);
end;
$$;

-- ---------------------------------------------------------------------------
-- DAAA — first review authority
-- ---------------------------------------------------------------------------

create or replace function daaa_start_review(p_item_id uuid) returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
begin
  if current_role() <> 'daaa' then
    raise exception 'Only DAAA can start a technical review' using errcode = '42501';
  end if;

  update drawing_items
  set status = 'daaa_review'
  where id = p_item_id and status = 'submitted_to_daaa'
  returning * into v_row;

  if not found then
    raise exception 'Drawing is not waiting on DAAA';
  end if;

  perform log_review(v_row.id, 'daaa_started_review');
  return v_row;
end;
$$;

create or replace function daaa_review(p_item_id uuid, p_decision text, p_comments text default null)
returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
  v_status drawing_status;
begin
  if current_role() <> 'daaa' then
    raise exception 'Only DAAA can review this drawing' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'revision_required') then
    raise exception 'Invalid decision: %', p_decision;
  end if;

  select status into v_status from drawing_items where id = p_item_id;
  if v_status not in ('submitted_to_daaa', 'daaa_review') then
    raise exception 'Drawing is not with DAAA for review';
  end if;
  if p_decision = 'revision_required' and (p_comments is null or length(trim(p_comments)) = 0) then
    raise exception 'Comments are required when requesting a revision';
  end if;

  update drawing_items
  set status = case when p_decision = 'approve' then 'gpi_review' else 'revision_required' end
  where id = p_item_id
  returning * into v_row;

  perform log_review(
    v_row.id,
    case when p_decision = 'approve' then 'daaa_approved' else 'daaa_revision_requested' end,
    p_comments
  );
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- GPI — final approval authority
-- ---------------------------------------------------------------------------

create or replace function gpi_review(p_item_id uuid, p_decision text, p_comments text default null)
returns drawing_items
language plpgsql security definer set search_path = public as $$
declare
  v_row drawing_items;
  v_status drawing_status;
begin
  if current_role() <> 'gpi' then
    raise exception 'Only GPI can review this drawing' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'revision_required', 'reject') then
    raise exception 'Invalid decision: %', p_decision;
  end if;

  select status into v_status from drawing_items where id = p_item_id;
  if v_status <> 'gpi_review' then
    raise exception 'Drawing is not with GPI for final review';
  end if;
  if p_decision in ('revision_required', 'reject') and (p_comments is null or length(trim(p_comments)) = 0) then
    raise exception 'Comments are required when requesting a revision or rejecting';
  end if;

  update drawing_items
  set
    status = case when p_decision = 'approve' then 'approved' else 'revision_required' end,
    approval_date = case when p_decision = 'approve' then current_date else approval_date end
  where id = p_item_id
  returning * into v_row;

  perform log_review(
    v_row.id,
    case p_decision
      when 'approve' then 'gpi_approved'
      when 'reject' then 'gpi_rejected'
      else 'gpi_revision_requested'
    end,
    p_comments
  );
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bulk import — XA re-importing/updating the register from a client Excel
-- file (upsert by item_no). Frontend parses the .xlsx and posts rows as JSON.
-- ---------------------------------------------------------------------------

create or replace function xa_bulk_import_items(p_items jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_count integer := 0;
begin
  if current_role() <> 'xa_admin' then
    raise exception 'Only XA can import the drawing register' using errcode = '42501';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into drawing_items (item_no, description, category, sheet_no, reference, unit, qty, plan_reference)
    values (
      v_item->>'item_no',
      v_item->>'description',
      v_item->>'category',
      v_item->>'sheet_no',
      v_item->>'reference',
      v_item->>'unit',
      nullif(v_item->>'qty', '')::numeric,
      v_item->>'plan_reference'
    )
    on conflict (item_no) do update set
      description = excluded.description,
      category = excluded.category,
      sheet_no = excluded.sheet_no,
      reference = excluded.reference,
      unit = excluded.unit,
      qty = excluded.qty,
      plan_reference = excluded.plan_reference;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_exists — lets the pre-login screen offer first-run XA Admin /
-- Site Engineer setup exactly once, without exposing anything about who
-- that admin is. Callable by anon (there's no session yet at login time).
-- ---------------------------------------------------------------------------

create or replace function admin_exists() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where role = 'xa_admin');
$$;

grant execute on function admin_exists() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lock down execution: revoke the default PUBLIC grant, then re-grant only
-- to authenticated. Nothing here is ever callable by anon.
-- ---------------------------------------------------------------------------

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'log_review', 'xa_create_drawing_item', 'xa_update_drawing_item', 'xa_delete_drawing_item',
        'xa_assign_draftsman', 'xa_submit_to_daaa', 'xa_return_to_draftsman', 'xa_mark_completed',
        'upload_drawing_pdf', 'xa_upload_pdf', 'draftsman_upload_pdf', 'draftsman_start_task',
        'draftsman_mark_complete', 'add_comment', 'daaa_start_review', 'daaa_review', 'gpi_review',
        'xa_bulk_import_items'
      )
  loop
    execute format('revoke execute on function %s from public;', f.sig);
    execute format('grant execute on function %s to authenticated;', f.sig);
  end loop;
end $$;
