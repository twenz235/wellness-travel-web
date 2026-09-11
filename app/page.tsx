"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import { Alert, Button, DatePicker, Form, InputNumber, Select, Spin, Tag } from "antd";
import { ArrowRightOutlined, CloudOutlined, DashboardOutlined, EnvironmentOutlined, ExperimentOutlined, SettingOutlined } from "@ant-design/icons";
import "./page.css";

const { RangePicker } = DatePicker;
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
type Item = {
  placeId: string;
  place: Place;
  startDate: string;
  endDate: string;
  score: number | null;
  metrics?: { temperatureC?: number; rainMmPerHour?: number; usAqiPm25?: number };
  coverage: { observedWeightedRatio: number; scoredDays: number; requestedDays: number };
  factors: Factor[];
  requirements: { key: string; status: string; reason?: string }[];
  reasons: { code: string; message?: string; fields?: string[]; key?: string }[];
  sourceIds: string[];
  details?: {
    daily?: { date: string; temperatureMeanC?: number; rainMeanMm?: number; pm25MeanUgm3?: number; usAqiPm25?: number; temperatureScore?: number; rainScore?: number; airScore?: number; observedHours: number; expectedHours: number; airObservedHours: number; airExpectedHours: number; missing?: string[] }[];
    hourly?: { at: string; temperatureC?: number; rainMm?: number; airDate: string; temperatureValid: boolean; rainValid: boolean }[];
    sources?: { id: string; provider: string; model: string; retrievedAt: string; sourceUrl: string }[];
    seasonalYears?: { year: number; temperatureMeanC?: number; rainMeanMm?: number; airDailyAqiMean?: number; weatherCoverage: number; airValidDays: number; airExpectedDays: number }[];
    yearOutlook?: { month: string; anomalyK: number; baselineDescription: string; scoreAdjusted: boolean };
  };
};
type ApiResponse = {
  requestId: string;
  scoringVersion: string;
  generatedAt: string;
  timezone: string;
  search: { kind: string; startDate: string; endDate: string; tripDays: number; mode: string };
  groups: { mode: string; status: string; items: Item[] }[];
  warnings: string[];
};
type Profile = {
  temperature: { minC: number; maxC: number; weight: number };
  rain: { preference: string; weight: number };
  air: { weight: number };
};

const defaultProfile: Profile = {
  temperature: { minC: 20, maxC: 26, weight: 2 },
  rain: { preference: "light", weight: 1 },
  air: { weight: 3 },
};

