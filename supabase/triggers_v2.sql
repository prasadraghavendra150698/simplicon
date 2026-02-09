
-- Enhanced Message Notification Trigger
create or replace function public.create_notification_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_user uuid;
  sub_assigned_to text;
  sub_req_no text;
  sub_client_name text;
  assigned_uid uuid;
begin
  select user_id, assigned_to, request_no, coalesce(client_full_name, client_email) 
  into sub_user, sub_assigned_to, sub_req_no, sub_client_name 
  from public.submissions where id = new.submission_id;
  
  if new.sender = 'admin' then
    -- Notify client
    insert into public.notifications (user_id, submission_id, title, content, type)
    values (
      sub_user, 
      new.submission_id, 
      'New Message on ' || sub_req_no, 
      'Admin: ' || left(new.message, 100), 
      'message'
    );
  else
    -- Notify assigned admin
    select id into assigned_uid from auth.users where email = lower(sub_assigned_to);
    
    if assigned_uid is not null then
      insert into public.notifications (user_id, submission_id, title, content, type)
      values (
        assigned_uid, 
        new.submission_id, 
        'Client Reply', 
        'New message from ' || sub_client_name || ' on ' || sub_req_no, 
        'message'
      );
    end if;
  end if;
  return new;
end;
$$;
