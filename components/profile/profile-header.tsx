interface Props {
  user: {
    name?: string | null;
    role: string;
    email: string;
  };
}

export default function ProfileHeader({ user }: Props) {
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="rounded-3xl border border-zinc-800 bg-black/40 p-6">
  <div className="flex items-center gap-4">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
      <span className="font-bold text-amber-400">
        {initials}
      </span>
    </div>

    <div>
      <h1 className="text-xl font-semibold text-white">
        {user.name}
      </h1>
      
      <span className="mt-3 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-400 pl-7 pr-7">
          Vehicle Owner
        </span>

      <p className="pt-2 text-sm text-zinc-500">
        {user.email}
      </p>
    </div>
  </div>
</div>
  );
}
