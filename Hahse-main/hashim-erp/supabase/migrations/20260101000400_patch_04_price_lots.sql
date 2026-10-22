-- =====================================================================
-- patch_04: دفعات المخزون حسب سعر الشراء + صفحة التسعيرة
-- عند توريد نفس الصنف بسعر مختلف تُنشأ دفعة (lot) مستقلة، فيمكن فصل المخزون
-- الذي بسعر الشراء القديم عن الجديد وتسعير كل دفعة على حدة.
-- نفس سعر الشراء لنفس الفرع والصنف = نفس الدفعة (تُدمج الكميات).
-- =====================================================================

-- 1) صلاحية قسم التسعيرة
insert into public.permissions (module, action)
select 'pricing', a from unnest(array['view','create','update','delete','print','export','approve','cancel']) as a
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.module = 'pricing'
where r.code in ('super_admin','head_office')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.module = 'pricing' and p.action in ('view','print','export')
where r.code in ('accountant','warehouse_manager')
on conflict do nothing;

-- 2) جدول الدفعات
create table if not exists public.stock_lots (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  product_id        uuid not null references public.products(id),
  unit_cost         numeric(14,2) not null check (unit_cost >= 0),   -- سعر الشراء (شامل التكاليف الموزعة)
  qty_on_hand       numeric(14,3) not null default 0 check (qty_on_hand >= 0),
  retail_price      numeric(14,2) check (retail_price is null or retail_price >= 0),     -- null = سعر المنتج العام
  wholesale_price   numeric(14,2) check (wholesale_price is null or wholesale_price >= 0),
  first_received_at timestamptz not null default now(),
  last_received_at  timestamptz not null default now(),
  note              text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, product_id, unit_cost)
);
create index if not exists idx_lots_product_branch on public.stock_lots (product_id, branch_id, first_received_at);
create index if not exists idx_lots_branch_qty on public.stock_lots (branch_id) where qty_on_hand > 0;

create trigger set_updated_at before update on public.stock_lots
  for each row execute function public.trg_set_updated_at();

alter table public.stock_lots enable row level security;
create policy lots_sel on public.stock_lots for select to authenticated
  using (public.can_access_branch(branch_id));
create policy lots_upd on public.stock_lots for update to authenticated
  using (public.can_access_branch(branch_id) and public.has_permission('pricing','update'))
  with check (public.can_access_branch(branch_id) and public.has_permission('pricing','update'));
-- لا إدراج/حذف من الواجهة: الدفعات تُدار فقط عبر حركات المخزون (trigger)

-- 3) ربط حركة المخزون بدفعة محددة (اختياري)
alter table public.stock_movements add column if not exists lot_id uuid references public.stock_lots(id);

-- 4) تكلفة FIFO لكمية معينة (متوسط تكلفة الدفعات التي ستُستهلك)
create or replace function public.internal_fifo_cost(p_branch uuid, p_product uuid, p_qty numeric) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare l record; v_rem numeric := p_qty; v_take numeric; v_acc numeric := 0; v_avg numeric;
begin
  if p_qty is null or p_qty <= 0 then return 0; end if;
  for l in select unit_cost, qty_on_hand from public.stock_lots
           where branch_id = p_branch and product_id = p_product and qty_on_hand > 0
           order by first_received_at, id
  loop
    v_take := least(v_rem, l.qty_on_hand);
    v_acc := v_acc + v_take * l.unit_cost;
    v_rem := v_rem - v_take;
    exit when v_rem <= 0;
  end loop;
  if v_rem > 0 then
    select coalesce(avg_cost, 0) into v_avg from public.stock_balances where branch_id = p_branch and product_id = p_product;
    v_acc := v_acc + v_rem * coalesce(v_avg, 0);
  end if;
  return round(v_acc / p_qty, 4);
end $$;

-- 5) ترحيل الأرصدة الحالية: دفعة افتتاحية لكل رصيد قائم بمتوسط تكلفته
insert into public.stock_lots (branch_id, product_id, unit_cost, qty_on_hand)
select branch_id, product_id, round(avg_cost, 2), qty_on_hand
from public.stock_balances where qty_on_hand > 0
on conflict (branch_id, product_id, unit_cost) do nothing;

-- 6) زناد حركة المخزون: يحدّث الرصيد (كما كان) + الدفعات
create or replace function public.trg_stock_movement_apply() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old_qty numeric; v_old_avg numeric; v_new_avg numeric; v_new_qty numeric;
  v_min numeric; v_name text;
  v_lot_cost numeric; v_rem numeric; v_take numeric; v_lot record;
