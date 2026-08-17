"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateMechanicLocation } from "@/app/actions/tracking-actions";
import { advanceBookingStatus } from "@/app/actions/booking-actions";

export interface MechanicTrackingProps {
  bookingId:    string;
  ownerName:    string;
  vehicleLabel: string;
  status:       string;
  isEmergency:  boolean;
  ownerLat:     number | null;
  ownerLng:     number | null;
  ownerAddress: string | null;
}

const PUSH_INTERVAL          = 5_000;  // push every 5s
const GEOFENCE_DISPLAY_RADIUS = 200;   // metres — for the "Inside/Outside" stat card only
const AUTO_ARRIVE_RADIUS      = 30;    // metres — stricter, gates the automatic EN_ROUTE -> IN_PROGRESS
                                        // for emergency bookings. Tighter than the display radius on
                                        // purpose — this triggers a real status change + owner
                                        // notification, not just a UI hint, so it shouldn't fire from
                                        // "somewhere in the neighborhood."

// ── Status config — mirrors owner tracking's, from the mechanic's perspective ──

const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  ESTIMATE_ACCEPTED: { label: "Confirmed",   color: "#38BDF8", desc: "Ready to head to the customer" },
  EN_ROUTE:           { label: "En Route",    color: "#F59E0B", desc: "You're heading to the customer" },
  IN_PROGRESS:        { label: "In Progress", color: "#F97316", desc: "Service is underway" },
  DONE:                { label: "Completed",   color: "#34D399", desc: "Service completed" },
};

function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R    = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateETA(distMeters: number): string {
  if (distMeters < 100) return "Arriving now";
  const mins = Math.round(distMeters / 1000 / 30 * 60); // 30 km/h avg
  if (mins < 1)   return "< 1 min";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `~${mins} min`;
}

// ── Map component (Leaflet, loaded dynamically) — same treatment as owner's ────

