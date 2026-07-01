"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getMechanicLocation, saveOwnerLocation, checkGeofence } from "@/app/actions/tracking-actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackingData {
  status:       string;
  mechanicName: string;
  mechanic:     { lat: number | null; lng: number | null; updatedAt: Date | null } | null;
  owner:        { lat: number | null; lng: number | null };
}

export interface OwnerTrackingProps {
  bookingId:    string;
  mechanicName: string;
  vehicleLabel: string;
  status:       string;
  initialOwnerLat: number | null;
  initialOwnerLng: number | null;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  CONFIRMED:   { label: "Confirmed",   color: "#38BDF8", desc: "Mechanic accepted your booking" },
  EN_ROUTE:    { label: "En Route",    color: "#F59E0B", desc: "Mechanic is heading to your location" },
  IN_PROGRESS: { label: "In Progress", color: "#F97316", desc: "Service is underway" },
  DONE:        { label: "Completed",   color: "#34D399", desc: "Service completed" },
};

// ── ETA estimator (rough — distance / avg speed) ──────────────────────────────

function estimateETA(distMeters: number): string {
  if (distMeters < 100)  return "Arriving now";
  const mins = Math.round(distMeters / 1000 / 30 * 60); // 30 km/h avg
  if (mins < 1)  return "< 1 min";
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `~${mins} min`;
}

// ── Map component (Leaflet, loaded dynamically) ───────────────────────────────

