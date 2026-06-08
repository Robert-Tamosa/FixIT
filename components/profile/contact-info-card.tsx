interface Props {
  email: string;
  phone?: string | null;
}

export default function ContactInfoCard({ email, phone }: Props) {
  return (
    <div
      className="
rounded-3xl
border
border-zinc-800
bg-black/40
backdrop-blur-sm
">
      <h2 className="mb-4 text-xl font-semibold text-white">Contact Information</h2>

      <p className="text-amber-400">Email: {email}</p>

      <p className="text-amber-400" >Phone: {phone || "Not provided"}</p>
    </div>  
  );
}
