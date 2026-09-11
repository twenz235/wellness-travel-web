"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Divider, Spin, Tag } from "antd";
import { ArrowLeftOutlined, EnvironmentOutlined, ReloadOutlined } from "@ant-design/icons";
import "../../../page.css";
import "./detail.css";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8080").replace(/\/$/, "");

type Place = {
  id: string;
  name: string;
  province: string;
  region: string;
  latitude: number;
  longitude: number;
  coordinateRole: string;
  placeType: string;
  campingAvailable: boolean | null;
  sourceUrl: string;
};
type Factor = { factor: string; score: number | null; availableHours: number; expectedHours: number };
type DailyDetail = {
  date: string;
  temperatureMeanC?: number;
  rainMeanMm?: number;
  pm25MeanUgm3?: number;
  usAqiPm25?: number;
  temperatureScore?: number;
  rainScore?: number;
  airScore?: number;
  observedHours: number;
  expectedHours: number;
  airObservedHours: number;
  airExpectedHours: number;
  missing?: string[];
};
type HourlyDetail = {
  at: string;
  temperatureC?: number;
  rainMm?: number;
  airDate: string;
  temperatureValid: boolean;
  rainValid: boolean;
};
type Details = { daily?: DailyDetail[]; hourly?: HourlyDetail[] };
type Item = {
  placeId: string;
  place: Place;
  startDate: string;
  endDate: string;
  score: number | null;
  metrics?: { temperatureC?: number; rainMmPerHour?: number; usAqiPm25?: number };
  coverage: { observedWeightedRatio: number; scoredDays: number; requestedDays: number };
  factors: Factor[];
  requirements: { key: string; status: string }[];
  details?: Details;
};
type ApiResponse = {
  requestId: string;
  scoringVersion: string;
  generatedAt: string;
  timezone: string;
  search: { kind: string; startDate: string; endDate: string; tripDays: number; mode: string; scoringProfile?: "system" | "user" };
  groups: { mode: string; status: string; items: Item[] }[];
  warnings: string[];
};
type Profile = {
  tripDays: number;
  temperature: { minC: number; maxC: number; weight: number };
  rain: { preference: string; weight: number };
  air: { weight: number };
};
type Coordinates = { latitude: number; longitude: number };
type Route = { coordinates: [number, number][]; distanceKm: number };

const defaultProfile: Profile = {
  tripDays: 2,
  temperature: { minC: 20, maxC: 26, weight: 2 },
  rain: { preference: "light", weight: 1 },
  air: { weight: 3 },
};
const statusNames: Record<string, string> = { matched: "ผ่านเงื่อนไขและข้อมูลครบ", incomplete: "ข้อมูลยังไม่ครบ", not_matched: "ไม่ตรงเงื่อนไข" };
const factorNames: Record<string, string> = { temperature: "อุณหภูมิ", rain: "ฝน", air: "ฝุ่น" };
const rainPreferenceNames: Record<string, string> = { dry: "ไม่มีฝน", light: "ฝนเล็กน้อย", moderate: "ฝนปานกลาง" };
const regionNames: Record<string, string> = {
  north: "ภาคเหนือ",
  northeast: "ภาคตะวันออกเฉียงเหนือ",
  central_west_east: "ภาคกลาง ตะวันตก และตะวันออก",
  south: "ภาคใต้",
};

function rainPreferenceLabel(preference?: string) {
  return preference ? rainPreferenceNames[preference] ?? preference : "-";
}

function regionLabel(region?: string) {
  return region ? regionNames[region] ?? region : "-";
}

function shortDateRange(start: string, end: string) {
  const format = (date: string) => {
    const [, month, day] = date.split("-");
    return `${Number(day)}/${Number(month)}`;
  };
  return start === end ? format(start) : `${format(start)}–${format(end)}`;
}

