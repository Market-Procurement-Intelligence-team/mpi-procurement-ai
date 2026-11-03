-- Admin notifications for order messages now open that order's messages on
-- the admin Orders & messages screen (3 Nov 2026). Same function as in
-- 20261103120000_order_messages.sql; only the link changes.

create or replace function public.send_order_message(p_po_id uuid, p_topic text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_po   public.purchase_orders%rowtype;
  v_org  uuid := app.my_org_id();
  v_id   uuid;
  v_who  text;
begin
  select * into v_po from public.purchase_orders where id = p_po_id;
  if v_po.id is null or v_org is null or v_org not in (v_po.buyer_org_id, v_po.vendor_org_id) then
    raise exception 'Order not found';
  end if;
  if coalesce(length(btrim(p_body)), 0) = 0 then
    raise exception 'Please write a message';
  end if;
  if length(btrim(p_body)) > 2000 then
    raise exception 'Please keep the message under 2,000 characters';
  end if;

  insert into public.order_messages (po_id, org_id, author_id, topic, body)
  values (p_po_id, v_org, auth.uid(), coalesce(nullif(p_topic, ''), 'other'), btrim(p_body))
  returning id into v_id;

  v_who := case when v_org = v_po.buyer_org_id then 'The buyer' else 'The supplier' end;
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'order_message',
         v_who || ' sent a message on ' || v_po.po_number,
         left(btrim(p_body), 140),
         '/admin/orders?o=' || v_po.id || '&tab=messages'
    from public.profiles p where p.role = 'admin';

  perform app.audit('order_message_sent', 'purchase_order', p_po_id, jsonb_build_object('topic', p_topic));
  return v_id;
end;
$$;

revoke execute on function public.send_order_message(uuid, text, text) from public, anon;
grant execute on function public.send_order_message(uuid, text, text) to authenticated;
