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
  tripDays: number;
  temperature: { minC: number; maxC: number; weight: number };
  rain: { preference: string; weight: number };
  air: { weight: number };
};

const defaultProfile: Profile = {
  tripDays: 2,
  temperature: { minC: 20, maxC: 26, weight: 2 },
  rain: { preference: "light", weight: 1 },
  air: { weight: 3 },
};

const statusNames: Record<string, string> = { matched: "ผ่านเงื่อนไขและข้อมูลครบ", incomplete: "ข้อมูลยังไม่ครบ", not_matched: "ไม่ตรงเงื่อนไข" };

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
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedPlaceId, setFocusedPlaceId] = useState<string | null>(null);
  const [capability, setCapability] = useState<{ minStartDate: string; maxEndDate: string } | null>(null);
  const [catalogPlaces, setCatalogPlaces] = useState<Place[]>([]);
  const [homeItems, setHomeItems] = useState<Item[]>([]);
  const [homeLoading, setHomeLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("wellness-profile");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Profile>;
        const normalized: Profile = {
          ...defaultProfile,
          ...parsed,
          tripDays: Number.isFinite(parsed.tripDays) ? Math.min(30, Math.max(1, Number(parsed.tripDays))) : defaultProfile.tripDays,
          temperature: { ...defaultProfile.temperature, ...(parsed.temperature ?? {}) },
          rain: { ...defaultProfile.rain, ...(parsed.rain ?? {}) },
          air: { ...defaultProfile.air, ...(parsed.air ?? {}) },
        };
        setProfile(normalized);
        setProfileDraft(normalized);
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

  useEffect(() => {
    if (!profile) {
      setHomeItems([]);
      return;
    }
    let cancelled = false;
    setHomeLoading(true);
    fetch(`${API_BASE}/v1/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dates: null,
        tripDays: profile.tripDays,
        period: "day",
        preferences: { temperature: profile.temperature, rain: profile.rain, air: profile.air },
        requirements: { placeType: "national_park" },
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("home recommendations unavailable"))))
      .then((data: ApiResponse) => {
        if (cancelled) return;
        const ranked = (data.groups ?? []).flatMap((group) => group.items ?? []).filter((item) => item.place?.placeType === "national_park").sort((a, b) => {
          if (a.score == null && b.score == null) return a.placeId.localeCompare(b.placeId);
          if (a.score == null) return 1;
          if (b.score == null) return -1;
          return b.score - a.score || a.placeId.localeCompare(b.placeId);
        });
        setHomeItems(ranked.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setHomeItems([]);
      })
      .finally(() => {
        if (!cancelled) setHomeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

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
    setFocusedPlaceId(null);
    try {
      const response = await fetch(`${API_BASE}/v1/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: range ? { startDate: range[0].format("YYYY-MM-DD"), endDate: range[1].format("YYYY-MM-DD") } : null,
          tripDays: profile.tripDays,
          period: "all",
          preferences: { temperature: profile.temperature, rain: profile.rain, air: profile.air },
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
        <p>ค้นพบธรรมชาติในแบบของคุณ<br />ให้อากาศที่ดีเป็นส่วนหนึ่งของวันพักผ่อน</p>
        </div>
        <div className="landing-postcard">
          <img src="/assets/mountains.svg" alt="ภาพวาดภูเขาสำหรับการพักผ่อน" />
          <span>Find your little escape.</span>
        </div>
        <Button type="primary" size="large" className="landing-button" onClick={() => setShowProfile(true)}>
          เริ่มต้นการเดินทาง <ArrowRightOutlined />
        </Button>
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
        <div className="search-grid">
          <div className="field field-wide">
            <RangePicker
              value={range}
              onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
              allowClear
              size="large"
              format="DD/MM/YYYY"
              placeholder={["วันไป", "วันกลับ"]}
              aria-label="วันไปและวันกลับ ไม่จำเป็นต้องเลือก"
              disabledDate={(current) => current.isBefore(dateBounds.min, "day") || current.isAfter(dateBounds.max, "day")}
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div className="search-footer">
          <div className="profile-chip"><span className="chip-dot" /> อากาศ {profile?.temperature.minC}–{profile?.temperature.maxC}°C · ฝน{profile?.rain.preference === "light" ? "เบา" : profile?.rain.preference === "moderate" ? "กลาง" : "น้อย"} · ฝุ่นตาม AQI</div>
          <Button type="primary" size="large" onClick={search} loading={loading} className="search-button">หาที่เที่ยวให้ฉัน <ArrowRightOutlined /></Button>
        </div>
      </section>

      {!results && <section className="inspiration-section" aria-label="สถานที่แนะนำ">
        <div className="section-heading"><h2>สถานที่แนะนำ</h2><small>{homeLoading ? "กำลังจัดอันดับ…" : "6 อันดับแรก · คะแนนกลางวัน"}</small></div>
        {homeLoading && <div className="home-recommendation-loading"><Spin /> <span>กำลังจัดอันดับสถานที่ตามความชอบของคุณ…</span></div>}
        {!homeLoading && homeItems.length > 0 && <div className="inspiration-grid">
          {homeItems.map((item, index) => <HomeRecommendationCard item={item} index={index} key={item.placeId} />)}
        </div>}
        {!homeLoading && homeItems.length === 0 && <p className="journal-note">กดค้นหาเพื่อดูสถานที่ที่ตรงกับความชอบของคุณ</p>}
      </section>}

      {error && <Alert className="page-alert" type="warning" showIcon title={error} />}
      {loading && <div className="loading-state"><Spin /> <span>กำลังอ่านข้อมูลอากาศและจัดอันดับสถานที่…</span></div>}

      {results && !loading && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div><h2>{results.search.kind === "flexible" ? "ช่วงที่เหมาะกับคุณ" : "สถานที่สำหรับทริปนี้"}</h2><p>{dateLabel(results.search.startDate)} – {dateLabel(results.search.endDate)} · {results.search.tripDays} วัน</p></div>
            <Tag color={activeGroup?.mode === "forecast" ? "blue" : "green"}>{activeGroup?.mode === "forecast" ? "Forecast" : "Seasonal"}</Tag>
          </div>
          <div className="results-layout">
            <div className="cards-grid">
              {resultGroups.map((group) => <ResultGroup group={group} onSelectPlace={(place) => setFocusedPlaceId(place.id)} key={`${group.mode}-${group.status}`} />)}
            </div>
            <MapPanel places={catalogPlaces.length > 0 ? catalogPlaces : resultGroups.flatMap((group) => group.items.map((item) => item.place))} focusPlaceId={focusedPlaceId} onFocusPlace={setFocusedPlaceId} />
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
          <Form.Item label="ระยะทริปเมื่อไม่เลือกวัน">
            <Select size="large" value={draft.tripDays} onChange={(v) => setDraft({ ...draft, tripDays: v })} options={Array.from({ length: 30 }, (_, index) => index + 1).map((v) => ({ value: v, label: `${v} วัน` }))} />
          </Form.Item>
          <Form.Item label="อุณหภูมิที่สบาย (°C)">
            <div className="inline-fields"><InputNumber size="large" min={-10} max={50} value={draft.temperature.minC} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, minC: Number(v ?? 0) } })} /><span>ถึง</span><InputNumber size="large" min={-10} max={50} value={draft.temperature.maxC} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, maxC: Number(v ?? 0) } })} /></div>
          </Form.Item>
          <Form.Item label="ฝนที่ยอมรับได้">
            <Select size="large" value={draft.rain.preference} onChange={(v) => setDraft({ ...draft, rain: { ...draft.rain, preference: v } })} options={[{ value: "dry", label: "ไม่ชอบฝน" }, { value: "light", label: "ฝนเบาได้" }, { value: "moderate", label: "ฝนปานกลางได้" }]} />
          </Form.Item>
          <Form.Item label="น้ำหนักความสำคัญ">
            <div className="weight-row"><label>อุณหภูมิ <Select size="large" value={draft.temperature.weight} onChange={(v) => setDraft({ ...draft, temperature: { ...draft.temperature, weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label><label>ฝน <Select size="large" value={draft.rain.weight} onChange={(v) => setDraft({ ...draft, rain: { ...draft.rain, weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label><label>ฝุ่น <Select size="large" value={draft.air.weight} onChange={(v) => setDraft({ ...draft, air: { weight: v } })} options={[1, 2, 3].map((v) => ({ value: v, label: `${v}` }))} /></label></div>
          </Form.Item>
        </Form>
        <div className="panel-actions"><Button onClick={onCancel}>ยกเลิก</Button><Button type="primary" onClick={onSave}>ใช้ความชอบนี้</Button></div>
      </div>
    </div>
  );
}

function PlaceCard({ item, index, onSelectPlace }: { item: Item; index: number; onSelectPlace: (place: Place) => void }) {
  const image = index % 3 === 0 ? "/assets/mountains.svg" : index % 3 === 1 ? "/assets/forest.svg" : "/assets/lake.svg";
  return (
    <article className="place-card" data-place-id={item.placeId}>
      <div className="place-art-frame">
        <img className="place-art" src={image} alt="" aria-hidden="true" />
        <div className="metric-list place-overlay" aria-label="สรุปสภาพอากาศ">
          <span className="metric metric-temperature" title="อุณหภูมิเฉลี่ย"><strong>{item.metrics?.temperatureC == null ? "—" : `${item.metrics.temperatureC.toFixed(1)}°`}</strong><DashboardOutlined aria-hidden="true" /></span>
          <span className="metric metric-rain" title="ฝนเฉลี่ยต่อชั่วโมง"><strong>{item.metrics?.rainMmPerHour == null ? "—" : `${item.metrics.rainMmPerHour.toFixed(2)} mm`}</strong><CloudOutlined aria-hidden="true" /></span>
          <span className="metric metric-air" title="US AQI จาก PM2.5 เฉลี่ยวัน"><strong>{item.metrics?.usAqiPm25 == null ? "—" : `AQI ${item.metrics.usAqiPm25}`}</strong><ExperimentOutlined aria-hidden="true" /></span>
        </div>
      </div>
      <button type="button" className="place-card-button" onClick={() => onSelectPlace(item.place)} aria-label={`ดู ${item.place.name} บนแผนที่`}>
        <span className="place-title"><strong>{item.place.name}</strong></span>
        <span className="place-window">{shortDateRange(item.startDate, item.endDate)}</span>
      </button>
    </article>
  );
}

function HomeRecommendationCard({ item, index }: { item: Item; index: number }) {
  const image = index % 3 === 0 ? "/assets/mountains.svg" : index % 3 === 1 ? "/assets/forest.svg" : "/assets/lake.svg";
  return (
    <article className="inspiration-card home-recommendation-card">
      <img src={image} alt="" aria-hidden="true" />
      <div>
        <small>อันดับ {index + 1} · คะแนนกลางวัน {item.score == null ? "—" : item.score.toFixed(1)}</small>
        <h3>{item.place.name}</h3>
        <small>{shortDateRange(item.startDate, item.endDate)} · {item.place.province}</small>
      </div>
    </article>
  );
}

function ResultGroup({ group, onSelectPlace }: { group: { mode: string; status: string; items: Item[] }; onSelectPlace: (place: Place) => void }) {
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
    <div className="group-cards">{visibleItems.map((item, index) => <PlaceCard item={item} index={index} onSelectPlace={onSelectPlace} key={`${group.status}-${item.placeId}`} />)}</div>
    {visibleCount < group.items.length && <div ref={sentinelRef} className="lazy-sentinel" aria-label="กำลังเตรียมสถานที่เพิ่มเติม">เลื่อนลงเพื่อดูสถานที่เพิ่มเติม</div>}
  </div>;
}

function MapPanel({ places, focusPlaceId, onFocusPlace }: { places: Place[]; focusPlaceId: string | null; onFocusPlace: (placeId: string) => void }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const uniquePlaces = Array.from(new Map(places.map((place) => [place.id, place])).values());
  const placeKey = uniquePlaces.map((place) => `${place.id}:${place.latitude}:${place.longitude}`).join("|");
  useEffect(() => {
    let disposed = false;
    setMapError(false);
    setMapReady(false);
    import("maplibre-gl").then(({ Map, Marker, NavigationControl, Popup }) => {
      if (disposed || !mapContainerRef.current) return;
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      const map = new Map({ container: mapContainerRef.current, style: "https://tiles.openfreemap.org/styles/liberty", center: [100.5, 13.7], zoom: 5 });
      if (!isMobile) {
        map.addControl(new NavigationControl(), "top-right");
      } else {
        map.dragPan.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
      }
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
      map.once("load", () => {
        map.resize();
        setMapReady(true);
      });
    }).catch(() => setMapError(true));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [placeKey]);
  useEffect(() => {
    const place = uniquePlaces.find((candidate) => candidate.id === focusPlaceId);
    const map = mapRef.current;
    if (!place || !map || !mapReady) return;
    mapContainerRef.current?.setAttribute("data-map-center", `${place.latitude},${place.longitude}`);
    map.flyTo({ center: [place.longitude, place.latitude], zoom: map.getZoom(), essential: true });
  }, [focusPlaceId, mapReady, placeKey]);
  return <div className="map-panel" data-focused-place-id={focusPlaceId ?? undefined}>
    <div className="map-heading"><div><h3>24 จุดหมายธรรมชาติ</h3></div><EnvironmentOutlined /></div>
    <div ref={mapContainerRef} className="map-canvas" aria-label="แผนที่จุดหมายประเทศไทย" />
    {mapError && <Alert className="map-alert" type="warning" showIcon title="แผนที่โหลดไม่สำเร็จ" description="รายการสถานที่ยังใช้งานได้ ตรวจพิกัดได้จากรายการด้านล่าง" />}
    <div className="map-place-list" aria-label="รายการจุดอ้างอิงจาก catalog">
      {uniquePlaces.map((place) => <button type="button" className="map-place" data-place-id={place.id} onClick={() => onFocusPlace(place.id)} aria-label={`โฟกัส ${place.name} บนแผนที่`} key={place.id}><span>{place.name}</span><small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></button>)}
    </div>
  </div>;
}
