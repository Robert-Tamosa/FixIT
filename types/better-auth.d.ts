import type { User } from "better-auth";

declare module "better-auth" {
  interface User {
    role:             "OWNER" | "MECHANIC" | "ADMIN" | "SHOP";
    phone?:           string | null;
    twoFactorEnabled: boolean | null;
  }
} 