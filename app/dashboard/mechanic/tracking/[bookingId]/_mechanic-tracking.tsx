"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateMechanicLocation } from "@/app/actions/tracking-actions";


export interface MechanicTrackingProps {
  bookingId:    string;
  ownerName:    string;
  vehicleLabel: string;
  status:       string;
  ownerLat:     number | null;
  ownerLng:     number | null;
  ownerAddress: string | null;
}

const PUSH_INTERVAL  = 5_000;  // push every 5s
const GEOFENCE_RADIUS = 200;   // metres

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
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
          html: `<div style="width:44px;height:44px;border-radius:50%;
            background:linear-gradient(135deg,#F59E0B,#EAB308);
            border:3px solid #080909;
            box-shadow:0 0 0 6px rgba(245,158,11,0.2);
            display:flex;align-items:center;justify-content:center;font-size:20px;">🔧</div>`,
          iconSize: [44, 44], iconAnchor: [22, 22],
        });
        if (mechMarker.current) mechMarker.current.setLatLng([mechanicLat, mechanicLng]);
        else {
          mechMarker.current = L.marker([mechanicLat, mechanicLng], { icon })
            .bindTooltip("You", { permanent: true, direction: "top", offset: [0, -24] })
            .addTo(map);
        }
        map.setView([mechanicLat, mechanicLng], map.getZoom());
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
            radius: geofenceRadius, color: "#3B82F6",
            fillColor: "#3B82F6", fillOpacity: 0.07, weight: 2, dashArray: "6 4",
          }).addTo(map);
        }
      }

      // Route line
      if (mechanicLat && mechanicLng && ownerLat && ownerLng) {
        if (routeLine.current)
          routeLine.current.setLatLngs([[mechanicLat, mechanicLng], [ownerLat, ownerLng]]);
        else
          routeLine.current = L.polyline(
            [[mechanicLat, mechanicLng], [ownerLat, ownerLng]],
            { color: "#F59E0B", weight: 3, opacity: 0.55, dashArray: "8 6" }
          ).addTo(map);
      }
    });
  }, [mechanicLat, mechanicLng, ownerLat, ownerLng]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{ height: "300px" }}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

export default function MechanicTrackingView({
  bookingId, ownerName, vehicleLabel, status,
  ownerLat, ownerLng, ownerAddress,
}: MechanicTrackingProps) {
  const [myLat,      setMyLat]      = useState<number | null>(null);
  const [myLng,      setMyLng]      = useState<number | null>(null);
  const [sharing,    setSharing]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [pushCount,  setPushCount]  = useState(0);
  const [lastPush,   setLastPush]   = useState<Date | null>(null);
  const [inside,     setInside]     = useState<boolean | null>(null);
  const watchId      = useRef<number | null>(null);
  const pushInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  const isActive = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(status);

  // Push location to server
  const pushLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await updateMechanicLocation(lat, lng);
      setLastPush(new Date());
      setPushCount((n) => n + 1);

      // Local geofence check
      if (ownerLat && ownerLng) {
        const dist = haversineMeters(lat, lng, ownerLat, ownerLng);
        setInside(dist <= GEOFENCE_RADIUS);
      }
    } catch {
      // Silent — don't interrupt the mechanic
    }
  }, [ownerLat, ownerLng]);

  function startSharing() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    setError(null);
    setSharing(true);

    // Watch position continuously
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setMyLat(pos.coords.latitude);
        setMyLng(pos.coords.longitude);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    // Push every N seconds
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
  }

  // Auto-start when EN_ROUTE
  useEffect(() => {
    if (status === "EN_ROUTE" && !sharing) startSharing();
  }, [status]);

  useEffect(() => () => stopSharing(), []);

  const distMeters = myLat && ownerLat
    ? Math.round(haversineMeters(myLat, myLng!, ownerLat, ownerLng!))
    : null;

  const eta = distMeters !== null
    ? distMeters < 100 ? "Arriving now"
      : `~${Math.max(1, Math.round(distMeters / 1000 / 30 * 60))} min`
    : null;

  return (
    <div className="min-h-screen w-full bg-[#080909] relative">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
          bg-amber-400/[0.025] rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 w-full p-4 pb-10">

        {/* Header */}
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
          <div className="flex-1">
            <h1 className="text-base font-bold text-zinc-100">Location Sharing</h1>
            <p className="text-xs text-zinc-500">{vehicleLabel} · {ownerName}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold ${
            sharing
              ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
              : "bg-zinc-800 border-zinc-700 text-zinc-500"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sharing ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
            {sharing ? "Sharing" : "Off"}
          </div>
        </div>

        {/* Stats */}
        {sharing && (
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {[
              { label: "ETA",      value: eta ?? "—"                                        },
              { label: "Distance", value: distMeters !== null ? `${distMeters}m` : "—"      },
              { label: "Geofence", value: inside === null ? "—" : inside ? "Inside ✓" : "Outside" },
            ].map(({ label, value }) => (
              <div key={label}
                className="flex flex-col items-center gap-1 py-3 rounded-2xl
                  bg-white/[0.03] border border-white/[0.07]">
                <p className="text-sm font-bold text-zinc-100">{value}</p>
                <p className="text-[10px] text-zinc-600">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        <div className="mb-4">
          <TrackingMap
            mechanicLat={myLat}
            mechanicLng={myLng}
            ownerLat={ownerLat}
            ownerLng={ownerLng}
            geofenceRadius={GEOFENCE_RADIUS}
          />
        </div>

        {/* Customer location */}
        {ownerAddress && (
          <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-2xl
            bg-white/[0.03] border border-white/[0.07]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              className="mt-0.5 shrink-0" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="#3B82F6" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="#3B82F6" strokeWidth="1.5" />
            </svg>
            <div>
              <p className="text-[11px] font-semibold text-zinc-500 mb-0.5">Customer Location</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{ownerAddress}</p>
            </div>
          </div>
        )}

        {/* Last push info */}
        {lastPush && (
          <p className="text-[11px] text-zinc-600 text-center mb-4">
            Last pushed {lastPush.toLocaleTimeString("en-PH", {
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            })} · {pushCount} update{pushCount !== 1 ? "s" : ""}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl
            bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Toggle button */}
        {isActive && (
          <button
            onClick={sharing ? stopSharing : startSharing}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.99] ${
              sharing
                ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15"
                : "bg-amber-500 text-[#080909] hover:bg-amber-400 shadow-[0_6px_36px_rgba(245,158,11,0.25)]"
            }`}>
            {sharing ? "⏹ Stop Sharing Location" : "▶ Start Sharing Location"}
          </button>
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