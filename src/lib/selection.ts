// Guest's "My selection": a wish list shown to the waiter, not an order.
export type SelectionItem = { dishId: string; qty: number; comment?: string };

type Priced = { id: string; price: number; kcal: number | null };

export function addDish(items: SelectionItem[], dishId: string, qty = 1, comment?: string): SelectionItem[] {
  const c = comment?.trim() || undefined;
  const i = items.findIndex((x) => x.dishId === dishId && x.comment === c);
  if (i === -1) return [...items, { dishId, qty, comment: c }];
  return items.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x));
}

export function setQty(items: SelectionItem[], index: number, qty: number): SelectionItem[] {
  if (qty <= 0) return items.filter((_, j) => j !== index);
  return items.map((x, j) => (j === index ? { ...x, qty: Math.min(qty, 99) } : x));
}

// Drops dishes that disappeared from the menu (e.g. went to the stop-list).
export function totals(items: SelectionItem[], dishes: Map<string, Priced>) {
  let count = 0;
  let sum = 0;
  let kcal = 0;
  for (const it of items) {
    const d = dishes.get(it.dishId);
    if (!d) continue;
    count += it.qty;
    sum += d.price * it.qty;
    kcal += (d.kcal ?? 0) * it.qty;
  }
  return { count, sum, kcal };
}

export function parseSelection(raw: string | null): SelectionItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => typeof x?.dishId === "string" && Number.isInteger(x?.qty) && x.qty > 0)
      .map((x) => ({ dishId: x.dishId, qty: Math.min(x.qty, 99), comment: typeof x.comment === "string" ? x.comment : undefined }));
  } catch {
    return [];
  }
}