function TrackingMap({
  mechanicLat, mechanicLng,
  ownerLat, ownerLng,
  geofenceRadius,
}: {
  mechanicLat:    number | null;
  mechanicLng:    number | null;
  ownerLat:       number | null;
  ownerLng:       number | null;
  geofenceRadius: number;
}) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const mechMarker  = useRef<any>(null);
  const ownerMarker = useRef<any>(null);
  const geoCircle   = useRef<any>(null);
  const routeLine   = useRef<any>(null);

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    if (!document.getElementById("leaflet-css")) {
      const link  = document.createElement("link");
      link.id     = "leaflet-css";
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstance.current) return;

      const lat = mechanicLat ?? ownerLat ?? 10.3157;
      const lng = mechanicLng ?? ownerLng ?? 123.8854;

      const map = L.map(mapRef.current, {
        center: [lat, lng], zoom: 15, zoomControl: true, attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
    });

    return () => { mapInstance.current?.remove(); mapInstance.current = null; };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((L) => {
      const map = mapInstance.current;

      // Mechanic marker (YOU)
      if (mechanicLat && mechanicLng) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:40px;height:40px;border-radius:50%;
            background:linear-gradient(135deg,#F59E0B,#EAB308);
            border:3px solid #080909;
            box-shadow:0 4px 16px rgba(245,158,11,0.5);
            display:flex;align-items:center;justify-content:center;font-size:18px;">🔧</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        });
        if (mechMarker.current) mechMarker.current.setLatLng([mechanicLat, mechanicLng]);
        else {
          mechMarker.current = L.marker([mechanicLat, mechanicLng], { icon })
            .bindTooltip("You", { permanent: true, direction: "top", offset: [0, -24] })
            .addTo(map);
        }
      }

      // Owner pin
      if (ownerLat && ownerLng) {
        const ownerIcon = L.divIcon({
          className: "",
          html: `<div style="width:36px;height:36px;border-radius:50%;
            background:linear-gradient(135deg,#3B82F6,#06B6D4);
            border:3px solid #080909;
            box-shadow:0 4px 12px rgba(59,130,246,0.5);
            display:flex;align-items:center;justify-content:center;font-size:16px;">📍</div>`,
          iconSize: [36, 36], iconAnchor: [18, 36],
        });
        if (ownerMarker.current) ownerMarker.current.setLatLng([ownerLat, ownerLng]);
        else {
          ownerMarker.current = L.marker([ownerLat, ownerLng], { icon: ownerIcon })
            .bindTooltip("Customer", { permanent: false, direction: "top" })
            .addTo(map);
        }

        if (geoCircle.current) geoCircle.current.setLatLng([ownerLat, ownerLng]);
        else {
          geoCircle.current = L.circle([ownerLat, ownerLng], {
            radius: geofenceRadius, color: "#F59E0B",
            fillColor: "#F59E0B", fillOpacity: 0.07, weight: 2, dashArray: "6 4",
          }).addTo(map);
        }
      }

      // Route line + fit bounds to show both, same as owner's map
      if (mechanicLat && mechanicLng && ownerLat && ownerLng) {
        if (routeLine.current)
          routeLine.current.setLatLngs([[mechanicLat, mechanicLng], [ownerLat, ownerLng]]);
        else
          routeLine.current = L.polyline(
            [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
            { color: "#F59E0B", weight: 3, opacity: 0.6, dashArray: "8 6" }
          ).addTo(map);

        map.fitBounds(
          [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
          { padding: [60, 60] },
        );
      } else if (mechanicLat && mechanicLng) {
        map.setView([mechanicLat, mechanicLng], 15);
      }
    });
  }, [mechanicLat, mechanicLng, ownerLat, ownerLng]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{ height: "340px" }}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MechanicTrackingView({
  bookingId, ownerName, vehicleLabel, status: initialStatus, isEmergency,
  ownerLat, ownerLng, ownerAddress,
}: MechanicTrackingProps) {
  const [myLat,      setMyLat]      = useState<number | null>(null);
  const [myLng,      setMyLng]      = useState<number | null>(null);
  const [sharing,    setSharing]    = useState(false);
  const [acquiring,  setAcquiring]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastPush,   setLastPush]   = useState<Date | null>(null);
  const [inside,     setInside]     = useState<boolean | null>(null);
  // Status starts from the server-loaded prop but can change client-side —
  // specifically, the emergency auto-advance below needs the UI (progress
  // banner, "Live"/"Ended" indicator, etc.) to reflect IN_PROGRESS the
  // moment it happens, not just after a manual refresh.
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [autoStartedNotice, setAutoStartedNotice] = useState(false);
  const watchId      = useRef<number | null>(null);
  const pushInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards against firing advanceBookingStatus more than once — pushLocation
  // runs every PUSH_INTERVAL, and once inside the geofence it would stay
  // inside on every subsequent push too.
  const autoAdvancedRef = useRef(false);

  const router = useRouter();

  // ESTIMATE_ACCEPTED, not CONFIRMED, is the real "ready to travel" state
  // now that the estimate step exists — CONFIRMED just means "accepted the
  // request, hasn't sent a price yet," which was previously (incorrectly)
  // treated as trackable, showing this page's live banner before travel
  // was even possible to start.
  const isTracking  = currentStatus === "EN_ROUTE" || currentStatus === "IN_PROGRESS";
  const isPreTravel = currentStatus === "ESTIMATE_ACCEPTED";
  const statusCfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.ESTIMATE_ACCEPTED;

  const pushLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await updateMechanicLocation(lat, lng);
      setLastPush(new Date());

      if (ownerLat && ownerLng) {
        const dist = haversineMeters(lat, lng, ownerLat, ownerLng);
        setInside(dist <= GEOFENCE_DISPLAY_RADIUS); // the "Inside/Outside" badge, unrelated to the trigger below
        const isWithinAutoArriveRadius = dist <= AUTO_ARRIVE_RADIUS;

        // Emergency-only auto-advance: EN_ROUTE → IN_PROGRESS the moment
        // the mechanic's live position enters the (stricter) auto-arrival
        // radius, instead of waiting for a manual "Arrived — Start Job"
        // tap. Scoped to emergency bookings specifically — a scheduled job
        // still expects the mechanic to confirm arrival themselves, since
        // "close to the pin" isn't the same guarantee as "actually with the
        // customer" for a routine appointment, but for an emergency, speed
        // matters more than that extra confirmation step.
        if (
          isEmergency &&
          isWithinAutoArriveRadius &&
          currentStatus === "EN_ROUTE" &&
          !autoAdvancedRef.current
        ) {
          autoAdvancedRef.current = true;
          try {
            await advanceBookingStatus(bookingId);
            setCurrentStatus("IN_PROGRESS");
            setAutoStartedNotice(true);
          } catch (err) {
            // If this fails (e.g. someone already advanced it manually from
            // the dashboard in the meantime), don't get stuck retrying —
            // reset the guard only if the booking is confirmed to still be
            // EN_ROUTE; otherwise leave it be.
            console.error("Auto-advance to IN_PROGRESS failed:", err);
            autoAdvancedRef.current = false;
          }
        }
      }
    } catch {
      // Silent — don't interrupt the mechanic
    }
  }, [ownerLat, ownerLng, isEmergency, currentStatus, bookingId]);

  function startSharing() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    setError(null);
    setSharing(true);
    setAcquiring(true); // visible "acquiring" state until the first fix lands

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMyLat(pos.coords.latitude);
        setMyLng(pos.coords.longitude);
        // A successful fix clears any earlier transient timeout warning
        // and ends the "acquiring" state.
        setError(null);
        setAcquiring(false);
      },
      (err) => {
        // PERMISSION_DENIED is the only truly fatal case — the watch will
        // never succeed without the user re-granting access, so sharing
        // actually needs to stop. TIMEOUT and POSITION_UNAVAILABLE are
        // usually transient (weak signal, no GPS chip on this device, cold
        // start) — watchPosition keeps retrying in the background on its
        // own, so killing `sharing`/`acquiring` here would show "stopped"
        // even though it's still trying and may well succeed on the next
        // attempt. The "Acquiring location…" UI just keeps showing through
        // these instead of flashing an alarming error for a normal cold start.
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access was denied. Please enable location permissions for this site.");
          setSharing(false);
          setAcquiring(false);
        } else if (err.code === err.TIMEOUT) {
          setError("Still trying to get a precise location — this can take a moment.");
        } else {
          setError("Location temporarily unavailable — retrying…");
        }
      },
      // maximumAge kept low (not widened) — this is live tracking/geofence
      // data, so a stale cached position has a real accuracy cost, not just
      // a convenience tradeoff. The "acquiring" UI is what makes the longer
      // timeout feel okay, rather than accepting older positions to mask it.
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );

    pushInterval.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => pushLocation(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }, PUSH_INTERVAL);
  }

  function stopSharing() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (pushInterval.current) {
      clearInterval(pushInterval.current);
      pushInterval.current = null;
    }
    setSharing(false);
    setAcquiring(false);
  }

  // Auto-start whenever we're in a state that should be sharing but isn't
  // yet — not just the exact moment status flips to EN_ROUTE. Covers a
  // refresh/remount mid-job (IN_PROGRESS) where local `sharing` state
  // resets to false but the booking is still genuinely active.
  useEffect(() => {
    if ((currentStatus === "EN_ROUTE" || currentStatus === "IN_PROGRESS") && !sharing) startSharing();
  }, [currentStatus]);

  // Auto-stop once the job is no longer active — no manual control exists,