function dateLabel(date: string) {
  if (!date) return "-";
  const parsed = new Date(`${date}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
}

function value(value: number | undefined | null, digits = 1, suffix = "") {
  return value == null || !Number.isFinite(value) ? "-" : `${value.toFixed(digits)}${suffix}`;
}

function integer(valueToFormat: number | undefined | null, suffix = "") {
  return valueToFormat == null || !Number.isFinite(valueToFormat) ? "-" : `${Math.round(valueToFormat)}${suffix}`;
}

function imageForPlace(placeId: string) {
  const hash = Array.from(placeId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 3 === 0 ? "/assets/mountains.svg" : hash % 3 === 1 ? "/assets/forest.svg" : "/assets/lake.svg";
}

function profileFromStorage() {
  try {
    const stored = window.localStorage.getItem("wellness-profile");
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<Profile>;
    return {
      ...defaultProfile,
      ...parsed,
      tripDays: Number.isFinite(parsed.tripDays) ? Math.min(30, Math.max(1, Number(parsed.tripDays))) : defaultProfile.tripDays,
      temperature: { ...defaultProfile.temperature, ...(parsed.temperature ?? {}) },
      rain: { ...defaultProfile.rain, ...(parsed.rain ?? {}) },
      air: { ...defaultProfile.air, ...(parsed.air ?? {}) },
    } as Profile;
  } catch {
    return null;
  }
}

export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = decodeURIComponent(params.id ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("matched");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const requestedMode = searchParams.get("mode") === "forecast" ? "forecast" : searchParams.get("mode") === "seasonal" ? "seasonal" : startDate && endDate ? "forecast" : "seasonal";
  const scoringProfile = searchParams.get("scoringProfile") === "system" ? "system" : "user";
  const period = ["day", "night", "all"].includes(searchParams.get("period") ?? "") ? searchParams.get("period")! : "all";
  const tripDays = Math.min(30, Math.max(1, Number(searchParams.get("tripDays") ?? "2") || 2));

  useEffect(() => {
    setProfile(profileFromStorage());
  }, []);

  const loadDetail = useCallback(async () => {
    if (!placeId) {
      setError("ไม่พบสถานที่นี้");
      setLoading(false);
      return;
    }
    const savedProfile = profileFromStorage();
    setProfile(savedProfile);
    if (scoringProfile === "user" && !savedProfile) {
      setError("ตั้งค่าความชอบก่อน จึงจะคำนวณคะแนนของสถานที่นี้ได้");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const body: Record<string, unknown> = {
      // Seasonal cards carry their selected window in the URL for display,
      // but `dates` must stay null so the API keeps Seasonal semantics.
      dates: requestedMode === "forecast" && startDate && endDate ? { startDate, endDate } : null,
      tripDays: savedProfile?.tripDays ?? tripDays,
      period,
      scoringProfile,
      requirements: { placeType: "national_park" },
      placeId,
      selectedStartDate: startDate,
      selectedEndDate: endDate,
      mode: requestedMode,
    };
    if (scoringProfile === "user" && savedProfile) body.preferences = { temperature: savedProfile.temperature, rain: savedProfile.rain, air: savedProfile.air };
    try {
      const response = await fetch(`${API_BASE}/v1/recommendations/detail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as ApiResponse & { error?: { code?: string } };
      if (!response.ok) throw new Error(data.error?.code ?? "โหลดรายละเอียดไม่สำเร็จ");
      const found = data.groups.flatMap((group) => group.items.map((candidate) => ({ item: candidate, status: group.status }))).find((candidate) => candidate.item.placeId === placeId);
      if (!found) throw new Error("ไม่พบสถานที่นี้ในผลการคำนวณ");
      setItem(found.item);
      setStatus(found.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดรายละเอียดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [endDate, period, placeId, requestedMode, scoringProfile, startDate, tripDays]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <main className="detail-page">
      <header className="topbar detail-topbar">
        <Button type="text" className="detail-back" icon={<ArrowLeftOutlined />} onClick={() => router.back()}>กลับ</Button>
        <div className="brand-mark"><span>W</span><div><strong>Wellness Travel</strong><small>รายละเอียดสถานที่</small></div></div>
        <div className="detail-topbar-spacer" />
      </header>

      <div className="detail-content">
        {loading && <div className="detail-loading"><Spin size="large" /><p>กำลังอ่านข้อมูลอากาศและรายละเอียดสถานที่…</p></div>}
        {!loading && error && <section className="detail-error"><Alert type="warning" showIcon title={error} /><div className="detail-error-actions"><Button onClick={() => router.back()}>กลับไปผลค้นหา</Button><Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadDetail()}>ลองใหม่</Button></div></section>}
        {!loading && !error && item && <DetailContent item={item} status={status} scoringProfile={scoringProfile} requestedMode={requestedMode} profile={profile} />}
      </div>
    </main>
  );
}

