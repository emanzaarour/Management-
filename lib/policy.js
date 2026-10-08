// Safe shared policy: usable by the client without importing credentials or Sheets.
const norm = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const aliases = {
  "kab elias": "qab elias",
  qabelias: "qab elias",
  "al marj": "marj",
  dalhamiye: "dalhamieh",
  "dalhamiyet zahleh": "dalhamieh",
  "jeb janine": "jeb janin",
  "jeb jannine": "jeb janin",
};
export const centerKey = (value) => aliases[norm(value)] || norm(value);
export const isAdmin = (user) => !!user && norm(user.role) === "admin";
export const isManager = (user) => !!user && norm(user.role) === "manager";
export const isOfficer = (user) => !!user && norm(user.role) === "officer";
export function canAccessCenter(user, center) {
  if (!user || !center) return false;
  if (isAdmin(user)) return true;
  return (
    (isManager(user) || isOfficer(user)) &&
    centerKey(user.center) !== "all" &&
    !!centerKey(user.center) &&
    centerKey(user.center) === centerKey(center)
  );
}
export function canReadModule(user, module) {
  if (isAdmin(user)) return true;
  if (isManager(user))
    return [
      "dashboard",
      "attendance",
      "schedule",
      "sessions",
      "workload",
      "reports",
      "timesheets",
    ].includes(module);
  if (!isOfficer(user)) return false;
  if (["dashboard", "sessions"].includes(module)) return true;
  if (module === "schedule") return user.scheduleAccess === true;
  if (["workload", "timesheets"].includes(module))
    return user.timesheetAccess === true;
  if (module === "reports") return user.reportsAccess === true;
  return false;
}
export const canManageWeeklySchedule = (user) =>
  isAdmin(user) || isManager(user);
export const canManageProgramSessions = (user) =>
  isAdmin(user) || isOfficer(user);
export const personIdForUser = (user) =>
  String(user?.staffId || user?.email || "").trim();
export const canAccessPerson = (user, id) =>
  !isOfficer(user) ||
  personIdForUser(user) === String(id).trim() ||
  norm(user?.email) === norm(id);
export function programAllowed(user, program) {
  return (
    !isOfficer(user) ||
    !user.programs?.length ||
    user.programs.some((p) => norm(p) === norm(program))
  );
}
export function canAccessGroup(user, group) {
  return (
    canAccessCenter(user, group.center) &&
    programAllowed(user, group.program) &&
    canAccessPerson(user, group.officerId)
  );
}
