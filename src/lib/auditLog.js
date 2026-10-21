import { base44 } from "@/api/base44Client";

export async function logAudit(entry) {
  const me = await base44.auth.me();
  return base44.entities.AuditLog.create({
    area: "Finished Goods",
    ...entry,
    initials: entry.initials ? entry.initials.trim().toUpperCase() : undefined,
    user_name: me?.full_name,
    user_email: me?.email,
  });
}