function DetailContent({ item, status, scoringProfile, requestedMode, profile }: { item: Item; status: string; scoringProfile: "system" | "user"; requestedMode: string; profile: Profile | null }) {
  const details = item.details ?? {};
  const mode = requestedMode === "forecast" ? "forecast" : "seasonal";
  const profileNote = scoringProfile === "user" ? "* คิดคะแนนจากความชอบของผู้ใช้" : "* คิดคะแนนจากค่ากลางระบบ";
  return (
    <>
      <section className="detail-hero-card">
        <div className="detail-hero-art"><img src={imageForPlace(item.placeId)} alt="" aria-hidden="true" /></div>
        <div className="detail-hero-copy">
          <div className="detail-kicker"><Tag color={mode === "forecast" ? "blue" : "green"}>{mode === "forecast" ? "Forecast" : "Seasonal"}</Tag><Tag>{statusNames[status] ?? status}</Tag></div>
          <h1>{item.place.name}</h1>
          <p className="detail-location"><EnvironmentOutlined /> {item.place.province} · {regionLabel(item.place.region)}</p>
          <p className="detail-date">ช่วงที่แนะนำ {shortDateRange(item.startDate, item.endDate)}</p>
          <p className="detail-coordinate-note">พิกัดอ้างอิงของ{item.place.placeType === "national_park" ? "อุทยาน" : "สถานที่"} · ไม่ใช่ตำแหน่งลานกางเต็นท์</p>
        </div>
        <div className="detail-score-card" aria-label="คะแนนรวมของสถานที่">
          <div className="score-card-top"><span className="score-card-label">คะแนนรวม</span><span className="score-badge"><span aria-hidden="true">✧</span> ยอดเยี่ยม</span></div>
          <strong>{item.score == null ? "-" : item.score.toFixed(1)}</strong>
          <div className="score-review-row"><span className="score-stars" aria-label="คะแนนรีวิว 4.9 จาก 5">★★★★★</span><span>4.9 (1,240+)</span></div>
          <div className="score-divider" />
          <dl className="score-breakdown"><div><dt>ทัศนียภาพธรรมชาติ</dt><dd>9.6</dd></div><div><dt>สิ่งอำนวยความสะดวก</dt><dd>8.7</dd></div><div><dt>ความสะดวกการเดินทาง</dt><dd>7.8</dd></div></dl>
          <small>{profileNote}</small>
        </div>
      </section>

      <section className="detail-section detail-summary-section" aria-labelledby="summary-title">
        <div className="detail-section-heading"><div><h2 id="summary-title">ภาพรวม</h2></div><span className="detail-coverage">ข้อมูลที่ใช้ {item.coverage.observedWeightedRatio > 0 ? `${Math.round(item.coverage.observedWeightedRatio * 100)}%` : "-"}</span></div>
        <div className="detail-metric-grid">
          <DetailMetric label="อุณหภูมิ" value={value(item.metrics?.temperatureC, 1, "°C")} icon="temperature" />
          <DetailMetric label="ฝน" value={value(item.metrics?.rainMmPerHour, 2, " mm")} icon="rain" />
          <DetailMetric label="ฝุ่น · US AQI" value={integer(item.metrics?.usAqiPm25)} icon="air" />
        </div>
        <div className="factor-grid">
          {item.factors.map((factor) => <div className="factor-detail" key={factor.factor}><span>{factorNames[factor.factor] ?? factor.factor}</span><strong>{factor.score == null ? "-" : factor.score.toFixed(1)}</strong><small>{factor.availableHours}/{factor.expectedHours} ชั่วโมงที่มีข้อมูล</small></div>)}
        </div>
        {profile && scoringProfile === "user" && <p className="detail-preference-note">ความชอบที่ใช้: {profile.temperature.minC}–{profile.temperature.maxC}°C · {rainPreferenceLabel(profile.rain.preference)}</p>}
      </section>

      <section className="detail-map-section detail-section" aria-label="เส้นทางไปสถานที่">
        <DetailMap place={item.place} />
      </section>

      {mode === "forecast" ? <ForecastDetails details={details} /> : null}
    </>
  );
}

