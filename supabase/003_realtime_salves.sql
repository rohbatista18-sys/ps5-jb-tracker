-- Live salves: visitors may only RECEIVE broadcasts on the private "salves" topic.
-- There is deliberately no INSERT policy, so the publishable key cannot send; only the server
-- (secret key, after the hourly quota check in /api/reactions) broadcasts.
drop policy if exists "anon receives salves" on realtime.messages;

create policy "anon receives salves"
on realtime.messages
for select
to anon
using (
  realtime.topic() = 'salves'
  and realtime.messages.extension = 'broadcast'
);
