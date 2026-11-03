-- Order messages moved to the Notifications screen (Messages tab), opened
-- from the bell (3 Nov 2026, rivanah). Message notifications now open that
-- conversation there. Same functions as before; only the links change.

create or replace function public.send_order_message(p_po_id uuid, p_topic text, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_po   public.purchase_orders%rowtype;
  v_org  uuid := app.my_org_id();
  v_id   uuid;
  v_side text;
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

  v_side := case when v_org = v_po.buyer_org_id then 'buyer' else 'supplier' end;
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, 'order_message',
         'The ' || v_side || ' sent a message on ' || v_po.po_number,
         left(btrim(p_body), 140),
         '/admin/notifications?tab=messages&o=' || v_po.id || '&side=' || v_side
    from public.profiles p where p.role = 'admin';

  perform app.audit('order_message_sent', 'purchase_order', p_po_id, jsonb_build_object('topic', p_topic));
  return v_id;
end;
$$;

create or replace function public.reply_order_message(p_po_id uuid, p_org_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_po  public.purchase_orders%rowtype;
  v_id  uuid;
begin
  if not app.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into v_po from public.purchase_orders where id = p_po_id;
  if v_po.id is null or p_org_id not in (v_po.buyer_org_id, v_po.vendor_org_id) then
    raise exception 'Order not found';
  end if;
  if coalesce(length(btrim(p_body)), 0) = 0 then
    raise exception 'Please write a message';
  end if;

  insert into public.order_messages (po_id, org_id, author_id, from_mpi, topic, body)
  values (p_po_id, p_org_id, auth.uid(), true, 'other', btrim(p_body))
  returning id into v_id;

  perform app.notify_org(
    p_org_id, 'order_message', 'MPI replied about ' || v_po.po_number, left(btrim(p_body), 140),
    case when p_org_id = v_po.buyer_org_id then '/startup' else '/supplier' end
      || '/notifications?tab=messages&o=' || v_po.id);
  return v_id;
end;
$$;

revoke execute on function public.send_order_message(uuid, text, text) from public, anon;
revoke execute on function public.reply_order_message(uuid, uuid, text) from public, anon;
grant execute on function public.send_order_message(uuid, text, text), public.reply_order_message(uuid, uuid, text)
  to authenticated;