function DetailMetric({ label, value: formattedValue, icon }: { label: string; value: string; icon: "temperature" | "rain" | "air" }) {
  return <div className="detail-metric"><span className={`metric-icon metric-icon-${icon}`} aria-hidden="true" /><div><small>{label}</small><strong>{formattedValue}</strong></div></div>;
}

function ForecastDetails({ details }: { details: Details }) {
  return <section className="detail-section" aria-labelledby="forecast-title">
    <div className="detail-section-heading"><div><p className="eyebrow">FORECAST</p><h2 id="forecast-title">รายละเอียดรายวัน</h2></div></div>
    <div className="daily-grid">{details.daily?.length ? details.daily.map((day) => <article className="daily-card" key={day.date}><div className="daily-card-heading"><strong>{dateLabel(day.date)}</strong><span>{day.observedHours}/{day.expectedHours} ชม.</span></div><div className="daily-values"><span><b>{value(day.temperatureMeanC, 1, "°C")}</b><small>อุณหภูมิ</small></span><span><b>{value(day.rainMeanMm, 2, " mm")}</b><small>ฝน</small></span><span><b>{integer(day.usAqiPm25)}</b><small>AQI</small></span></div><div className="daily-scores"><span>อุณหภูมิ {value(day.temperatureScore, 1)}</span><span>ฝน {value(day.rainScore, 1)}</span><span>ฝุ่น {value(day.airScore, 1)}</span></div></article>) : <p className="empty-detail">-</p>}</div>
    <Divider />
    <details className="hourly-details"><summary>ดูข้อมูลรายชั่วโมง ({details.hourly?.length ?? 0} รายการ)</summary><div className="hourly-table-wrap"><table className="hourly-table"><thead><tr><th>เวลา</th><th>อุณหภูมิ</th><th>ฝน</th><th>ข้อมูล</th></tr></thead><tbody>{details.hourly?.map((hour) => <tr key={hour.at}><td>{new Date(hour.at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })}</td><td>{value(hour.temperatureC, 1, "°C")}</td><td>{value(hour.rainMm, 2, " mm")}</td><td>{hour.temperatureValid && hour.rainValid ? "ครบ" : "บางส่วน"}</td></tr>)}</tbody></table></div></details>
  </section>;
}

