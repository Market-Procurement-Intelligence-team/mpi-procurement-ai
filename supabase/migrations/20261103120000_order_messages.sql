-- ============================================================================
-- Order messages: "Contact supplier / Contact buyer" and "Need help" on an
-- order (3 Nov 2026, chosen by rivanah).
--
-- Each side of an order talks to MPI, never directly to the other side, so
-- names stay private. A message meant for the other side is passed on by MPI.
-- One conversation per order and side: (po_id, org_id). The MPI team's
-- replies are in the same conversation with from_mpi = true.
--
-- Writing goes only through the two functions below; nobody inserts directly.
-- ============================================================================

create table public.order_messages (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references public.purchase_orders (id) on delete cascade,
  org_id      uuid not null references public.organisations (id) on delete cascade, -- the buyer or supplier side of this conversation
  author_id   uuid references public.profiles (id) on delete set null,
  from_mpi    boolean not null default false,
  topic       text not null default 'other'
              check (topic in ('for_other_side', 'delivery', 'quality', 'payment', 'other')),
  body        text not null check (length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index order_messages_po_idx on public.order_messages (po_id, org_id, created_at);

alter table public.order_messages enable row level security;
grant select on public.order_messages to authenticated;

-- Each side sees only its own conversation with MPI; admins see all.
create policy om_select on public.order_messages for select to authenticated using (
  org_id = (select app.my_org_id()) or (select app.is_admin())
);

-- Buyer or supplier: send a message to MPI about an order.
create function public.send_order_message(p_po_id uuid, p_topic text, p_body text)
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
         '/admin'
    from public.profiles p where p.role = 'admin';

  perform app.audit('order_message_sent', 'purchase_order', p_po_id, jsonb_build_object('topic', p_topic));
  return v_id;
end;
$$;

-- MPI admin: reply in one side's conversation on an order.
create function public.reply_order_message(p_po_id uuid, p_org_id uuid, p_body text)
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
    case when p_org_id = v_po.buyer_org_id then '/startup/orders?o=' else '/supplier/orders?o=' end
      || v_po.id || '&tab=messages');
  return v_id;
end;
$$;

revoke execute on function public.send_order_message(uuid, text, text) from public, anon;
revoke execute on function public.reply_order_message(uuid, uuid, text) from public, anon;
grant execute on function public.send_order_message(uuid, text, text), public.reply_order_message(uuid, uuid, text)
  to authenticated;
