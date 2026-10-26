"use server";

import { revalidatePath } from "next/cache";
import {
  addTables, createStaff, deleteTable, reissueQr, renumberTable, saveBranding, saveSettings, setWaiterTables, updateStaff,
} from "@/server/admin-venue";
import { requireOwner } from "@/server/session";

const done = () => revalidatePath("/admin", "layout");

export async function addTablesAction(n: number) {
  const s = await requireOwner();
  await addTables(s.venueId, Number(n) || 1);
  done();
}

export async function reissueQrAction(tableId: string) {
  const s = await requireOwner();
  const ok = !!(await reissueQr(s.venueId, tableId));
  done();
  return ok;
}

export async function renumberTableAction(tableId: string, number: number) {
  const s = await requireOwner();
  const ok = await renumberTable(s.venueId, tableId, Number(number));
  done();
  return ok;
}

export async function deleteTableAction(tableId: string) {
  const s = await requireOwner();
  const ok = await deleteTable(s.venueId, tableId);
  done();
  return ok;
}

export async function createStaffAction(input: { name: string; role: string; pin: string }) {
  const s = await requireOwner();
  const ok = !!(await createStaff(s.venueId, { name: String(input.name), role: String(input.role), pin: String(input.pin) }));
  done();
  return ok;
}

export async function updateStaffAction(staffId: string, input: { name?: string; active?: boolean; pin?: string }) {
  const s = await requireOwner();
  const ok = await updateStaff(s.venueId, staffId, {
    name: input.name === undefined ? undefined : String(input.name),
    active: input.active === undefined ? undefined : !!input.active,
    pin: input.pin === undefined ? undefined : String(input.pin),
  });
  done();
  return ok;
}

export async function setWaiterTablesAction(staffId: string, tableIds: string[]) {
  const s = await requireOwner();
  const ok = await setWaiterTables(s.venueId, staffId, Array.isArray(tableIds) ? tableIds.map(String).slice(0, 500) : []);
  done();
  return ok;
}

export async function saveSettingsAction(data: unknown) {
  const s = await requireOwner();
  const r = await saveSettings(s.venueId, data);
  done();
  return r;
}

export async function saveBrandingAction(data: unknown) {
  const s = await requireOwner();
  const ok = await saveBranding(s.venueId, data);
  done();
  return ok;
}