function TrackingMap({
  mechanicLat, mechanicLng,
  ownerLat, ownerLng,
  onOwnerPinSet,
  geofenceRadius,
}: {
  mechanicLat:    number | null;
  mechanicLng:    number | null;
  ownerLat:       number | null;
  ownerLng:       number | null;
  onOwnerPinSet:  (lat: number, lng: number) => void;
  geofenceRadius: number;
}) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInstance= useRef<any>(null);
  const mechMarker = useRef<any>(null);
  const ownerMarker= useRef<any>(null);
  const geofenceCircle = useRef<any>(null);
  const polyline   = useRef<any>(null);

  // Boot Leaflet once
  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    // Dynamically load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link  = document.createElement("link");
      link.id     = "leaflet-css";
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstance.current) return;

      const centerLat = ownerLat ?? mechanicLat ?? 10.3157;
      const centerLng = ownerLng ?? mechanicLng ?? 123.8854; // Cebu default

      const map = L.map(mapRef.current, {
        center:          [centerLat, centerLng],
        zoom:            15,
        zoomControl:     true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // Click to pin owner location
      map.on("click", (e: any) => {
        onOwnerPinSet(e.latlng.lat, e.latlng.lng);
      });

      mapInstance.current = map;
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update mechanic marker
  useEffect(() => {
    if (!mapInstance.current) return;
    import("leaflet").then((L) => {
      const map = mapInstance.current;

      if (mechanicLat && mechanicLng) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:40px;height:40px;border-radius:50%;
            background:linear-gradient(135deg,#F59E0B,#EAB308);
            border:3px solid #080909;
            box-shadow:0 4px 16px rgba(245,158,11,0.5);
            display:flex;align-items:center;justify-content:center;
            font-size:18px;">🔧</div>`,
          iconSize:   [40, 40],
          iconAnchor: [20, 20],
        });

        if (mechMarker.current) {
          mechMarker.current.setLatLng([mechanicLat, mechanicLng]);
        } else {
          mechMarker.current = L.marker([mechanicLat, mechanicLng], { icon })
            .bindTooltip("Mechanic", { permanent: false, direction: "top" })
            .addTo(map);
        }
      }

      // Owner pin
      if (ownerLat && ownerLng) {
        const ownerIcon = L.divIcon({
          className: "",
          html: `<div style="
            width:36px;height:36px;border-radius:50%;
            background:linear-gradient(135deg,#3B82F6,#06B6D4);
            border:3px solid #080909;
            box-shadow:0 4px 12px rgba(59,130,246,0.5);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;">📍</div>`,
          iconSize:   [36, 36],
          iconAnchor: [18, 36],
        });

        if (ownerMarker.current) {
          ownerMarker.current.setLatLng([ownerLat, ownerLng]);
        } else {
          ownerMarker.current = L.marker([ownerLat, ownerLng], { icon: ownerIcon })
            .bindTooltip("Your Location", { permanent: false, direction: "top" })
            .addTo(map);
        }

        // Geofence circle
        if (geofenceCircle.current) {
          geofenceCircle.current.setLatLng([ownerLat, ownerLng]);
        } else {
          geofenceCircle.current = L.circle([ownerLat, ownerLng], {
            radius:      geofenceRadius,
            color:       "#F59E0B",
            fillColor:   "#F59E0B",
            fillOpacity: 0.07,
            weight:      2,
            dashArray:   "6 4",
          }).addTo(map);
        }
      }

      // Route polyline
      if (mechanicLat && mechanicLng && ownerLat && ownerLng) {
        if (polyline.current) {
          polyline.current.setLatLngs([
            [mechanicLat, mechanicLng],
            [ownerLat,    ownerLng],
          ]);
        } else {
          polyline.current = L.polyline(
            [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
            { color: "#F59E0B", weight: 3, opacity: 0.6, dashArray: "8 6" }
          ).addTo(map);
        }

        // Fit bounds to show both
        map.fitBounds(
          [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
          { padding: [60, 60] }
        );
      } else if (mechanicLat && mechanicLng) {
        map.setView([mechanicLat, mechanicLng], 15);
      }
    });
  }, [mechanicLat, mechanicLng, ownerLat, ownerLng]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{ height: "340px" }}>
      <div ref={mapRef} className="w-full h-full" />
      {/* Tap to pin hint */}
      {!ownerLat && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000]
          bg-[#080909]/90 backdrop-blur-sm border border-white/[0.08]
          px-3 py-2 rounded-xl pointer-events-none">
          <p className="text-xs text-zinc-400">Tap map to pin your location</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerTrackingView({
  bookingId,
  mechanicName,
  vehicleLabel,
  status: initialStatus,
  initialOwnerLat,
  initialOwnerLng,
}: OwnerTrackingProps) {
  const [tracking,    setTracking]    = useState<TrackingData | null>(null);
  const [ownerLat,    setOwnerLat]    = useState<number | null>(initialOwnerLat);
  const [ownerLng,    setOwnerLng]    = useState<number | null>(initialOwnerLng);
  const [geofence,    setGeofence]    = useState<{ inside: boolean; distanceMeters: number | null } | null>(null);
  const [lastPoll,    setLastPoll]    = useState<Date | null>(null);
  const [pinSaving,   setPinSaving]   = useState(false);
  const POLL_INTERVAL = 5_000; // 5 seconds
  const GEOFENCE_RADIUS = 200; // metres

  const poll = useCallback(async () => {
    const data = await getMechanicLocation(bookingId);
    if (data) {
      setTracking(data as TrackingData);
      setLastPoll(new Date());
    }
  }, [bookingId]);

  // Initial poll + interval
  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  // Geofence check when both locations available
  useEffect(() => {
    if (!tracking?.mechanic?.lat || !ownerLat) return;
    checkGeofence(bookingId, GEOFENCE_RADIUS).then(setGeofence);
  }, [tracking, ownerLat, bookingId]);

  async function handleOwnerPin(lat: number, lng: number) {
    setOwnerLat(lat);
    setOwnerLng(lng);
    setPinSaving(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const geo     = await res.json();
      const address = geo.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      await saveOwnerLocation(bookingId, lat, lng, address);
    } finally {
      setPinSaving(false);
    }
  }

  // Derive current status — prefer live polled data over the stale prop
  const currentStatus = tracking?.status ?? initialStatus;
  const isActive = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(currentStatus);
  const statusCfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.CONFIRMED;
  const mechLat     = tracking?.mechanic?.lat ?? null;
  const mechLng     = tracking?.mechanic?.lng ?? null;
  const distMeters  = geofence?.distanceMeters ?? null;
  const eta         = mechLat && ownerLat && distMeters !== null
    ? estimateETA(distMeters) : null;

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 w-full p-4 pb-10">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="#F59E0B" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="#F59E0B" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-zinc-100">Live Tracking</h1>
            <p className="text-xs text-zinc-500">{vehicleLabel}</p>
          </div>
          {/* Poll indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-[11px] text-zinc-500">
              {isActive ? "Live" : "Ended"}
            </span>
          </div>
        </div>

        {/* Status banner */}
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

        {/* ETA + Distance strip */}
        {isActive && (
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              {
                label: "ETA",
                value: eta ?? "—",
                icon:  "M12 2v10l4 2",
                sub:   mechLat ? "Estimated" : "Awaiting location",
              },
              {
                label: "Distance",
                value: distMeters !== null ? `${distMeters}m` : "—",
                icon:  "M3 12h18M12 3l9 9-9 9",
                sub:   "From your pin",
              },
              {
                label: "Geofence",
                value: geofence?.inside ? "Inside ✓" : geofence ? "Outside" : "—",
                icon:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
                sub:   `${GEOFENCE_RADIUS}m radius`,
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

        {/* Map */}
        {isActive ? (
          <>
            <TrackingMap
              mechanicLat={mechLat}
              mechanicLng={mechLng}
              ownerLat={ownerLat}
              ownerLng={ownerLng}
              onOwnerPinSet={handleOwnerPin}
              geofenceRadius={GEOFENCE_RADIUS}
            />
            {pinSaving && (
              <p className="text-xs text-zinc-500 text-center mt-2">Saving your location…</p>
            )}
            {ownerLat && !pinSaving && (
              <p className="text-xs text-zinc-600 text-center mt-2">
                📍 Your pin is set · Tap map to move it
              </p>
            )}
          </>
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

        {/* Mechanic info card */}
        <div className="mt-4 flex items-center gap-3 px-4 py-3.5 rounded-2xl
          bg-white/[0.03] border border-white/[0.08]">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20
            flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-amber-400">
              {mechanicName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100">{mechanicName}</p>
            <p className="text-xs text-zinc-500">
              {mechLat
                ? `Last seen ${lastPoll ? new Date(lastPoll).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}`
                : "Location not yet shared"}
            </p>
          </div>
          {mechLat && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
              bg-emerald-400/10 border border-emerald-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-400">Online</span>
            </div>
          )}
        </div>

        {/* Privacy note */}
        <p className="text-[11px] text-zinc-600 text-center mt-4 leading-relaxed px-4">
          🔒 Location tracking is only active during your service session
          and stops automatically when the job is completed.
        </p>
      </div>
    </div>
  );
}