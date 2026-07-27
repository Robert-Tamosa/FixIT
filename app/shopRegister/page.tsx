import { ShopSignupForm } from "@/components/auth/ShopSignupForm";

export default function ShopRegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6 py-12">
      <div className="max-w-sm w-full">
        <ShopSignupForm />
      </div>
    </div>
  );
}