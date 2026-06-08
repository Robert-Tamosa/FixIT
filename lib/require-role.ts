import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

export function requireRole(
  requiredRole: Role,
  userRole?: Role
) {
  if (!userRole) {
    redirect("/signIn");
  }

  if (userRole !== requiredRole) {
    redirect("/dashboard");
  }
}