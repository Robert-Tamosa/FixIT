/**
 * Forward-geocodes a street address into lat/lng using OpenStreetMap's
 * Nominatim API (free, no API key). Nominatim's usage policy requires a
 * descriptive User-Agent and caps unauthenticated requests at ~1/second —
 * fine for on-demand shop registration, but don't batch-call this in a tight
 * loop without a delay (see scripts/backfill-shop-locations.ts for that case).
 *
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "ph", // bias to the Philippines, matching the app's target market
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "FixIT-App (capstone project)" },
    });
    if (!res.ok) return null;

    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const { lat, lon } = results[0];
    return { lat: parseFloat(lat), lng: parseFloat(lon) };
  } catch {
    return null; // geocoding failure shouldn't block shop registration
  }
}