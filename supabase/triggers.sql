
-- Assignment Notification Trigger
create or replace function public.create_notification_on_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_uid uuid;
  sender_email text;
begin
  -- Check if assigned_to has changed to a non-null value
  if (coalesce(old.assigned_to, '') is distinct from new.assigned_to) and (new.assigned_to is not null) then
      select id into assigned_uid from auth.users where email = lower(new.assigned_to);
      
      if assigned_uid is not null then
          insert into public.notifications (user_id, submission_id, title, content, type)
          values (
            assigned_uid, 
            new.id, 
            'New Ticket Assigned', 
            'Ticket ' || new.request_no || ' has been assigned to you.', 
            'assignment'
          );
      end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_submission_assignment_notify on public.submissions;
create trigger on_submission_assignment_notify
after update on public.submissions
for each row execute function public.create_notification_on_assignment();

-- New Request Notification Trigger (for Admin)
create or replace function public.create_notification_on_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_uid uuid;
begin
  -- Notify the assigned admin (usually Lead Admin by default)
  if new.assigned_to is not null then
      select id into assigned_uid from auth.users where email = lower(new.assigned_to);
      
      if assigned_uid is not null then
          insert into public.notifications (user_id, submission_id, title, content, type)
          values (
            assigned_uid, 
            new.id, 
            'New Request Received', 
            'New request ' || new.request_no || ' (' || new.service_name || ') has been created.', 
            'new_request'
          );
      end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_submission_insert_notify on public.submissions;
create trigger on_submission_insert_notify
after insert on public.submissions
for each row execute function public.create_notification_on_new_request();