const statusNames: Record<string, string> = { matched: "ผ่านเงื่อนไข", incomplete: "ข้อมูลยังไม่ครบ", not_matched: "ไม่ตรงเงื่อนไข" };

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00+07:00`));
}

function shortDateRange(start: string, end: string) {
  const format = (date: string) => {
    const [, month, day] = date.split("-");
    return `${Number(day)}/${Number(month)}`;
  };
  return start === end ? format(start) : `${format(start)}–${format(end)}`;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileDraft, setProfileDraft] = useState<Profile>(defaultProfile);
  const [showLanding, setShowLanding] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [tripDays, setTripDays] = useState(2);
  const [period, setPeriod] = useState("all");
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Item["details"]>>({});
  const [capability, setCapability] = useState<{ minStartDate: string; maxEndDate: string } | null>(null);
  const [catalogPlaces, setCatalogPlaces] = useState<Place[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("wellness-profile");
      if (stored) {
        const parsed = JSON.parse(stored) as Profile;
        setProfile(parsed);
        setProfileDraft(parsed);
        setShowLanding(false);
      }
    } catch {
      window.localStorage.removeItem("wellness-profile");
    }
    fetch(`${API_BASE}/v1/capabilities`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("capabilities unavailable"))))
      .then((data) => setCapability(data.datePolicy))
      .catch(() => undefined);
    fetch(`${API_BASE}/v1/places`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("places unavailable"))))
      .then((data) => setCatalogPlaces(data.places ?? []))
      .catch(() => undefined);
  }, []);

  const dateBounds = useMemo(() => {
    const min = capability?.minStartDate ? dayjs(capability.minStartDate) : dayjs().add(1, "day");
    const max = capability?.maxEndDate ? dayjs(capability.maxEndDate) : dayjs().add(30, "day");
    return { min, max };
  }, [capability]);

  async function search() {
    if (!profile) {
      setShowProfile(true);
      setError("ตั้งค่าความชอบก่อนค้นหา แล้วระบบจะใช้ค่านี้ในการค้นหาครั้งต่อไป");
      return;
    }
    if (range && range[0] && range[1]) {
      const duration = range[1].diff(range[0], "day") + 1;
      if (duration > 30) {
        setError("ทริปยาวได้สูงสุด 30 วัน");
        return;
      }
    }
    setLoading(true);
    setError(null);
    setDetails({});
    try {
      const response = await fetch(`${API_BASE}/v1/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: range ? { startDate: range[0].format("YYYY-MM-DD"), endDate: range[1].format("YYYY-MM-DD") } : null,
          tripDays,
          period,
          preferences: profile,
          requirements: { placeType: "national_park" },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.code ?? "ค้นหาไม่สำเร็จ");
      setResults(data as ApiResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(item: Item, mode: string) {
    if (details[item.placeId]) return;
    setDetailLoading(item.placeId);
    try {
      const response = await fetch(`${API_BASE}/v1/recommendations/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: results?.search.kind === "vacation" ? { startDate: item.startDate, endDate: item.endDate } : null,
          tripDays: results?.search.tripDays ?? tripDays,
          period,
          preferences: profile,
          requirements: { placeType: "national_park" },
          placeId: item.placeId,
          selectedStartDate: mode === "forecast" ? item.startDate : "",
          selectedEndDate: mode === "forecast" ? item.endDate : "",
          mode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.code ?? "รายละเอียดไม่พร้อม");
      const found = payload.groups?.flatMap((group: ApiResponse["groups"][number]) => group.items).find((candidate: Item) => candidate.placeId === item.placeId);
      if (found?.details) setDetails((current) => ({ ...current, [item.placeId]: found.details }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "อ่านรายละเอียดไม่สำเร็จ");
    } finally {
      setDetailLoading(null);
    }
  }

  function saveProfile() {
    if (profileDraft.temperature.minC > profileDraft.temperature.maxC) {
      setError("อุณหภูมิต่ำสุดต้องไม่มากกว่าสูงสุด");
      return;
    }
    window.localStorage.setItem("wellness-profile", JSON.stringify(profileDraft));
    setProfile(profileDraft);
    setShowProfile(false);
    setShowLanding(false);
    setError(null);
  }

  function cancelProfile() {
    setProfileDraft(profile ?? defaultProfile);
    setShowProfile(false);
    setError(null);
  }

  if (showLanding) {
    return (
      <main className="landing-page">
        <div className="landing-copy">
          <p className="eyebrow">WELLNESS TRAVEL</p>
          <h1>ออกไปพักใจ<br /><em>ในวันที่ใช่สำหรับคุณ</em></h1>
          <p>ค้นพบธรรมชาติที่เข้ากับความชอบ โดยดูอุณหภูมิ ฝน และฝุ่นจากข้อมูลที่มีที่มา</p>
        </div>
        <div className="landing-postcard">
          <img src="/assets/mountains.svg" alt="ภาพวาดภูเขาสำหรับการพักผ่อน" />
          <span>Find your little escape.</span>
        </div>
        <Button type="primary" size="large" className="landing-button" onClick={() => setShowProfile(true)}>
          เริ่มต้นการเดินทาง <ArrowRightOutlined />
        </Button>
        <p className="landing-note">ใช้เวลาไม่ถึง 1 นาที · แก้ไขได้ทุกเมื่อ</p>
        {showProfile && <ProfilePanel draft={profileDraft} setDraft={setProfileDraft} onSave={saveProfile} onCancel={cancelProfile} />}
      </main>
    );
  }

  const activeGroup = results?.groups.find((group) => group.items.length > 0) ?? results?.groups[0];
  const resultGroups = results?.groups.filter((group) => group.items.length > 0) ?? [];
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><span>W</span><div><strong>Wellness Travel</strong><small>พักให้ตรงใจ</small></div></div>
        <Button className="profile-button" icon={<SettingOutlined />} onClick={() => { setProfileDraft(profile ?? defaultProfile); setShowProfile(true); }}>ความชอบ</Button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">A LITTLE CLOSER TO NATURE</p>
          <h1>วันว่างของคุณ<br /><em>ให้ธรรมชาติดูแล</em></h1>
          <p>หามุมพักใจ ในวันที่อากาศเป็นใจ<br />ตามความชอบในแบบของคุณ</p>
        </div>
        <img className="hero-art" src="/assets/mountains.svg" alt="ภาพวาดภูเขาประกอบบรรยากาศ" />
      </section>

      <section className="search-card" aria-label="ค้นหาสถานที่">
        <div className="section-kicker"><span>01</span><h2>กำหนดทริป</h2></div>
        <div className="search-grid">
          <div className="field field-wide">
            <label>วันเดินทาง <span>ไม่เลือกก็ได้</span></label>
            <RangePicker
              value={range}
              onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
              allowClear
              format="DD/MM/YYYY"
              placeholder={["วันไป", "วันกลับ"]}
              disabledDate={(current) => current.isBefore(dateBounds.min, "day") || current.isAfter(dateBounds.max, "day")}
              style={{ width: "100%" }}
            />
            {!range && <small className="field-help">ไม่เลือกวัน: ค้นหาช่วงดีที่สุดภายใน 30 วัน · เริ่มต้น {tripDays} วัน</small>}
          </div>
          <div className="field">
            <label>ความยาวทริป</label>
            <Select value={tripDays} onChange={setTripDays} options={Array.from({ length: 30 }, (_, i) => ({ value: i + 1, label: `${i + 1} วัน` }))} style={{ width: "100%" }} />
          </div>
          <div className="field">
            <label>ช่วงเวลาที่ชอบ</label>
            <Select value={period} onChange={setPeriod} options={[{ value: "all", label: "ทั้งวัน" }, { value: "day", label: "กลางวัน" }, { value: "night", label: "กลางคืน" }]} style={{ width: "100%" }} />
          </div>
        </div>
        <div className="search-footer">
          <div className="profile-chip"><span className="chip-dot" /> อากาศ {profile?.temperature.minC}–{profile?.temperature.maxC}°C · ฝน{profile?.rain.preference === "light" ? "เบา" : profile?.rain.preference === "moderate" ? "กลาง" : "น้อย"} · ฝุ่นตาม AQI</div>
          <Button type="primary" size="large" onClick={search} loading={loading} className="search-button">หาที่เที่ยวให้ฉัน <ArrowRightOutlined /></Button>
        </div>
      </section>

      {!results && <section className="inspiration-section" aria-label="แนวทางการพักผ่อน">
        <div className="section-heading"><h2>สถานที่แนะนำ</h2><small>ภาพประกอบแนวคิด<br />ยังไม่ใช่ผลตามความชอบ</small></div>
        <div className="inspiration-grid">
          <article className="inspiration-card"><img src="/assets/mountains.svg" alt="ภาพวาดภูเขา" /><div><small>01 / MOUNTAIN AIR</small><h3>เช้าท่ามกลางภูเขา</h3><small>ค่อย ๆ ใช้เวลา กับวิวตรงหน้า</small></div></article>
          <article className="inspiration-card"><img src="/assets/forest.svg" alt="ภาพวาดป่า" /><div><small>02 / FOREST SLOWDOWN</small><h3>พักในอ้อมกอดป่า</h3><small>วันธรรมดาที่มีธรรมชาติโอบไว้</small></div></article>
          <article className="inspiration-card"><img src="/assets/lake.svg" alt="ภาพวาดทิวเขาริมน้ำ" /><div><small>03 / QUIET MOMENTS</small><h3>ปล่อยใจให้ช้าลง</h3><small>เว้นที่ว่างให้วันพักผ่อน</small></div></article>
        </div>
        <p className="journal-note">จากวันที่คุณว่าง สู่สถานที่ที่เข้ากับคุณ — พร้อมเหตุผลเรื่องอากาศ ฝน และฝุ่น</p>
      </section>}

      {error && <Alert className="page-alert" type="warning" showIcon title={error} />}
      {loading && <div className="loading-state"><Spin /> <span>กำลังอ่านข้อมูลอากาศและจัดอันดับสถานที่…</span></div>}

      {results && !loading && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div><p className="eyebrow">02 / ผลลัพธ์จากข้อมูลจริง</p><h2>{results.search.kind === "flexible" ? "ช่วงที่เหมาะกับคุณ" : "สถานที่สำหรับทริปนี้"}</h2><p>{dateLabel(results.search.startDate)} – {dateLabel(results.search.endDate)} · {results.search.tripDays} วัน</p></div>
            <Tag color={activeGroup?.mode === "forecast" ? "blue" : "green"}>{activeGroup?.mode === "forecast" ? "Forecast" : "Seasonal"}</Tag>
          </div>
          <div className="results-layout">
            <div className="cards-grid">
              {resultGroups.map((group) => <ResultGroup group={group} details={details} detailLoading={detailLoading} onDetail={(item, mode) => loadDetail(item, mode)} key={`${group.mode}-${group.status}`} />)}
            </div>
            <MapPanel places={catalogPlaces.length > 0 ? catalogPlaces : resultGroups.flatMap((group) => group.items.map((item) => item.place))} />
          </div>
        </section>
      )}

      {showProfile && <ProfilePanel draft={profileDraft} setDraft={setProfileDraft} onSave={saveProfile} onCancel={cancelProfile} />}
      <footer className="footer-note">ข้อมูลสถานที่จากกรมอุทยานฯ · คะแนนและข้อจำกัดแสดงตามข้อมูลที่ตรวจสอบได้</footer>
    </main>
  );
}

function ProfilePanel({ draft, setDraft, onSave, onCancel }: { draft: Profile; setDraft: (p: Profile) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="panel-backdrop" role="dialog" aria-modal="true" aria-label="ตั้งค่าความชอบ">
      <div className="profile-panel">
        <p className="eyebrow">ตั้งครั้งเดียว ใช้ค้นหาครั้งต่อไป</p>
        <h2>ความชอบของฉัน</h2>
        <p className="panel-intro">บอกสภาพที่ทำให้คุณพักได้เต็มที่ ระบบจะใช้ค่านี้จัดอันดับทุกครั้ง</p>
        <Form layout="vertical">
          <Form.Item label="อุณหภูมิที่สบาย (°C)">
            <div className="inline-fields"><InputNumber min={-10} max={50} value={draft.temperature.minC} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, minC: Number(v ?? 0) } })} /><span>ถึง</span><InputNumber min={-10} max={50} value={draft.temperature.maxC} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, maxC: Number(v ?? 0) } })} /></div>
          </Form.Item>
          <Form.Item label="ฝนที่ยอมรับได้">
            <Select value={draft.rain.preference} onChange={(v) => setDraft({ ...draft, rain: { ...draft.rain, preference: v } })} options={[{ value: "dry", label: "ไม่ชอบฝน" }, { value: "light", label: "ฝนเบาได้" }, { value: "moderate", label: "ฝนปานกลางได้" }]} />
          </Form.Item>
          <Form.Item label="น้ำหนักความสำคัญ">
            <div className="weight-row"><label>อุณหภูมิ <Select value={draft.temperature.weight} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label><label>ฝน <Select value={draft.rain.weight} onChange={(v) => setDraft({ ...draft, rain: { ...draft.rain, weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label><label>ฝุ่น <Select value={draft.air.weight} onChange={(v) => setDraft({ ...draft, air: { weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label></div>
          </Form.Item>
        </Form>
        <div className="panel-actions"><Button onClick={onCancel}>ยกเลิก</Button><Button type="primary" onClick={onSave}>ใช้ความชอบนี้</Button></div>
      </div>
    </div>
  );
}

function PlaceCard({ item, index, status, mode, detail, detailLoading, onDetail }: { item: Item; index: number; status: string; mode: string; detail?: Item["details"]; detailLoading: boolean; onDetail: () => void }) {
  return (
    <article className="place-card" data-place-id={item.placeId} data-status={status}>
      <img className="place-art" src={index % 3 === 0 ? "/assets/mountains.svg" : index % 3 === 1 ? "/assets/forest.svg" : "/assets/lake.svg"} alt="" aria-hidden="true" />
      <button type="button" className="place-card-button" onClick={onDetail} disabled={detailLoading}>
        <span className="place-title"><strong>{item.place.name}</strong></span>
        <span className="place-window">{shortDateRange(item.startDate, item.endDate)}</span>
        <span className="metric-list">
          <span className="metric metric-temperature" title="อุณหภูมิเฉลี่ย"><strong>{item.metrics?.temperatureC == null ? "—" : `${item.metrics.temperatureC.toFixed(1)}°`}</strong><DashboardOutlined aria-hidden="true" /></span>
          <span className="metric metric-rain" title="ฝนเฉลี่ยต่อชั่วโมง"><strong>{item.metrics?.rainMmPerHour == null ? "—" : `${item.metrics.rainMmPerHour.toFixed(2)} mm`}</strong><CloudOutlined aria-hidden="true" /></span>
          <span className="metric metric-air" title="US AQI จาก PM2.5 เฉลี่ยวัน"><strong>{item.metrics?.usAqiPm25 == null ? "—" : `AQI ${item.metrics.usAqiPm25}`}</strong><ExperimentOutlined aria-hidden="true" /></span>
        </span>
      </button>
      {detail && <div className="place-detail"><DetailSummary item={item} status={status} detail={detail} mode={mode} /></div>}
    </article>
  );
}

function ResultGroup({ group, details, detailLoading, onDetail }: { group: { mode: string; status: string; items: Item[] }; details: Record<string, Item["details"]>; detailLoading: string | null; onDetail: (item: Item, mode: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(9);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (visibleCount >= group.items.length || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => Math.min(count + 9, group.items.length));
    }, { rootMargin: "320px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [group.items.length, visibleCount]);
  const visibleItems = group.items.slice(0, visibleCount);
  return <div className="result-group">
    <div className="result-group-heading"><h3>{statusNames[group.status] ?? group.status}</h3><span>{group.items.length} แห่ง</span></div>
    <div className="group-cards">{visibleItems.map((item, index) => <PlaceCard item={item} index={index} status={group.status} mode={group.mode} detail={details[item.placeId]} detailLoading={detailLoading === item.placeId} onDetail={() => onDetail(item, group.mode)} key={`${group.status}-${item.placeId}`} />)}</div>
    {visibleCount < group.items.length && <div ref={sentinelRef} className="lazy-sentinel" aria-label="กำลังเตรียมสถานที่เพิ่มเติม">เลื่อนลงเพื่อดูสถานที่เพิ่มเติม</div>}
  </div>;
}

function MapPanel({ places }: { places: Place[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const uniquePlaces = Array.from(new Map(places.map((place) => [place.id, place])).values());
  const placeKey = uniquePlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");
  useEffect(() => {
    let disposed = false;
    setMapError(false);
    import("maplibre-gl").then(({ Map, Marker, NavigationControl, Popup }) => {
      if (disposed || !mapContainerRef.current) return;
      const map = new Map({ container: mapContainerRef.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [100.5, 13.7], zoom: 5 });
      map.addControl(new NavigationControl(), "top-right");
      map.on("error", () => setMapError(true));
      uniquePlaces.forEach((place) => {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "map-marker";
        marker.setAttribute("aria-label", `ดู ${place.name}`);
        marker.title = place.name;
        new Marker({ element: marker, anchor: "bottom" }).setLngLat([place.longitude, place.latitude]).setPopup(new Popup({ offset: 18 }).setText(place.name)).addTo(map);
      });
      mapRef.current = map;
      map.once("load", () => map.resize());
    }).catch(() => setMapError(true));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [placeKey]);
  return <div className="map-panel">
    <div className="map-heading"><div><p className="eyebrow">03 / ภาพรวมพื้นที่</p><h3>24 จุดหมายธรรมชาติ</h3></div><EnvironmentOutlined /></div>
    <div ref={mapContainerRef} className="map-canvas" aria-label="แผนที่ MapLibre จุดหมายประเทศไทย" />
    {mapError && <Alert className="map-alert" type="warning" showIcon title="แผนที่โหลดไม่สำเร็จ" description="รายการสถานที่ยังใช้งานได้ ตรวจพิกัดได้จากรายการด้านล่าง" />}
    <p className="map-credit">MapLibre GL JS · แผนที่ OpenFreeMap © OpenMapTiles © OpenStreetMap · หมุดคือพิกัดอ้างอิงจาก DNP</p>
    <div className="map-place-list" aria-label="รายการจุดอ้างอิงจาก catalog">
      {uniquePlaces.map((place) => <div className="map-place" data-place-id={place.id} key={place.id}><span>{place.name}</span><small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></div>)}
    </div>
  </div>;
}

function DetailSummary({ item, status, detail, mode }: { item: Item; status: string; detail: Item["details"]; mode: string }) {
  if (!detail) return null;
  return <div className="detail-summary">
    <strong>สถานะ: {statusNames[status] ?? status}</strong>
    <span>coverage {Math.round(item.coverage.observedWeightedRatio * 100)}%</span>
    {mode === "forecast" && <><strong>รายละเอียด Forecast</strong><span>{detail.daily?.length ?? 0} วัน · {detail.hourly?.length ?? 0} ชั่วโมง</span></>}
    {mode === "seasonal" && <><strong>ปีที่ใช้คำนวณ Seasonal</strong><span>{detail.seasonalYears?.length ?? 0} ปี</span></>}
    {detail.yearOutlook && <span>SEAS5: {detail.yearOutlook.baselineDescription} ({detail.yearOutlook.anomalyK > 0 ? "+" : ""}{detail.yearOutlook.anomalyK.toFixed(1)}K)</span>}
    {mode === "forecast" && detail.daily && <div className="detail-days">{detail.daily.map((day) => <div className="detail-day" key={day.date}><b>{dateLabel(day.date)}</b><span>{day.temperatureMeanC == null ? "อุณหภูมิ —" : `อุณหภูมิ ${day.temperatureMeanC.toFixed(1)}°C`}</span><span>{day.rainMeanMm == null ? "ฝน —" : `ฝน ${day.rainMeanMm.toFixed(2)} mm/h`}</span><span>{day.usAqiPm25 == null ? "AQI —" : `AQI ${day.usAqiPm25}`}</span></div>)}</div>}
    {mode === "forecast" && detail.hourly && <details className="detail-hourly"><summary>ดูข้อมูลรายชั่วโมง ({detail.hourly.length})</summary><div className="hourly-list">{detail.hourly.map((hour) => <span key={hour.at}>{new Date(hour.at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" })} · {hour.temperatureC == null ? "อุณหภูมิ —" : `${hour.temperatureC.toFixed(1)}°C`} · {hour.rainMm == null ? "ฝน —" : `${hour.rainMm.toFixed(2)} mm`}</span>)}</div></details>}
    {item.reasons.length > 0 && <p className="detail-reasons">เหตุผล: {item.reasons.map((reason) => reason.message ?? reason.code).join(" ")}</p>}
    <small>แหล่งข้อมูล: {detail.sources?.map((source) => source.provider).join(", ") || "—"} · dataset: {item.sourceIds.join(", ") || "—"}</small>
    <a href={item.place.sourceUrl} target="_blank" rel="noreferrer">แหล่งข้อมูลสถานที่ DNP ↗</a>
  </div>;
}
