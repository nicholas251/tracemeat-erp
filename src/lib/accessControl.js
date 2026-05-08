/**
 * Determines if a user has admin-level access based on their assigned work profiles.
 * Admin-level access is granted to users with "Supervisor" or "Admin" work profiles.
 */
export function isUserAdmin(profiles = []) {
  const adminProfileNames = ["Supervisor", "Admin"];
  return profiles.some(p => adminProfileNames.includes(p.name));
}