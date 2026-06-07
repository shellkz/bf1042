import type { SessionUser, Role } from "./contracts.ts";

export function hasRole(user: SessionUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(user: SessionUser, roles: Role[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function hasAllRoles(user: SessionUser, roles: Role[]): boolean {
  return roles.every((role) => user.roles.includes(role));
}

export function requireRole(user: SessionUser, role: Role): void {
  if (!hasRole(user, role)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden", message: `Required role: ${role}` }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

export function requireAnyRole(user: SessionUser, roles: Role[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new Response(
      JSON.stringify({
        error: "Forbidden",
        message: `Required one of roles: ${roles.join(", ")}`,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}

export function isResourceOwner(
  user: SessionUser,
  resourceUserId: string,
): boolean {
  return user.id === resourceUserId;
}

export function requireResourceOwner(
  user: SessionUser,
  resourceUserId: string,
): void {
  if (!isResourceOwner(user, resourceUserId)) {
    throw new Response(
      JSON.stringify({ error: "Forbidden", message: "Not the resource owner" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
}
