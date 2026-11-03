-- When an order is deleted (for example by the demo reset), also remove the
-- "message on this order" notifications that point at it, so nobody is left
-- with a bell notification for a conversation that no longer exists
-- (3 Nov 2026). Also clears the ones already left behind.

create or replace function app.forget_order_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications
   where type = 'order_message'
     and link like '%o=' || old.id::text || '%';
  return old;
end;
$$;
revoke execute on function app.forget_order_notifications() from public;

drop trigger if exists forget_order_notifications on public.purchase_orders;
create trigger forget_order_notifications
  after delete on public.purchase_orders
  for each row execute function app.forget_order_notifications();

-- One-off: message notifications whose order is already gone, and the very
-- first ones that only linked to "/admin".
delete from public.notifications n
 where n.type = 'order_message'
   and (n.link = '/admin'
        or not exists (select 1 from public.purchase_orders po
                        where n.link like '%o=' || po.id::text || '%'));
