"use client";
import { AuthForm } from "@/components/auth/auth-form";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();

  const handleRegisterMechanic = () => {
    router.push("/mechanicSignUp");
  };
  return (
    <>
      <AuthForm mode="signup" />
    </>
  );
}
