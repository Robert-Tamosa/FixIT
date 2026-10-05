import { twoFactorClient } from "better-auth/plugins"
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_AUTH_URL || "",
    plugins: [
        adminClient(),
        twoFactorClient({
            twoFactorPage: "/verify-otp",
        }),
    ],
})