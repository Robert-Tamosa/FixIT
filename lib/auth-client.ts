import { twoFactorClient } from "better-auth/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_AUTH_URL || "",
    plugins: [
        twoFactorClient({
            twoFactorPage: "/verify-otp",
        }),
    ],
})