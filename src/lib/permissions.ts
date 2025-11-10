export function canManageBilling(role: string) {
  return role === "owner" || role === "member";
}

export function canViewOnly(role: string) {
  return role === "client";
}
