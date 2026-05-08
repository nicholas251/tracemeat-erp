/**
 * Single source of truth for access control — driven entirely by WorkProfiles.
 * No user.role is used anywhere in this system.
 */

const ADMIN_PROFILE_NAMES = ["Admin"];
const SUPERVISOR_PROFILE_NAMES = ["Supervisor"];
const ADMIN_OR_SUPERVISOR_NAMES = ["Admin", "Supervisor"];
const WAREHOUSE_PROFILE_NAMES = ["Warehouse Operator"];
const QUALITY_CONTROL_NAMES = ["Quality Control"];

/** True if user has an Admin work profile */
export function isUserAdmin(profiles = []) {
  return profiles.some(p => ADMIN_PROFILE_NAMES.includes(p.name));
}

/** True if user has Admin OR Supervisor work profile */
export function isUserAdminOrSupervisor(profiles = []) {
  return profiles.some(p => ADMIN_OR_SUPERVISOR_NAMES.includes(p.name));
}

/** True if user has a Supervisor work profile */
export function isUserSupervisor(profiles = []) {
  return profiles.some(p => SUPERVISOR_PROFILE_NAMES.includes(p.name));
}

/** True if user has a Quality Control work profile */
export function isUserQualityControl(profiles = []) {
  return profiles.some(p => QUALITY_CONTROL_NAMES.includes(p.name));
}

/** True if user's ONLY profile is Warehouse Operator */
export function isUserWarehouseOnly(profiles = []) {
  return profiles.length === 1 && WAREHOUSE_PROFILE_NAMES.includes(profiles[0]?.name);
}

/** True if user has any production capability profile (not just warehouse/admin) */
export function isUserProductionWorker(profiles = []) {
  return profiles.length > 0 && !isUserWarehouseOnly(profiles) && !isUserAdminOrSupervisor(profiles);
}

/**
 * Determine which nav items a user can see based purely on their work profiles.
 * 
 * Nav item role tags and their profile mappings:
 *   "all"                → everyone
 *   "admin"              → Admin profile
 *   "supervisor"         → Supervisor profile
 *   "quality_control"    → Quality Control profile
 *   "warehouse_operator" → Warehouse Operator profile
 *   "production_worker"  → any profile with capability_keys (non-admin/supervisor/warehouse)
 */
export function getVisibleNavRoles(profiles = []) {
  const roles = new Set(["all"]);

  if (isUserAdmin(profiles)) roles.add("admin");
  if (isUserSupervisor(profiles)) roles.add("supervisor");
  if (isUserAdminOrSupervisor(profiles)) {
    // Admin/Supervisor see everything — add all role tags
    roles.add("quality_control");
    roles.add("warehouse_operator");
    roles.add("production_worker");
  }
  if (isUserQualityControl(profiles)) roles.add("quality_control");
  if (isUserWarehouseOnly(profiles)) roles.add("warehouse_operator");
  if (isUserProductionWorker(profiles)) roles.add("production_worker");

  return roles;
}