function haversineKm(a: Coordinates, b: Coordinates) {
  const earthRadiusKm = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function DetailMap({ place }: { place: Place }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const maplibreRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef<import("maplibre-gl").Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [locationState, setLocationState] = useState<"loading" | "ready" | "denied" | "unsupported">("loading");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationState("unsupported");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationState("ready");
    }, () => setLocationState("denied"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    if (!userLocation) {
      setRoute(null);
      return;
    }
    const fallback: Route = { coordinates: [[userLocation.longitude, userLocation.latitude], [place.longitude, place.latitude]], distanceKm: haversineKm(userLocation, place) };
    setRoute(fallback);
  }, [place, userLocation]);

  useEffect(() => {
    let disposed = false;
    import("maplibre-gl").then((maplibre) => {
      if (disposed || !mapContainerRef.current) return;
      maplibreRef.current = maplibre;
      const map = new maplibre.Map({ container: mapContainerRef.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [place.longitude, place.latitude], zoom: 8 });
      map.addControl(new maplibre.NavigationControl(), "top-right");
      map.on("error", () => setMapError(true));
      map.once("load", () => { if (!disposed) { map.resize(); setMapReady(true); } });
      mapRef.current = map;
    }).catch(() => setMapError(true));
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; setMapReady(false); };
  }, [place]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = maplibreRef.current;
    if (!map || !maplibre || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const placeMarker = document.createElement("button");
    placeMarker.type = "button";
    placeMarker.className = "map-marker detail-place-marker";
    placeMarker.setAttribute("aria-label", place.name);
    markersRef.current.push(new maplibre.Marker({ element: placeMarker, anchor: "bottom" }).setLngLat([place.longitude, place.latitude]).setPopup(new maplibre.Popup({ offset: 18 }).setText(place.name)).addTo(map));
    if (userLocation) {
      const userMarker = document.createElement("span");
      userMarker.className = "user-map-marker";
      userMarker.setAttribute("aria-label", "ตำแหน่งของฉัน");
      markersRef.current.push(new maplibre.Marker({ element: userMarker, anchor: "center" }).setLngLat([userLocation.longitude, userLocation.latitude]).setPopup(new maplibre.Popup({ offset: 14 }).setText("ตำแหน่งของฉัน")).addTo(map));
    }
    const bounds = new maplibre.LngLatBounds();
    bounds.extend([place.longitude, place.latitude]);
    if (userLocation) {
      bounds.extend([userLocation.longitude, userLocation.latitude]);
      // Keep fitBounds useful when the browser reports the same point as the place.
      if (haversineKm(userLocation, place) < 0.1) {
        bounds.extend([place.longitude - 0.12, place.latitude - 0.08]);
        bounds.extend([place.longitude + 0.12, place.latitude + 0.08]);
      }
    } else {
      // A single point needs a small viewport around it so fitBounds has a stable zoom.
      bounds.extend([place.longitude - 0.3, place.latitude - 0.2]);
      bounds.extend([place.longitude + 0.3, place.latitude + 0.2]);
    }
    map.fitBounds(bounds, { padding: 70, maxZoom: userLocation ? 11 : 9, duration: 400 });
  }, [mapReady, place, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !route) return;
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: route.coordinates } };
    const source = map.getSource("detail-route") as import("maplibre-gl").GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource("detail-route", { type: "geojson", data });
      map.addLayer({ id: "detail-route-line", type: "line", source: "detail-route", paint: { "line-color": "#24657a", "line-width": 4, "line-opacity": 0.78, "line-dasharray": [1.5, 1.2] } });
    }
  }, [mapReady, route]);

  return <div className="detail-map-wrap">
    <div ref={mapContainerRef} className="detail-map-canvas" aria-label={`แผนที่เส้นทางไป ${place.name}`} />
    <div className="detail-map-legend"><span><i className="legend-dot legend-user" /> ตำแหน่งของฉัน</span><span><i className="legend-dot legend-place" /> {place.name}</span></div>
    {mapError && <Alert className="map-alert" type="warning" showIcon title="แผนที่โหลดไม่สำเร็จ" />}
    <div className="detail-route-summary"><div><strong>{route ? `${route.distanceKm.toFixed(1)} กม.` : "-"}</strong><span>ระยะทางโดยประมาณ</span></div><div className="route-status">{locationState === "ready" ? "มีตำแหน่งผู้ใช้" : locationState === "loading" ? "กำลังอ่านตำแหน่ง…" : "ยังไม่มีตำแหน่งผู้ใช้"}<Button type="link" size="small" onClick={requestLocation}>ใช้ตำแหน่งของฉัน</Button></div></div>
    <p className="detail-map-note">พิกัดสถานที่เป็นจุดอ้างอิงของอุทยาน/สถานที่ ไม่ใช่ตำแหน่งลานกางเต็นท์ · แผนที่ © OpenFreeMap © OpenStreetMap contributors</p>
  </div>;
}