begin
  insert into public.stock_balances (branch_id, product_id) values (new.branch_id, new.product_id)
  on conflict do nothing;

  select qty_on_hand, avg_cost into v_old_qty, v_old_avg
  from public.stock_balances where branch_id = new.branch_id and product_id = new.product_id for update;

  v_new_qty := v_old_qty + new.qty_in - new.qty_out;
  if v_new_qty < 0 then
    raise exception 'INSUFFICIENT_STOCK: product %, branch %', new.product_id, new.branch_id;
  end if;

  v_new_avg := v_old_avg;
  if new.qty_in > 0 and new.movement_type in ('purchase','transfer_in','opening') and new.unit_cost > 0 then
    v_new_avg := ((v_old_qty * v_old_avg) + (new.qty_in * new.unit_cost)) / (v_old_qty + new.qty_in);
  end if;

  update public.stock_balances
     set qty_on_hand = v_new_qty, avg_cost = v_new_avg, updated_at = now()
   where branch_id = new.branch_id and product_id = new.product_id;

  -- ===== الدفعات =====
  if new.qty_in > 0 then
    v_lot_cost := round(case when new.unit_cost > 0 then new.unit_cost else v_old_avg end, 2);
    insert into public.stock_lots (branch_id, product_id, unit_cost, qty_on_hand)
    values (new.branch_id, new.product_id, v_lot_cost, new.qty_in)
    on conflict (branch_id, product_id, unit_cost)
    do update set qty_on_hand = public.stock_lots.qty_on_hand + excluded.qty_on_hand, last_received_at = now();
  end if;

  if new.qty_out > 0 then
    v_rem := new.qty_out;
    if new.lot_id is not null then
      update public.stock_lots set qty_on_hand = qty_on_hand - v_rem
       where id = new.lot_id and branch_id = new.branch_id and product_id = new.product_id and qty_on_hand >= v_rem;
      if not found then raise exception 'INSUFFICIENT_LOT_STOCK: product %, branch %', new.product_id, new.branch_id; end if;
    else
      for v_lot in select id, qty_on_hand from public.stock_lots
                   where branch_id = new.branch_id and product_id = new.product_id and qty_on_hand > 0
                   order by first_received_at, id for update
      loop
        v_take := least(v_rem, v_lot.qty_on_hand);
        update public.stock_lots set qty_on_hand = qty_on_hand - v_take where id = v_lot.id;
        v_rem := v_rem - v_take;
        exit when v_rem <= 0;
      end loop;
    end if;
  end if;

  -- تنبيه انخفاض المخزون عند عبور الحد الأدنى
  if new.qty_out > 0 then
    select min_stock, name into v_min, v_name from public.products where id = new.product_id;
    if v_min > 0 and v_old_qty > v_min and v_new_qty <= v_min then
      perform public.internal_notify('low_stock', 'انخفاض مخزون: ' || v_name,
        'الكمية الحالية ' || v_new_qty || ' (الحد الأدنى ' || v_min || ')',
        'products', new.product_id, new.branch_id, array['warehouse_manager','head_office','branch_manager']);
    end if;
  end if;
  return new;
end $$;

-- 7) دالة البيع بتكلفة الدفعة (FIFO أو دفعة محددة عبر items[].lot_id)
create or replace function public.fn_create_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_shift public.shifts%rowtype;
  v_prof public.profiles%rowtype;
  v_inv uuid; v_inv_no text;
  it jsonb; pay jsonb;
  v_prod public.products%rowtype; v_bal public.stock_balances%rowtype;
  v_qty numeric; v_price numeric; v_disc numeric; v_rate numeric; v_net numeric; v_tax numeric;
  v_subtotal numeric := 0; v_discount numeric := 0; v_taxtotal numeric := 0;
  v_header_disc numeric := coalesce((p ->> 'discount')::numeric, 0);
  v_total numeric; v_paid numeric := 0; v_received numeric := 0; v_amt numeric; v_recv numeric;
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_change numeric; v_remaining numeric;
  v_lot public.stock_lots%rowtype; v_lot_id uuid; v_cost numeric;
