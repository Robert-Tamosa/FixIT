import { redirect } from "next/navigation";
import { getMyShop } from "@/app/actions/shop";
import { getShopOverview } from "@/app/actions/shop-dashboard";
import { ShopDashboardView } from "./_shop-dashboard";

export default async function ShopDashboardPage() {
  const shop = await getMyShop();
  if (!shop) redirect("/shop/register");

  const { stats, recentBookings } = await getShopOverview();

  return (
    <ShopDashboardView
      shopName={shop.name}
      shopAddress={shop.address}
      isVerified={shop.isVerified}
      stats={stats}
      recentBookings={recentBookings}
      mechanics={shop.mechanics}
    />
  );
}