// so this is the only thing that ends sharing besides unmounting.
useEffect(() => {
  if (!isTracking && sharing) stopSharing();
}, [isTracking]);

  useEffect(() => () => stopSharing(), []);

  const distMeters = myLat && ownerLat
    ? Math.round(haversineMeters(myLat, myLng!, ownerLat, ownerLng!))
    : null;

  const eta = distMeters !== null ? estimateETA(distMeters) : null;

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 w-full p-4 pb-10">

        {/* Header — icon badge, matching owner's, plus a back button since
            the mechanic (unlike the owner) navigates here from a jobs list */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08]
              flex items-center justify-center hover:bg-white/[0.07] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="#71717A" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="#F59E0B" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="#F59E0B" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-zinc-100">Location Sharing</h1>
            <p className="text-xs text-zinc-500">{vehicleLabel} · {ownerName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
            isTracking ? "bg-emerald-400 animate-pulse" : isPreTravel ? "bg-amber-400" : "bg-zinc-600"
            }`} />
            <span className="text-[11px] text-zinc-500">
            {isTracking ? "Live" : isPreTravel ? "Not started" : "Ended"}
            </span>
          </div>
        </div>

        {/* Status banner — matches owner's colored status card */}
        <div className="mb-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl
          bg-white/[0.03] border border-white/[0.08]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30` }}>
            <span className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: statusCfg.color }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-100">{statusCfg.label}</p>
            <p className="text-xs text-zinc-500">{statusCfg.desc}</p>
          </div>
        </div>

        {/* Auto-advance confirmation — only ever shows for emergency jobs,
            the moment the geofence check flips EN_ROUTE -> IN_PROGRESS
            automatically instead of requiring a manual tap. */}
        {autoStartedNotice && (
          <button
            onClick={() => setAutoStartedNotice(false)}
            className="w-full flex items-center gap-2.5 mb-4 px-4 py-3 rounded-2xl
              bg-orange-500/10 border border-orange-500/25 text-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="#FB923C" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs text-orange-300 flex-1">
              You've arrived — job automatically marked In Progress.
            </span>
          </button>
        )}

        {/* Sharing status — automatic, no manual control needed */}
        {isTracking && (
          <p className="text-center text-sm font-medium text-zinc-400 mb-4">
             {sharing ? "📍 Location sharing active" : "Waiting to start location sharing…"}
           </p>
           )}
            {isPreTravel && (
            <p className="text-center text-sm font-medium text-zinc-500 mb-4">
              Tracking starts once you head out
            </p>
          )}

        {/* Stats — iconed cards, matching owner's */}
        {isTracking && (
            <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              {
                label: "ETA", value: eta ?? "—",
                icon: "M12 2v10l4 2",
                sub: myLat ? "Estimated" : "Awaiting location",
              },
              {
                label: "Distance", value: distMeters !== null ? `${distMeters}m` : "—",
                icon: "M3 12h18M12 3l9 9-9 9",
                sub: "To customer",
              },
              {
                label: "Geofence", value: inside === null ? "—" : inside ? "Inside ✓" : "Outside",
                icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                sub: `${GEOFENCE_DISPLAY_RADIUS}m radius`,
              },
            ].map(({ label, value, icon, sub }) => (
              <div key={label}
                className="flex flex-col items-center gap-1 py-3 rounded-2xl
                  bg-white/[0.03] border border-white/[0.07]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round"
                  strokeLinejoin="round" aria-hidden="true">
                  <path d={icon} />
                </svg>
                <p className="text-sm font-bold text-zinc-100">{value}</p>
                <p className="text-[10px] text-zinc-600 text-center">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Map — or a completed-state card when the job has ended, matching owner's */}
        {isTracking ? (
            <TrackingMap
              mechanicLat={myLat}
              mechanicLng={myLng}
              ownerLat={ownerLat}
              ownerLng={ownerLng}
              geofenceRadius={GEOFENCE_DISPLAY_RADIUS}
            />
          ) : isPreTravel ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3
              rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                  stroke="#F59E0B" strokeWidth="1.6" />
                <circle cx="12" cy="10" r="3" stroke="#F59E0B" strokeWidth="1.6" />
              </svg>
              <p className="text-sm font-semibold text-zinc-300">Ready to head out</p>
              <p className="text-xs text-zinc-500 text-center px-6">
                Location sharing will begin automatically once you mark yourself En Route.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3
              rounded-2xl border border-white/[0.07] bg-white/[0.02]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-sm font-semibold text-zinc-300">Service Completed</p>
              <p className="text-xs text-zinc-500">Location tracking has ended</p>
            </div>
          )}

        {/* Customer info card — matches owner's mechanic info card treatment */}
        <div className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl
          bg-white/[0.03] border border-white/[0.08]">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-amber-400">
              {ownerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100">{ownerName}</p>
            <p className="text-xs text-zinc-500 truncate">
              {ownerAddress ?? "No address on file"}
            </p>
          </div>
          {lastPush && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
              bg-emerald-400/10 border border-emerald-400/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-400">
                {lastPush.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl
            bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Privacy note */}
        <p className="text-[11px] text-zinc-600 text-center mt-4 leading-relaxed px-4">
          🔒 Your location is only shared during active service sessions.
          It stops automatically when the job is marked complete.
        </p>
      </div>
    </div>
  );
}