begin
  if not public.has_permission('pos','create') then raise exception 'FORBIDDEN'; end if;
  select * into v_shift from public.shifts where user_id = v_uid and status = 'open';
  if not found then raise exception 'NO_OPEN_SHIFT'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then raise exception 'EMPTY_CART'; end if;
  if v_header_disc < 0 then raise exception 'INVALID_DISCOUNT'; end if;

  insert into public.sales_invoices (branch_id, shift_id, customer_id, sold_by)
  values (v_shift.branch_id, v_shift.id, v_customer, v_prof.employee_id)
  returning id, invoice_no into v_inv, v_inv_no;

  for it in select * from jsonb_array_elements(p -> 'items') loop
    select * into v_prod from public.products where id = (it ->> 'product_id')::uuid and is_active;
    if not found then raise exception 'PRODUCT_NOT_FOUND: %', it ->> 'product_id'; end if;

    v_qty   := (it ->> 'qty')::numeric;
    if v_qty is null or v_qty <= 0 then raise exception 'INVALID_QTY'; end if;
    v_price := coalesce((it ->> 'unit_price')::numeric, v_prod.retail_price);
    v_disc  := coalesce((it ->> 'discount')::numeric, 0);
    v_rate  := coalesce((select rate from public.tax_rates where id = v_prod.tax_rate_id and is_active), 0);
    v_net   := v_qty * v_price - v_disc;
    if v_net < 0 or v_disc < 0 then raise exception 'INVALID_DISCOUNT'; end if;
    v_tax   := round(v_net * v_rate / 100, 2);

    select * into v_bal from public.stock_balances
     where branch_id = v_shift.branch_id and product_id = v_prod.id for update;
    if not found or (v_bal.qty_on_hand - v_bal.qty_reserved) < v_qty then
      raise exception 'INSUFFICIENT_STOCK: %', v_prod.name;
    end if;

    -- التكلفة حسب الدفعة: دفعة محددة (lot_id) أو الأقدم أولاً (FIFO)
    v_lot_id := nullif(it ->> 'lot_id', '')::uuid;
    if v_lot_id is not null then
      select * into v_lot from public.stock_lots
       where id = v_lot_id and branch_id = v_shift.branch_id and product_id = v_prod.id for update;
      if not found or v_lot.qty_on_hand < v_qty then raise exception 'INSUFFICIENT_LOT_STOCK: %', v_prod.name; end if;
      v_cost := v_lot.unit_cost;
    else
      v_cost := public.internal_fifo_cost(v_shift.branch_id, v_prod.id, v_qty);
    end if;

    insert into public.sales_invoice_items (invoice_id, product_id, qty, unit_price, unit_cost, discount, tax_rate, line_total)
    values (v_inv, v_prod.id, v_qty, v_price, v_cost, v_disc, v_rate, v_net + v_tax);

    insert into public.stock_movements (branch_id, product_id, movement_type, qty_out, unit_cost, ref_type, ref_id, lot_id)
    values (v_shift.branch_id, v_prod.id, 'sale', v_qty, v_cost, 'sales_invoices', v_inv, v_lot_id);

    v_subtotal := v_subtotal + v_qty * v_price;
    v_discount := v_discount + v_disc;
    v_taxtotal := v_taxtotal + v_tax;
  end loop;

  v_discount := v_discount + v_header_disc;
  v_total := v_subtotal - v_discount + v_taxtotal;
  if v_total < 0 then raise exception 'INVALID_TOTAL'; end if;

  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) loop
    v_amt  := (pay ->> 'amount')::numeric;
    v_recv := coalesce((pay ->> 'received_amount')::numeric, v_amt);
    if v_amt is null or v_amt <= 0 then raise exception 'INVALID_PAYMENT'; end if;
    insert into public.sales_payments (invoice_id, payment_method_id, amount, received_amount)
    values (v_inv, (pay ->> 'payment_method_id')::uuid, v_amt, v_recv);
    insert into public.cash_transactions (branch_id, shift_id, payment_method_id, tx_type, direction, amount, ref_type, ref_id)
    values (v_shift.branch_id, v_shift.id, (pay ->> 'payment_method_id')::uuid, 'sale', 'in', v_amt, 'sales_invoices', v_inv);
    v_paid := v_paid + v_amt;
    v_received := v_received + v_recv;
  end loop;

  if v_paid > v_total then raise exception 'OVERPAID'; end if;
  v_remaining := v_total - v_paid;
  if v_remaining > 0 and v_customer is null then raise exception 'CUSTOMER_REQUIRED_FOR_CREDIT'; end if;
  v_change := greatest(v_received - v_paid, 0);

  update public.sales_invoices
     set subtotal = v_subtotal, discount = v_discount, tax_amount = v_taxtotal, total = v_total,
         paid_amount = v_paid, change_amount = v_change, remaining = v_remaining
   where id = v_inv;

  return jsonb_build_object('id', v_inv, 'invoice_no', v_inv_no, 'total', v_total,
                            'paid', v_paid, 'change', v_change, 'remaining', v_remaining);
end $$;

-- 8) عرض الدفعات للتسعيرة
create or replace view public.v_stock_lots with (security_invoker = true) as
select l.id as lot_id, l.branch_id, b.name as branch_name, l.product_id,
       p.name as product_name, p.sku, p.barcode, p.category_id,
       l.unit_cost, l.qty_on_hand, round(l.qty_on_hand * l.unit_cost, 2) as lot_value,
       l.retail_price, l.wholesale_price,
       coalesce(l.retail_price, p.retail_price) as effective_retail,
       coalesce(l.wholesale_price, p.wholesale_price) as effective_wholesale,
       p.retail_price as product_retail, p.wholesale_price as product_wholesale,
       l.first_received_at, l.last_received_at,
       row_number() over (partition by l.branch_id, l.product_id order by l.first_received_at, l.id) as lot_seq,
       count(*) filter (where l.qty_on_hand > 0) over (partition by l.branch_id, l.product_id) as active_lots
from public.stock_lots l
join public.products p on p.id = l.product_id
join public.branches b on b.id = l.branch_id;
