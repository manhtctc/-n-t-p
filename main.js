/* =============================================
   SAFEWEATHER – MAIN.JS v3.0
   Dual API: Open-Meteo + OpenWeatherMap
   GPS Fast (cache-first + background refine)
   Map: OpenStreetMap (màu gốc)
   ============================================= */
"use strict";

const CONFIG = {
  OWM_KEY: "6770fd12ffcb99fa9f49528d53191343",
  OWM_BASE: "https://api.openweathermap.org/data/2.5",
  GEO_BASE: "https://api.openweathermap.org/geo/1.0",
  METEO_BASE: "https://api.open-meteo.com/v1",
  UPDATE_INT: 300_000,
  CACHE_TTL: 300_000,
};

const CACHE_KEY = "sw_weather_v3";

// ============================================================
// WMO CODES
// ============================================================
const WMO = {
  0: { desc: "Trời quang đãng", icon: "☀️" },
  1: { desc: "Chủ yếu quang đãng", icon: "🌤" },
  2: { desc: "Có mây một phần", icon: "⛅" },
  3: { desc: "Nhiều mây", icon: "☁️" },
  45: { desc: "Sương mù", icon: "🌫" },
  48: { desc: "Sương mù đóng băng", icon: "🌫" },
  51: { desc: "Mưa phùn nhẹ", icon: "🌦" },
  53: { desc: "Mưa phùn vừa", icon: "🌦" },
  55: { desc: "Mưa phùn dày", icon: "🌧" },
  61: { desc: "Mưa nhẹ", icon: "🌧" },
  63: { desc: "Mưa vừa", icon: "🌧" },
  65: { desc: "Mưa to", icon: "🌧" },
  71: { desc: "Tuyết nhẹ", icon: "❄️" },
  73: { desc: "Tuyết vừa", icon: "❄️" },
  75: { desc: "Tuyết dày", icon: "❄️" },
  80: { desc: "Mưa rào nhẹ", icon: "🌦" },
  81: { desc: "Mưa rào vừa", icon: "🌧" },
  82: { desc: "Mưa rào mạnh", icon: "🌧" },
  95: { desc: "Dông bão", icon: "⛈" },
  96: { desc: "Dông mưa đá nhỏ", icon: "⛈" },
  99: { desc: "Dông mưa đá lớn", icon: "⛈" },
};
function wmo(code) {
  return WMO[code] || { desc: "Không xác định", icon: "🌤" };
}

const OWM_ICONS = {
  "01d": "☀️",
  "01n": "🌙",
  "02d": "⛅",
  "02n": "⛅",
  "03d": "☁️",
  "03n": "☁️",
  "04d": "☁️",
  "04n": "☁️",
  "09d": "🌧",
  "09n": "🌧",
  "10d": "🌦",
  "10n": "🌧",
  "11d": "⛈",
  "11n": "⛈",
  "13d": "❄️",
  "13n": "❄️",
  "50d": "🌫",
  "50n": "🌫",
};
function owmIcon(c) {
  return OWM_ICONS[c] || "🌤";
}

// ============================================================
// STATE
// ============================================================
const STATE = {
  lat: null,
  lon: null,
  cityName: "",
  owmData: null,
  owmForecast: null,
  meteoData: null,
  meteoDailyData: null,
  merged: {
    temp: null,
    feelsLike: null,
    humidity: null,
    windSpeed: null,
    windDeg: null,
    pressure: null,
    visibility: null,
    weatherCode: null,
    weatherDesc: null,
    weatherIcon: null,
    sunrise: null,
    sunset: null,
    todayMax: null,
    todayMin: null,
    todayRain: null,
    todayWind: null,
    source: "none",
  },
  alertLevel: "safe",
  myStatus: null,
  sharing: false,
  shareInterval: null,
  map: null,
  myMarker: null,
  weatherLayer: false,
  hourlyChart: null,
  alertLog: [],
  _lastAccuracy: 9999,
  familyMembers: [
    {
      id: 1,
      name: "Bố",
      emoji: "👴",
      lat: 21.03,
      lon: 105.84,
      status: "safe",
      lastSeen: "2 phút trước",
      city: "Hoàn Kiếm, Hà Nội",
    },
    {
      id: 2,
      name: "Mẹ",
      emoji: "👩",
      lat: 21.04,
      lon: 105.85,
      status: "safe",
      lastSeen: "5 phút trước",
      city: "Đống Đa, Hà Nội",
    },
    {
      id: 3,
      name: "Em gái",
      emoji: "👧",
      lat: 21.02,
      lon: 105.82,
      status: "unknown",
      lastSeen: "30 phút trước",
      city: "Cầu Giấy, Hà Nội",
    },
  ],
};

// ============================================================
// UTILS
// ============================================================
function avg(...vals) {
  const v = vals.filter((x) => x !== null && x !== undefined && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function round(v, d = 1) {
  return v !== null ? +v.toFixed(d) : null;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== null) el.textContent = val;
}
function windDir(deg) {
  const d = [
    "Bắc",
    "Đông Bắc",
    "Đông",
    "Đông Nam",
    "Nam",
    "Tây Nam",
    "Tây",
    "Tây Bắc",
  ];
  return d[Math.round((deg || 0) / 45) % 8];
}
function fmtTime(unix) {
  return new Date(unix * 1000).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtHour(unix) {
  return new Date(unix * 1000).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fmtDay(unix) {
  return new Date(unix * 1000).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  });
}
function fmtDayS(str) {
  return new Date(str).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}
function sourceBadge(s) {
  if (s === "both")
    return `<span style="background:rgba(0,230,118,.15);color:#00e676;border:1px solid rgba(0,230,118,.3);border-radius:4px;padding:2px 8px;font-size:.7rem;margin-left:8px">✅ 2 nguồn</span>`;
  if (s === "owm")
    return `<span style="background:rgba(255,179,0,.15);color:#ffb300;border:1px solid rgba(255,179,0,.3);border-radius:4px;padding:2px 8px;font-size:.7rem;margin-left:8px">OWM</span>`;
  if (s === "meteo")
    return `<span style="background:rgba(0,212,255,.15);color:#00d4ff;border:1px solid rgba(0,212,255,.3);border-radius:4px;padding:2px 8px;font-size:.7rem;margin-left:8px">Open-Meteo</span>`;
  return "";
}

// ============================================================
// CLOCK
// ============================================================
function startClock() {
  function tick() {
    const n = new Date(),
      h = String(n.getHours()).padStart(2, "0"),
      m = String(n.getMinutes()).padStart(2, "0"),
      s = String(n.getSeconds()).padStart(2, "0");
    const el = document.getElementById("live-clock");
    if (el) el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ============================================================
// GPS — cache-first, nhanh, cải thiện ngầm
// ============================================================
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 21.0285, lon: 105.8542, accuracy: null });
      return;
    }
    let resolved = false;
    // Thử GPS cache 30s trước — cực nhanh
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        if (!resolved) {
          resolved = true;
          resolve({ lat: 21.0285, lon: 105.8542, accuracy: null });
        }
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 30000 },
    );
    // Đồng thời watch GPS chính xác ngầm
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        if (!resolved) {
          resolved = true;
          navigator.geolocation.clearWatch(watchId);
          resolve({ lat, lon, accuracy });
          return;
        }
        if (accuracy <= 50 && accuracy < STATE._lastAccuracy) {
          STATE._lastAccuracy = accuracy;
          STATE.lat = lat;
          STATE.lon = lon;
          navigator.geolocation.clearWatch(watchId);
          if (STATE.map && STATE.myMarker) STATE.myMarker.setLatLng([lat, lon]);
          reverseGeocode(lat, lon).then((city) => {
            STATE.cityName = city;
            setText("city-name", city);
            updateMapPanel();
          });
        }
      },
      (err) => console.warn("GPS watch:", err.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
    setTimeout(() => navigator.geolocation.clearWatch(watchId), 15000);
  });
}

// ============================================================
// REVERSE GEOCODING
// ============================================================
async function reverseGeocode(lat, lon) {
  try {
    // Nominatim (OpenStreetMap) — trả về tên đường + phường + quận chi tiết
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi&addressdetails=1`,
      { headers: { "User-Agent": "SafeWeather/3.0" } },
    );
    if (!res.ok) throw new Error("Nominatim error");
    const data = await res.json();
    const a = data.address || {};
    const road = a.road || a.pedestrian || a.footway || a.path || "";
    const houseNumber = a.house_number ? `${a.house_number} ` : "";
    const ward = a.suburb || a.quarter || a.neighbourhood || a.village || "";
    const district = a.city_district || a.district || a.county || "";
    const city = a.city || a.town || a.state || "";
    STATE.addressDetail = {
      road: road ? `${houseNumber}${road}` : "",
      ward,
      district,
      city,
      full: [road ? `${houseNumber}${road}` : "", ward, district, city]
        .filter(Boolean)
        .join(", "),
    };
    updateLocationDisplay();
    return [district, city].filter(Boolean).join(", ") || "Vị trí của bạn";
  } catch (e) {
    console.warn("Nominatim lỗi, fallback OWM:", e.message);
    try {
      const res = await fetch(
        `${CONFIG.GEO_BASE}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${CONFIG.OWM_KEY}`,
      );
      if (!res.ok) return "Vị trí của bạn";
      const data = await res.json();
      if (data.length > 0) {
        const d = data[0];
        return [d.local_names?.vi || d.name, d.state, "Việt Nam"]
          .filter(Boolean)
          .join(", ");
      }
    } catch {}
    return "Vị trí của bạn";
  }
}

function updateLocationDisplay() {
  const a = STATE.addressDetail;
  if (!a) return;
  const cityName = [a.district, a.city].filter(Boolean).join(", ");
  if (cityName) {
    setText("city-name", cityName);
    STATE.cityName = cityName;
  }

  // Tách số nhà và tên đường để hiển thị riêng
  const roadEl = document.getElementById("map-loc-road");
  if (roadEl) {
    if (a.road) {
      // Highlight số nhà nếu có
      const parts = a.road.match(/^(\d+[\w\/]*)\s+(.+)$/);
      if (parts) {
        roadEl.innerHTML = `<span style="background:rgba(0,212,255,.15);color:#00d4ff;border:1px solid rgba(0,212,255,.3);border-radius:4px;padding:1px 7px;font-family:'Orbitron',monospace;font-size:.75rem;font-weight:700;margin-right:6px">Số ${parts[1]}</span><span>${parts[2]}</span>`;
      } else {
        roadEl.textContent = a.road;
      }
    } else {
      roadEl.textContent = "—";
    }
  }

  setText(
    "map-loc-district",
    [a.ward, a.district, a.city].filter(Boolean).join(", ") || "—",
  );
  if (STATE.lat)
    setText(
      "map-loc-coords",
      `${STATE.lat.toFixed(5)}, ${STATE.lon.toFixed(5)}`,
    );

  // Cập nhật popup bản đồ
  if (STATE.myMarker) {
    const roadParts = a.road?.match(/^(\d+[\w\/]*)\s+(.+)$/);
    const roadHtml = a.road
      ? roadParts
        ? `<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
            <span style="background:#00d4ff;color:#000;border-radius:3px;padding:1px 5px;font-size:.68rem;font-weight:800;white-space:nowrap">Số ${roadParts[1]}</span>
            <span style="color:#e8f4ff;font-size:.8rem;font-weight:600">${roadParts[2]}</span>
           </div>`
        : `<div style="color:#e8f4ff;font-size:.8rem;font-weight:600;margin-bottom:3px">${a.road}</div>`
      : "";
    STATE.myMarker.setPopupContent(`
      <div style="font-family:'Exo 2',sans-serif;background:#0b1628;color:#e8f4ff;padding:10px 12px;border-radius:8px;min-width:180px;max-width:240px">
        <div style="color:#00d4ff;font-weight:700;font-size:.8rem;letter-spacing:.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #1a2f50">📍 Vị trí của bạn</div>
        ${roadHtml}
        <div style="font-size:.75rem;color:#7a9cc0;margin-top:2px">${[a.ward, a.district].filter(Boolean).join(" · ")}</div>
        ${a.city ? `<div style="font-size:.72rem;color:#3d5a7a">${a.city}</div>` : ""}
        <div style="font-size:.65rem;color:#3d5a7a;margin-top:6px;font-family:monospace;border-top:1px solid #1a2f50;padding-top:5px">${STATE.lat?.toFixed(6)}, ${STATE.lon?.toFixed(6)}</div>
      </div>`);
  }
}

// ============================================================
// CACHE
// ============================================================
function saveCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        owmData: data.owmData,
        owmForecast: data.owmForecast,
        meteoData: data.meteoData,
        meteoDailyData: data.meteoDailyData,
        cityName: data.cityName,
      }),
    );
  } catch (e) {}
}
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    const age = Date.now() - cache.ts;
    if (age < CONFIG.CACHE_TTL) {
      console.log(`⚡ Cache hit ${Math.round(age / 1000)}s`);
      return cache;
    }
    return { ...cache, stale: true };
  } catch {
    return null;
  }
}
function applyCache(cache) {
  STATE.owmData = cache.owmData;
  STATE.owmForecast = cache.owmForecast;
  STATE.meteoData = cache.meteoData;
  STATE.meteoDailyData = cache.meteoDailyData;
  STATE.cityName = cache.cityName || "";
  mergeWeatherData();
  renderAll();
  setText("last-update", `⚡ Cache ${cache.stale ? "(đang cập nhật...)" : ""}`);
}

// ============================================================
// FETCH APIs
// ============================================================
async function fetchOWM(lat, lon) {
  try {
    const [cR, fR] = await Promise.all([
      fetch(
        `${CONFIG.OWM_BASE}/weather?lat=${lat}&lon=${lon}&appid=${CONFIG.OWM_KEY}&units=metric&lang=vi`,
      ),
      fetch(
        `${CONFIG.OWM_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.OWM_KEY}&units=metric&lang=vi`,
      ),
    ]);
    if (!cR.ok) throw new Error(`OWM ${cR.status}`);
    STATE.owmData = await cR.json();
    STATE.owmForecast = await fR.json();
    return true;
  } catch (e) {
    console.warn("❌ OWM:", e.message);
    return false;
  }
}

async function fetchOpenMeteo(lat, lon) {
  try {
    const url = `${CONFIG.METEO_BASE}/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relativehumidity_2m,apparent_temperature,precipitation_probability,weathercode,windspeed_10m,winddirection_10m,surface_pressure,visibility&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,windspeed_10m_max&current_weather=true&timezone=Asia%2FHo_Chi_Minh&forecast_days=8&windspeed_unit=kmh`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Meteo ${res.status}`);
    const data = await res.json();
    STATE.meteoData = data;
    STATE.meteoDailyData = data.daily;
    return true;
  } catch (e) {
    console.warn("❌ Open-Meteo:", e.message);
    return false;
  }
}

// ============================================================
// MERGE DATA
// ============================================================
function mergeWeatherData() {
  const owm = STATE.owmData,
    meteo = STATE.meteoData,
    m = STATE.merged;
  const owmTemp = owm ? owm.main.temp : null,
    meteoTemp = meteo ? meteo.current_weather.temperature : null;
  m.temp = round(avg(owmTemp, meteoTemp));
  m.feelsLike = round(
    avg(
      owm ? owm.main.feels_like : null,
      getMeteoHourly("apparent_temperature"),
    ),
  );
  m.humidity = round(
    avg(owm ? owm.main.humidity : null, getMeteoHourly("relativehumidity_2m")),
    0,
  );
  m.windSpeed = round(
    avg(
      owm ? owm.wind.speed * 3.6 : null,
      meteo ? meteo.current_weather.windspeed : null,
    ),
    0,
  );
  m.windDeg = owm
    ? owm.wind.deg
    : meteo
      ? meteo.current_weather.winddirection
      : 0;
  m.pressure = round(
    avg(owm ? owm.main.pressure : null, getMeteoHourly("surface_pressure")),
    0,
  );
  const rawVis = getMeteoHourly("visibility");
  m.visibility = round(
    avg(owm ? owm.visibility / 1000 : null, rawVis ? rawVis / 1000 : null),
    1,
  );
  if (meteo) {
    const info = wmo(meteo.current_weather.weathercode);
    m.weatherIcon = info.icon;
    m.weatherDesc = info.desc;
    m.weatherCode = meteo.current_weather.weathercode;
  } else if (owm) {
    m.weatherIcon = owmIcon(owm.weather[0].icon);
    m.weatherDesc = owm.weather[0].description;
    m.weatherCode = owm.weather[0].id;
  }
  if (owm) {
    m.sunrise = owm.sys.sunrise;
    m.sunset = owm.sys.sunset;
  } else if (STATE.meteoDailyData) {
    m.sunrise = new Date(STATE.meteoDailyData.sunrise[0]).getTime() / 1000;
    m.sunset = new Date(STATE.meteoDailyData.sunset[0]).getTime() / 1000;
  }
  m.source = owm && meteo ? "both" : owm ? "owm" : meteo ? "meteo" : "none";
  // Today stats
  if (STATE.meteoDailyData) {
    const d = STATE.meteoDailyData;
    m.todayMax = Math.round(d.temperature_2m_max[0]);
    m.todayMin = Math.round(d.temperature_2m_min[0]);
    m.todayRain = d.precipitation_probability_max[0] || 0;
    m.todayWind = Math.round(d.windspeed_10m_max[0] || 0);
  }
}

function getMeteoHourly(field) {
  const data = STATE.meteoData;
  if (!data?.hourly?.[field]) return null;
  const nowStr = new Date().toISOString().slice(0, 13);
  const idx = data.hourly.time.findIndex((t) => t.startsWith(nowStr));
  return data.hourly[field][idx !== -1 ? idx : 0];
}

// ============================================================
// MAIN FETCH — GPS first, cache for weather only
// ============================================================
async function fetchWeather() {
  showLoadingState(true);
  const { lat, lon, accuracy } = await getLocation();
  STATE.lat = lat;
  STATE.lon = lon;
  const cache = loadCache();
  if (cache) {
    applyCache(cache);
    if (!cache.stale) {
      reverseGeocode(lat, lon).then((city) => {
        STATE.cityName = city;
        setText("city-name", city);
        setText("map-loc-city", city);
        updateMapPanel();
      });
      showLoadingState(false);
      updateLastUpdate();
      return;
    }
  }
  try {
    const [cityName, owmOk, meteoOk] = await Promise.all([
      reverseGeocode(lat, lon),
      fetchOWM(lat, lon),
      fetchOpenMeteo(lat, lon),
    ]);
    STATE.cityName = cityName;
    setText("city-name", cityName);
    if (!owmOk && !meteoOk) throw new Error("Cả 2 API thất bại");
    mergeWeatherData();
    renderAll();
    saveCache({
      owmData: STATE.owmData,
      owmForecast: STATE.owmForecast,
      meteoData: STATE.meteoData,
      meteoDailyData: STATE.meteoDailyData,
      cityName: STATE.cityName,
    });
    const accStr = accuracy ? `±${Math.round(accuracy)}m` : "?";
    addAlertLog(
      "✅",
      `Dữ liệu từ ${owmOk && meteoOk ? "2 nguồn" : "1 nguồn"}. GPS ${accStr}`,
      "safe",
    );
  } catch (err) {
    console.error(err);
    if (!cache) {
      addAlertLog(
        "❌",
        "Không thể tải dữ liệu. Kiểm tra kết nối mạng.",
        "danger",
      );
      showToast("❌ Lỗi tải dữ liệu", 4000);
    }
  } finally {
    showLoadingState(false);
    updateLastUpdate();
  }
}

function showLoadingState(loading) {
  const btn = document.querySelector(".btn-refresh");
  if (btn) btn.textContent = loading ? "⏳ Đang tải..." : "↻ Làm mới";
}
function updateLastUpdate() {
  const el = document.getElementById("last-update");
  if (el)
    el.textContent = `Cập nhật ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderCurrentWeather();
  renderForecast();
  renderAlerts();
  updateMapPanel();
  if (STATE.lat) updateMap();
}

function renderCurrentWeather() {
  const m = STATE.merged;
  if (m.source === "none") return;
  setText("temp-main", m.temp !== null ? Math.round(m.temp) : "--");
  setText("weather-desc", m.weatherDesc || "--");
  setText("feels-like", m.feelsLike !== null ? Math.round(m.feelsLike) : "--");
  setText(
    "humidity",
    m.humidity !== null ? `${Math.round(m.humidity)}%` : "--%",
  );
  setText(
    "wind-speed",
    m.windSpeed !== null ? `${Math.round(m.windSpeed)} km/h` : "-- km/h",
  );
  setText("wind-dir", `Hướng: ${windDir(m.windDeg)}`);
  setText("visibility", m.visibility !== null ? `${m.visibility} km` : "-- km");
  setText(
    "pressure",
    m.pressure !== null ? `${Math.round(m.pressure)} hPa` : "-- hPa",
  );
  setText("sunrise", m.sunrise ? fmtTime(m.sunrise) : "--:--");
  setText("sunset", m.sunset ? fmtTime(m.sunset) : "--:--");
  setText("city-name", STATE.cityName);
  const iconEl = document.getElementById("weather-icon-big");
  if (iconEl) iconEl.textContent = m.weatherIcon || "🌤";
  const humBar = document.getElementById("humidity-bar");
  if (humBar && m.humidity !== null) humBar.style.width = `${m.humidity}%`;
  const header = document.querySelector(".weather-main-card .card-header");
  if (header) header.innerHTML = `Thời tiết hiện tại ${sourceBadge(m.source)}`;
  renderSourceComparison();
  evaluateDanger();
}

function renderSourceComparison() {
  const owm = STATE.owmData,
    meteo = STATE.meteoData;
  if (!owm || !meteo) return;
  const owmT = owm.main.temp,
    meteoT = meteo.current_weather.temperature,
    diff = Math.abs(owmT - meteoT).toFixed(1);
  let cmp = document.getElementById("source-cmp");
  if (!cmp) {
    const card = document.querySelector(".weather-main-card");
    if (!card) return;
    cmp = document.createElement("div");
    cmp.id = "source-cmp";
    cmp.style.cssText =
      "margin-top:12px;padding:10px 14px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:8px;font-size:.78rem;color:#7a9cc0;line-height:1.8";
    card.appendChild(cmp);
  }
  const status =
    diff <= 1 ? "✅ Rất khớp" : diff <= 2 ? "⚠ Lệch nhỏ" : "🔴 Lệch lớn";
  const color = diff <= 1 ? "#00e676" : diff <= 2 ? "#ffb300" : "#ff3d3d";
  cmp.innerHTML = `<div style="color:#00d4ff;font-weight:600;margin-bottom:4px;letter-spacing:1px;font-size:.7rem">SO SÁNH 2 NGUỒN</div><div>🌐 OpenWeatherMap: <strong style="color:#e8f4ff">${owmT.toFixed(1)}°C</strong></div><div>📡 Open-Meteo: <strong style="color:#e8f4ff">${meteoT.toFixed(1)}°C</strong></div><div>📊 Trung bình: <strong style="color:#00e676">${STATE.merged.temp}°C</strong><span style="color:${color};margin-left:6px">${status} (±${diff}°)</span></div>`;
}

function evaluateDanger() {
  const m = STATE.merged,
    alerts = [],
    temp = m.temp || 0,
    wind = m.windSpeed || 0,
    hum = m.humidity || 0,
    wCode = m.weatherCode;
  let level = "safe";
  const isStorm =
    wCode >= 95 ||
    (STATE.owmData?.weather[0].id >= 200 && STATE.owmData?.weather[0].id < 300);
  if (isStorm) {
    alerts.push({
      icon: "⛈",
      title: "Dông bão nguy hiểm",
      desc: "Có dông và sét mạnh. Tránh ra ngoài trời.",
      type: "danger",
    });
    level = "danger";
  }
  const isHeavyRain =
    (wCode >= 63 && wCode <= 82) ||
    (STATE.owmData?.weather[0].id >= 501 && STATE.owmData?.weather[0].id < 600);
  if (isHeavyRain && !isStorm) {
    alerts.push({
      icon: "🌧",
      title: "Mưa lớn",
      desc: "Chú ý nguy cơ ngập úng và sạt lở.",
      type: "warning",
    });
    if (level !== "danger") level = "warning";
  }
  if (temp >= 38) {
    alerts.push({
      icon: "🔥",
      title: "Nắng nóng cực đoan",
      desc: `${temp}°C — Nguy cơ say nắng cao!`,
      type: "danger",
    });
    level = "danger";
  } else if (temp >= 35) {
    alerts.push({
      icon: "☀️",
      title: "Nắng nóng",
      desc: `${temp}°C — Hạn chế ra ngoài.`,
      type: "warning",
    });
    if (level !== "danger") level = "warning";
  }
  const threshold = parseInt(
    document.getElementById("wind-threshold")?.value || 50,
  );
  if (wind >= threshold) {
    alerts.push({
      icon: "🌬",
      title: "Gió mạnh nguy hiểm",
      desc: `${Math.round(wind)} km/h — Nguy cơ cây đổ.`,
      type: "danger",
    });
    level = "danger";
  } else if (wind >= 40) {
    alerts.push({
      icon: "💨",
      title: "Gió mạnh",
      desc: `${Math.round(wind)} km/h`,
      type: "warning",
    });
    if (level === "safe") level = "caution";
  }
  if (hum >= 90 && temp >= 30) {
    alerts.push({
      icon: "💧",
      title: "Độ ẩm cao + Nóng",
      desc: "Nguy cơ mất nước.",
      type: "warning",
    });
    if (level === "safe") level = "caution";
  }
  STATE.alertLevel = level;
  renderAlertItems(alerts);
  updateAlertLevel(level);
  if (level === "danger" && alerts[0])
    showEmergency(alerts[0].title, alerts[0].desc);
  if (!alerts.length)
    addAlertLog("✅", "Thời tiết ổn định, không có cảnh báo.", "safe");
  else
    alerts.forEach((a) => addAlertLog(a.icon, `${a.title}: ${a.desc}`, a.type));
}

// ============================================================
// FORECAST
// ============================================================
function renderForecast() {
  renderTodayCard();
  renderDailyForecast();
  renderHourlyList();
  renderHourlyChart();
  const el = document.getElementById("fc-updated-time");
  if (el)
    el.textContent = `Cập nhật ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function renderTodayCard() {
  const m = STATE.merged;
  if (m.source === "none") return;
  setText("fc-today-icon", m.weatherIcon || "🌤");
  setText("fc-today-desc", m.weatherDesc || "--");
  setText("fc-now-temp-val", m.temp !== null ? Math.round(m.temp) : "--");
  setText("fc-today-max", m.todayMax != null ? `${m.todayMax}°` : "--°");
  setText("fc-today-min", m.todayMin != null ? `${m.todayMin}°` : "--°");
  const header = document.querySelector(".fc-today-card .fc-card-header");
  if (header) header.innerHTML = `☀️ Hôm nay ${sourceBadge(m.source)}`;
}

function renderDailyForecast() {
  const container = document.getElementById("forecast-table");
  if (!container) return;
  if (STATE.meteoDailyData) {
    const d = STATE.meteoDailyData;
    const allMax = d.temperature_2m_max.slice(0, 8),
      allMin = d.temperature_2m_min.slice(0, 8);
    const globalMin = Math.min(...allMin),
      globalMax = Math.max(...allMax),
      range = globalMax - globalMin || 1;
    container.innerHTML = d.time
      .slice(0, 8)
      .map((dateStr, i) => {
        const info = wmo(d.weathercode[i]),
          maxT = Math.round(d.temperature_2m_max[i]),
          minT = Math.round(d.temperature_2m_min[i]);
        const rain = d.precipitation_probability_max[i] || 0,
          wind = Math.round(d.windspeed_10m_max[i] || 0);
        const barLeft = (((minT - globalMin) / range) * 100).toFixed(1),
          barWidth = (((maxT - minT) / range) * 100).toFixed(1);
        return `<div class="forecast-row ${i === 0 ? "today" : ""}">
        <div class="forecast-day ${i === 0 ? "today-label" : ""}">${i === 0 ? "📅 HÔM NAY" : fmtDayS(dateStr)}</div>
        <div class="forecast-icon">${info.icon}</div>
        <div class="forecast-desc">${info.desc}</div>
        <div class="forecast-temp-bar"><div class="forecast-temp-range"><span class="fc-min">${minT}°</span><div class="fc-bar-wrap"><div class="fc-bar-fill" style="margin-left:${barLeft}%;width:${barWidth}%"></div></div><span class="fc-max">${maxT}°</span></div></div>
        <div class="forecast-rain"><span>💧${rain}%</span><span style="color:var(--text-muted)">💨${wind}</span></div>
      </div>`;
      })
      .join("");
    return;
  }
  if (STATE.owmForecast?.list) {
    const days = {};
    STATE.owmForecast.list.forEach((item) => {
      const key = new Date(item.dt * 1000).toDateString();
      if (!days[key]) days[key] = { items: [], dt: item.dt };
      days[key].items.push(item);
    });
    container.innerHTML = Object.keys(days)
      .slice(0, 5)
      .map((key, i) => {
        const day = days[key],
          temps = day.items.map((it) => it.main.temp);
        const maxT = Math.round(Math.max(...temps)),
          minT = Math.round(Math.min(...temps));
        const mid = day.items[Math.floor(day.items.length / 2)],
          rain = Math.round(
            Math.max(...day.items.map((it) => (it.pop || 0) * 100)),
          );
        return `<div class="forecast-row ${i === 0 ? "today" : ""}"><div class="forecast-day ${i === 0 ? "today-label" : ""}">${i === 0 ? "📅 HÔM NAY" : fmtDay(day.dt)}</div><div class="forecast-icon">${owmIcon(mid.weather[0].icon)}</div><div class="forecast-desc">${mid.weather[0].description}</div><div class="forecast-temp-bar"><div class="forecast-temp-range"><span class="fc-min">${minT}°</span><div class="fc-bar-wrap"><div class="fc-bar-fill" style="width:60%"></div></div><span class="fc-max">${maxT}°</span></div></div><div class="forecast-rain">💧${rain}%</div></div>`;
      })
      .join("");
  }
}

function renderHourlyList() {
  const container = document.getElementById("hourly-list");
  if (!container) return;
  if (STATE.meteoData?.hourly) {
    const h = STATE.meteoData.hourly,
      now = new Date().getTime();
    let si = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= now) {
        si = i;
        break;
      }
    }
    const slice = Array.from({ length: 24 }, (_, i) => si + i).filter(
      (i) => i < h.time.length,
    );
    container.innerHTML = slice
      .map((i, idx) => {
        const info = wmo(h.weathercode[i]),
          temp = Math.round(h.temperature_2m[i]);
        const rain = Math.round(h.precipitation_probability[i] || 0),
          wind = Math.round(h.windspeed_10m[i] || 0);
        const ts = new Date(h.time[i]).getTime() / 1000,
          isNow = idx === 0;
        return `<div class="hourly-item ${isNow ? "is-now" : ""}"><div class="hourly-time">${isNow ? "Bây giờ" : fmtHour(ts)}</div><div class="hourly-icon">${info.icon}</div><div class="hourly-temp">${temp}°C</div><div class="hourly-rain">💧${rain}%</div><div class="hourly-wind">💨${wind}</div></div>`;
      })
      .join("");
    return;
  }
  if (STATE.owmForecast?.list) {
    container.innerHTML = STATE.owmForecast.list
      .slice(0, 8)
      .map(
        (item, idx) =>
          `<div class="hourly-item ${idx === 0 ? "is-now" : ""}"><div class="hourly-time">${idx === 0 ? "Bây giờ" : fmtHour(item.dt)}</div><div class="hourly-icon">${owmIcon(item.weather[0].icon)}</div><div class="hourly-temp">${Math.round(item.main.temp)}°C</div><div class="hourly-rain">💧${Math.round((item.pop || 0) * 100)}%</div></div>`,
      )
      .join("");
  }
}

let currentChartType = "line";
function switchChartType(type, btnEl) {
  currentChartType = type;
  document
    .querySelectorAll(".fc-ctab")
    .forEach((b) => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderHourlyChart();
}

function renderHourlyChart() {
  const canvas = document.getElementById("hourly-chart");
  if (!canvas) return;
  if (STATE.hourlyChart) {
    STATE.hourlyChart.destroy();
    STATE.hourlyChart = null;
  }
  const chartType = currentChartType || "line";
  let labels = [],
    temps = [],
    rains = [],
    winds = [];
  if (STATE.meteoData?.hourly) {
    const h = STATE.meteoData.hourly,
      now = new Date().getTime();
    let si = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= now) {
        si = i;
        break;
      }
    }
    const sl = Array.from({ length: 12 }, (_, i) => si + i).filter(
      (i) => i < h.time.length,
    );
    labels = sl.map((i) => fmtHour(new Date(h.time[i]).getTime() / 1000));
    temps = sl.map((i) => Math.round(h.temperature_2m[i]));
    rains = sl.map((i) => Math.round(h.precipitation_probability[i] || 0));
    winds = sl.map((i) => Math.round(h.windspeed_10m[i] || 0));
  } else if (STATE.owmForecast?.list) {
    const items = STATE.owmForecast.list.slice(0, 10);
    labels = items.map((i) => fmtHour(i.dt));
    temps = items.map((i) => Math.round(i.main.temp));
    rains = items.map((i) => Math.round((i.pop || 0) * 100));
    winds = items.map((i) => Math.round(i.wind.speed * 3.6));
  }
  if (!labels.length) return;
  STATE.hourlyChart = new Chart(canvas, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: "Nhiệt độ (°C)",
          data: temps,
          borderColor: "#00d4ff",
          backgroundColor: "rgba(0,212,255,.15)",
          pointBackgroundColor: "#00d4ff",
          pointRadius: chartType === "line" ? 5 : 0,
          tension: 0.4,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Mưa (%)",
          data: rains,
          borderColor: "#57a0ff",
          backgroundColor: "rgba(87,160,255,.2)",
          pointBackgroundColor: "#57a0ff",
          pointRadius: chartType === "line" ? 4 : 0,
          tension: 0.4,
          fill: chartType === "bar",
          yAxisID: "y1",
          borderDash: chartType === "line" ? [5, 5] : [],
        },
        {
          label: "Gió (km/h)",
          data: winds,
          borderColor: "#ffb300",
          backgroundColor: "rgba(255,179,0,.15)",
          pointBackgroundColor: "#ffb300",
          pointRadius: chartType === "line" ? 3 : 0,
          tension: 0.4,
          fill: chartType === "bar",
          yAxisID: "y1",
          borderDash: chartType === "line" ? [2, 4] : [],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#7a9cc0", font: { family: "Exo 2", size: 12 } },
        },
        tooltip: {
          backgroundColor: "#0b1628",
          borderColor: "#1a2f50",
          borderWidth: 1,
          titleColor: "#e8f4ff",
          bodyColor: "#7a9cc0",
        },
      },
      scales: {
        x: {
          ticks: { color: "#3d5a7a", font: { family: "Exo 2" } },
          grid: { color: "rgba(30,64,128,.3)" },
        },
        y: {
          type: "linear",
          position: "left",
          ticks: {
            color: "#00d4ff",
            font: { family: "Orbitron", size: 10 },
            callback: (v) => `${v}°`,
          },
          grid: { color: "rgba(30,64,128,.3)" },
        },
        y1: {
          type: "linear",
          position: "right",
          min: 0,
          max: 100,
          ticks: {
            color: "#57a0ff",
            font: { family: "Orbitron", size: 10 },
            callback: (v) => `${v}`,
          },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

// ============================================================
// ALERTS
// ============================================================
function renderAlerts() {
  renderAlertLog();
}
function renderAlertItems(alerts) {
  const list = document.getElementById("alert-list"),
    panel = document.getElementById("alert-panel");
  if (!list) return;
  if (!alerts.length) {
    list.innerHTML =
      '<div class="no-alert">✅ Không có cảnh báo nào — Thời tiết an toàn</div>';
    if (panel) panel.style.borderColor = "var(--border)";
    document.getElementById("alert-badge")?.classList.add("hidden");
    return;
  }
  list.innerHTML = alerts
    .map(
      (a) =>
        `<div class="alert-item ${a.type === "warning" ? "warning" : ""}"><div class="alert-item-icon">${a.icon}</div><div class="alert-item-body"><div class="alert-item-title ${a.type === "warning" ? "warning" : ""}">${a.title}</div><div class="alert-item-desc">${a.desc}</div></div></div>`,
    )
    .join("");
  if (panel)
    panel.style.borderColor = alerts.some((a) => a.type === "danger")
      ? "var(--accent-red)"
      : "var(--accent-orange)";
  document.getElementById("alert-badge")?.classList.remove("hidden");
}
function updateAlertLevel(level) {
  ["safe", "caution", "warning", "danger"].forEach((l) =>
    document.getElementById(`level-${l}`)?.classList.remove("active-level"),
  );
  const map = {
    safe: "level-safe",
    caution: "level-caution",
    warning: "level-warning",
    danger: "level-danger",
  };
  document.getElementById(map[level])?.classList.add("active-level");
}
function addAlertLog(icon, text, type = "safe") {
  const now = new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  STATE.alertLog.unshift({ icon, text, type, time: now });
  if (STATE.alertLog.length > 30) STATE.alertLog.pop();
  renderAlertLog();
}
function renderAlertLog() {
  const log = document.getElementById("alert-log");
  if (!log) return;
  if (!STATE.alertLog.length) {
    log.innerHTML = '<div class="no-alert">✅ Hệ thống đang theo dõi...</div>';
    return;
  }
  log.innerHTML = STATE.alertLog
    .map(
      (e) =>
        `<div class="alert-log-item ${e.type}"><span>${e.icon}</span><span class="alert-log-text">${e.text}</span><span class="alert-log-time">${e.time}</span></div>`,
    )
    .join("");
}

// ============================================================
// MAP
// ============================================================
function initMap() {
  if (STATE.map) return;
  const lat = STATE.lat || 21.0285,
    lon = STATE.lon || 105.8542;
  STATE.map = L.map("leaflet-map", {
    center: [lat, lon],
    zoom: 13,
    zoomControl: false,
  });

  // OpenStreetMap — màu gốc, rõ ràng
  STATE.osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap", maxZoom: 19 },
  ).addTo(STATE.map);
  STATE.satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "© Esri", maxZoom: 19 },
  );
  STATE.topoLayer = L.tileLayer(
    "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenTopoMap", maxZoom: 17 },
  );

  L.control.zoom({ position: "bottomright" }).addTo(STATE.map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(STATE.map);

  const myIcon = L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px"><div style="position:absolute;inset:0;background:#00d4ff;border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px #00d4ff,0 0 20px rgba(0,212,255,.4);animation:lping 1.5s infinite"></div></div><style>@keyframes lping{0%{box-shadow:0 0 0 0 rgba(0,212,255,.7)}70%{box-shadow:0 0 0 18px rgba(0,212,255,0)}100%{box-shadow:0 0 0 0 rgba(0,212,255,0)}}</style>`,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  STATE.myMarker = L.marker([lat, lon], { icon: myIcon })
    .addTo(STATE.map)
    .bindPopup(
      `<div style="font-family:'Exo 2',sans-serif;min-width:160px"><div style="font-weight:700;color:#00d4ff;margin-bottom:4px">📍 Vị trí của bạn</div><div style="font-size:.82rem;color:#555">${STATE.cityName || "--"}</div><div style="font-size:.75rem;color:#999;margin-top:4px;font-family:monospace">${lat.toFixed(5)}, ${lon.toFixed(5)}</div></div>`,
    )
    .openPopup();
  renderFamilyOnMap();
}

function setActiveLayerBtn(btn) {
  document
    .querySelectorAll(".map-layer-btn")
    .forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function updateMapPanel() {
  const m = STATE.merged;
  const badge = document.getElementById("map-coord-badge");
  if (badge && STATE.lat)
    badge.textContent = `📍 ${STATE.lat.toFixed(4)}, ${STATE.lon.toFixed(4)}`;
  setText("map-loc-city", STATE.cityName || "Chưa xác định");
  setText(
    "map-loc-coords",
    STATE.lat ? `${STATE.lat.toFixed(5)}, ${STATE.lon.toFixed(5)}` : "---, ---",
  );
}

function renderFamilyOnMap() {
  if (!STATE.map) return;
  STATE.familyMembers.forEach((m) => {
    const icon = L.divIcon({
      html: `<div style="font-size:22px">${m.emoji}</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([m.lat, m.lon], { icon })
      .addTo(STATE.map)
      .bindPopup(`<b>${m.emoji} ${m.name}</b><br>${m.city}<br>${m.lastSeen}`);
  });
}

function updateMap() {
  if (!STATE.map || !STATE.lat) return;
  STATE.map.setView([STATE.lat, STATE.lon], 13);
  if (STATE.myMarker) STATE.myMarker.setLatLng([STATE.lat, STATE.lon]);
}

async function centerMap() {
  const mapNavBtn = document.querySelector('[data-tab="map"]');
  switchTab("map", mapNavBtn);
  const btn = document.querySelector(".btn-map-locate");
  if (btn) {
    btn.innerHTML = "<span>⏳</span> Đang xác định...";
    btn.disabled = true;
  }
  await new Promise((r) => setTimeout(r, 200));
  if (!STATE.map) return;
  STATE.map.invalidateSize();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude,
        lon = pos.coords.longitude,
        acc = Math.round(pos.coords.accuracy);
      STATE.lat = lat;
      STATE.lon = lon;
      STATE.map.setView([lat, lon], 16, { animate: true, duration: 0.3 });
      if (STATE.myMarker) {
        STATE.myMarker.setLatLng([lat, lon]);
        STATE.myMarker.openPopup();
      }
      setText("map-loc-coords", `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      const badge = document.getElementById("map-coord-badge");
      if (badge) badge.textContent = `📍 ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      if (btn) {
        btn.innerHTML = `<span>📍</span> ±${acc}m`;
        btn.disabled = false;
      }
      reverseGeocode(lat, lon).then((city) => {
        STATE.cityName = city;
        setText("city-name", city);
        setText("map-loc-city", city);
      });
    },
    () => {
      if (STATE.lat && STATE.lon)
        STATE.map.setView([STATE.lat, STATE.lon], 16, {
          animate: true,
          duration: 0.3,
        });
      if (btn) {
        btn.innerHTML = "<span>📍</span> Về vị trí của tôi";
        btn.disabled = false;
      }
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
  );
}

function changeBaseLayer(value) {
  if (!STATE.map) return;
  const layers = {
    osm: STATE.osmLayer,
    satellite: STATE.satelliteLayer,
    topo: STATE.topoLayer,
  };
  Object.values(layers).forEach((l) => {
    if (l && STATE.map.hasLayer(l)) STATE.map.removeLayer(l);
  });
  if (layers[value]) layers[value].addTo(STATE.map);
}

function toggleWeatherLayer() {
  if (!STATE.map) return;
  STATE.weatherLayer = !STATE.weatherLayer;
  const dot = document.getElementById("weather-dot"),
    text = document.getElementById("layer-toggle-text");
  if (STATE.weatherLayer) {
    STATE.owmLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${CONFIG.OWM_KEY}`,
      { opacity: 0.6 },
    ).addTo(STATE.map);
    if (dot) dot.className = "map-wt-dot on";
    if (text) text.textContent = "Bật";
  } else {
    if (STATE.owmLayer) STATE.map.removeLayer(STATE.owmLayer);
    if (dot) dot.className = "map-wt-dot off";
    if (text) text.textContent = "Tắt";
  }
}

// ============================================================
// WINDY
// ============================================================
const WINDY_STATE = { lat: 16.0, lon: 107.5, zoom: 5, overlay: "wind" };
function buildWindyUrl(lat, lon, zoom, overlay, detail = false) {
  WINDY_STATE.lat = lat;
  WINDY_STATE.lon = lon;
  WINDY_STATE.zoom = zoom;
  WINDY_STATE.overlay = overlay;
  return `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=900&height=520&zoom=${zoom}&level=surface&overlay=${overlay}&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=${detail}&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
}

function closeWindyDetail() {
  const iframe = document.getElementById("windy-iframe");
  if (!iframe) return;
  iframe.src = buildWindyUrl(
    WINDY_STATE.lat,
    WINDY_STATE.lon,
    WINDY_STATE.zoom,
    WINDY_STATE.overlay,
    false,
  );
}

const WINDY_LAYERS = {
  wind: { label: "💨 Gió", overlay: "wind" },
  rain: { label: "🌧 Mưa", overlay: "rain" },
  temp: { label: "🌡 Nhiệt độ", overlay: "temp" },
  clouds: { label: "☁ Mây", overlay: "clouds" },
  pressure: { label: "📊 Áp suất", overlay: "pressure" },
  thunderstorms: { label: "⚡ Dông", overlay: "thunderstorms" },
};

function switchWindyLayer(layerKey, btnEl) {
  const layer = WINDY_LAYERS[layerKey];
  if (!layer) return;
  document
    .querySelectorAll(".wlayer")
    .forEach((b) => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  const badge = document.getElementById("windy-layer-label");
  if (badge) badge.textContent = layer.label;
  const iframe = document.getElementById("windy-iframe");
  if (!iframe) return;
  showWindyLoading();
  iframe.src = buildWindyUrl(
    WINDY_STATE.lat,
    WINDY_STATE.lon,
    WINDY_STATE.zoom,
    layer.overlay,
    false,
  );
}

function showWindyLoading() {
  const loading = document.getElementById("windy-loading");
  if (loading) {
    loading.classList.remove("hidden");
    const iframe = document.getElementById("windy-iframe");
    if (iframe) {
      const hide = () => {
        loading.classList.add("hidden");
        iframe.removeEventListener("load", hide);
      };
      iframe.addEventListener("load", hide);
      setTimeout(() => loading.classList.add("hidden"), 8000);
    }
  }
}

async function locateMe() {
  const btn = document.getElementById("btn-locate-me"),
    icon = btn?.querySelector(".locate-icon"),
    coordEl = document.getElementById("windy-coord-display");
  if (btn) {
    btn.classList.add("locating");
    btn.querySelector("span:last-child").textContent = "Đang lấy mẫu GPS...";
  }
  if (icon) icon.textContent = "⏳";
  try {
    const { lat, lon, accuracy } = await getLocation();
    STATE.lat = lat;
    STATE.lon = lon;
    let qualityLabel = "",
      accStr = accuracy ? `±${Math.round(accuracy)}m` : "";
    if (!accuracy) qualityLabel = "(mặc định)";
    else if (accuracy <= 10) qualityLabel = "🟢 Rất chính xác";
    else if (accuracy <= 30) qualityLabel = "🟢 Chính xác";
    else if (accuracy <= 100) qualityLabel = "🟡 Trung bình";
    else qualityLabel = "🔴 Thấp";
    if (coordEl)
      coordEl.textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)} ${accStr}`;
    const iframe = document.getElementById("windy-iframe");
    if (iframe) {
      showWindyLoading();
      const overlay =
        document
          .querySelector(".wlayer.active")
          ?.getAttribute("data-overlay") || "wind";
      iframe.src = buildWindyUrl(lat, lon, 10, overlay, false);
    }
    if (STATE.map && STATE.myMarker) STATE.myMarker.setLatLng([lat, lon]);
    if (btn) {
      btn.classList.remove("locating");
      btn.querySelector("span:last-child").textContent =
        `${accStr} ${qualityLabel}`;
    }
    if (icon) icon.textContent = "📍";
    showToast(
      `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} | ${accStr} ${qualityLabel}`,
      4000,
    );
  } catch (err) {
    if (btn) {
      btn.classList.remove("locating");
      btn.querySelector("span:last-child").textContent = "❌ Thất bại";
    }
    if (icon) icon.textContent = "❌";
    showToast("❌ Không lấy được vị trí", 4000);
  }
}

function initWindy() {
  const iframe = document.getElementById("windy-iframe"),
    loading = document.getElementById("windy-loading");
  if (iframe && loading) {
    iframe.addEventListener("load", () => loading.classList.add("hidden"));
    setTimeout(() => loading.classList.add("hidden"), 8000);
  }
  if (STATE.lat && STATE.lon) {
    const coordEl = document.getElementById("windy-coord-display");
    if (coordEl)
      coordEl.textContent = `${STATE.lat.toFixed(3)}, ${STATE.lon.toFixed(3)}`;
  }
}

// ============================================================
// TAB
// ============================================================
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-section").forEach((s) => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("active"));
  const target = document.getElementById(`tab-${tabId}`);
  if (target) {
    target.classList.remove("hidden");
    target.classList.add("active");
  }
  if (btn) btn.classList.add("active");
  if (tabId === "map") {
    if (!STATE.map) {
      setTimeout(() => {
        initMap();
        setTimeout(() => {
          if (STATE.map) STATE.map.invalidateSize();
        }, 500);
      }, 150);
    } else {
      setTimeout(() => STATE.map.invalidateSize(), 150);
    }
  }
  if (tabId === "forecast" && STATE.meteoData)
    setTimeout(() => renderHourlyChart(), 100);
}

// ============================================================
// EMERGENCY
// ============================================================
function showEmergency(title, msg) {
  if (sessionStorage.getItem("em-shown") === title) return;
  sessionStorage.setItem("em-shown", title);
  setText("emergency-title", title.toUpperCase());
  setText("emergency-msg", msg);
  document.getElementById("emergency-overlay")?.classList.remove("hidden");
  playAlarmBeep();
}
function closeEmergency() {
  document.getElementById("emergency-overlay")?.classList.add("hidden");
}
function openSurvivalFromAlert() {
  closeEmergency();
  openSurvivalModal();
}
function playAlarmBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach((d) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 880;
      o.type = "sine";
      g.gain.setValueAtTime(0.3, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.25);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.3);
    });
  } catch {}
}

// ============================================================
// MY STATUS
// ============================================================
function updateMyStatus(status) {
  STATE.myStatus = status;
  document
    .querySelectorAll(".status-btn")
    .forEach((b) => b.classList.remove("selected"));
  document
    .querySelector(
      { safe: ".safe-btn", danger: ".danger-btn", help: ".help-btn" }[status],
    )
    ?.classList.add("selected");
  const labels = {
    safe: "✅ Tôi an toàn",
    danger: "🚨 Đang gặp nguy hiểm",
    help: "🆘 Cần trợ giúp",
  };
  const dotCls = { safe: "safe", danger: "danger", help: "help" }[status];
  const display = document.getElementById("my-status-display");
  if (display)
    display.innerHTML = `<span class="status-dot ${dotCls}"></span> Trạng thái: ${labels[status]}`;
  const bar = document.getElementById("status-safety");
  if (bar)
    bar.innerHTML = `<span class="status-dot ${dotCls}"></span><span>Trạng thái: ${labels[status]}</span>`;
  addAlertLog(
    "📡",
    `Cập nhật trạng thái: ${labels[status]}`,
    status === "safe" ? "safe" : "danger",
  );
}

// ============================================================
// SURVIVAL GUIDES
// ============================================================
const SURVIVAL_GUIDES = {
  bao: {
    icon: "🌀",
    title: "Hướng dẫn khi có Bão",
    warning: "⚠ Không ra ngoài khi bão đổ bộ!",
    steps: [
      "Theo dõi bản tin thời tiết và thực hiện theo hướng dẫn của chính quyền địa phương.",
      "Ở trong nhà, tránh xa cửa sổ và cửa kính. Di chuyển vào phòng trong.",
      "Tắt tất cả thiết bị điện. Cúp cầu dao chính để tránh chập điện.",
      "Dự trữ nước uống sạch, thức ăn khô, đèn pin và pin dự phòng.",
      "Giữ điện thoại luôn sạc đầy. Nghe đài FM để cập nhật thông tin.",
      "Khi bão đi qua: kiểm tra nhà trước khi vào. Cẩn thận dây điện đứt.",
      "Không vào vùng ngập nước — dòng chảy mạnh rất nguy hiểm.",
      "Gọi 114 hoặc 1800 599 928 nếu cần hỗ trợ khẩn cấp.",
    ],
  },
  lu: {
    icon: "🌊",
    title: "Hướng dẫn khi Lũ lụt",
    warning:
      "⚠ Không đi qua vùng nước lũ — 15cm nước siết có thể quật ngã người lớn!",
    steps: [
      "Ngay lập tức di chuyển lên vùng đất cao hơn. Đây là ưu tiên số 1.",
      "Tuyệt đối không lái xe qua vùng nước đang chảy.",
      "Tắt điện và gas nếu có thể, rời nhà ngay khi nước bắt đầu dâng.",
      "Mang theo túi khẩn cấp: nước uống, thức ăn, thuốc, tài liệu.",
      "Tránh vùng trũng, cống rãnh, gầm cầu.",
      "Nếu mắc kẹt trong xe bị ngập: mở cửa sổ, thoát ra ngay.",
      "Nếu bị cuốn: không bơi ngược dòng, bơi chéo để thoát ra.",
      "Sau lũ: không uống nước chưa đun sôi.",
    ],
  },
  set: {
    icon: "⚡",
    title: "Phòng tránh Sét đánh",
    warning: "⚠ Nghe sấm = đã trong vùng nguy hiểm!",
    steps: [
      "Quy tắc 30-30: sấm sét cách nhau dưới 30 giây → vào nhà ngay.",
      "Vào trong nhà hoặc xe hơi. Đóng tất cả cửa sổ.",
      "Tránh xa vật dụng kim loại, ống nước, điện thoại cố định.",
      "Ngoài trời: không đứng dưới cây cao hoặc trên đỉnh đồi.",
      "Nếu ở vùng trống: cúi thấp, mũi chân chạm đất, che tai.",
      "Không nằm dài trên mặt đất — điện có thể truyền qua đất.",
      "Dưới nước: vào bờ ngay khi có dấu hiệu dông.",
      "Người bị sét đánh: gọi 115 ngay.",
    ],
  },
  dongdat: {
    icon: "🌍",
    title: "Hướng dẫn khi Động đất",
    warning: "⚠ Nhớ 3 bước: DROP – COVER – HOLD ON!",
    steps: [
      "DROP: Ngồi xuống sàn ngay lập tức.",
      "COVER: Chui xuống bàn chắc chắn hoặc che đầu-cổ bằng tay.",
      "HOLD ON: Bám chặt cho đến khi rung ngừng.",
      "Tránh xa cửa sổ, đèn treo và tường ngoài.",
      "Nếu đang ngoài trời: ra xa nhà cửa và đường dây điện.",
      "Trong xe: dừng xe, ở trong xe, tránh xa cầu.",
      "Sau động đất: kiểm tra rò rỉ khí gas và điện.",
      "Không dùng thang máy sau động đất.",
    ],
  },
  nangnong: {
    icon: "🔥",
    title: "Ứng phó Nắng nóng cực đoan",
    warning:
      "⚠ Nhiệt độ cảm giác trên 40°C có thể gây say nắng chỉ trong 15 phút!",
    steps: [
      "Ở trong nhà có điều hòa, đặc biệt từ 10 giờ sáng đến 4 giờ chiều.",
      "Uống ít nhất 2–3 lít nước mỗi ngày kể cả khi không khát.",
      "Tránh đồ uống có cồn và caffeine.",
      "Mặc quần áo sáng màu, rộng rãi. Đội mũ rộng vành.",
      "Dấu hiệu say nắng: da đỏ và khô, không mồ hôi → gọi 115 ngay.",
      "Sơ cứu say nắng: đưa vào bóng mát, làm mát bằng nước lạnh.",
      "Không để trẻ em hoặc thú cưng trong xe.",
      "Kiểm tra thường xuyên người cao tuổi và trẻ nhỏ.",
    ],
  },
  mualon: {
    icon: "🌧",
    title: "Ứng phó Mưa lớn kéo dài",
    warning: "⚠ Mưa lớn kéo dài gây ngập úng, sạt lở và ô nhiễm nguồn nước!",
    steps: [
      "Theo dõi thông tin từ đài khí tượng liên tục.",
      "Cẩn thận nếu bạn sống gần sông, suối, đồi dốc hoặc vùng trũng.",
      "Chuẩn bị sẵn sàng di tản nếu được yêu cầu.",
      "Không đi vào vùng ngập — nước có thể chứa điện.",
      "Dấu hiệu sạt lở: âm thanh lạ, mặt đất rung nhẹ.",
      "Khi nghi ngờ sạt lở: sơ tán ngay theo hướng vuông góc.",
      "Sau mưa: không uống nước máy khi chưa có thông báo an toàn.",
      "Vệ sinh nhà cửa sau mưa để tránh dịch bệnh.",
    ],
  },
};

function openSurvivalModal(type = "bao") {
  document.getElementById("survival-modal")?.classList.remove("hidden");
  showSurvivalGuide(type);
}
function closeSurvivalModal() {
  document.getElementById("survival-modal")?.classList.add("hidden");
}
function showSurvivalGuide(type, btnEl) {
  if (btnEl) {
    document
      .querySelectorAll(".stab")
      .forEach((b) => b.classList.remove("active"));
    btnEl.classList.add("active");
  }
  const guide = SURVIVAL_GUIDES[type];
  if (!guide) return;
  const container = document.getElementById("survival-content");
  if (!container) return;
  container.innerHTML = `<div class="guide-warning">${guide.warning}</div>${guide.steps.map((s, i) => `<div class="guide-step"><div class="guide-step-num">${i + 1}</div><div class="guide-step-text">${s}</div></div>`).join("")}`;
}
function quickSurvival(type) {
  openSurvivalModal(type);
  setTimeout(() => {
    document.querySelectorAll(".stab").forEach((b) => {
      if (b.getAttribute("onclick")?.includes(type)) b.classList.add("active");
      else b.classList.remove("active");
    });
    showSurvivalGuide(type);
  }, 50);
}

// ============================================================
// FAMILY
// ============================================================
function renderFamilyMembers() {
  const grid = document.getElementById("family-grid");
  if (!grid) return;
  grid.innerHTML = STATE.familyMembers
    .map(
      (m) =>
        `<div class="family-card"><div class="family-avatar">${m.emoji}</div><div class="family-name">${m.name}</div><div class="family-loc">📍 ${m.city}</div><div class="family-status-badge ${m.status}">${m.status === "safe" ? "✅ An toàn" : "❓ Chưa rõ"}</div><div class="family-last-seen">Cập nhật: ${m.lastSeen}</div><button class="btn-view-map" onclick="viewMemberOnMap(${m.id})">🗺 Xem trên bản đồ</button></div>`,
    )
    .join("");
}

function viewMemberOnMap(id) {
  const m = STATE.familyMembers.find((x) => x.id === id);
  if (!m) return;
  switchTab("map", document.querySelector('[data-tab="map"]'));
  setTimeout(() => {
    if (STATE.map) STATE.map.setView([m.lat, m.lon], 15);
  }, 300);
}

function startSharing() {
  STATE.sharing = true;
  document.getElementById("btn-share-start")?.classList.add("hidden");
  document.getElementById("btn-share-stop")?.classList.remove("hidden");
  document.getElementById("share-link-box")?.classList.remove("hidden");
  const dot = document.getElementById("share-dot"),
    txt = document.getElementById("share-text");
  if (dot) dot.className = "status-dot safe";
  if (txt) txt.textContent = "Đang chia sẻ vị trí...";
  STATE.shareInterval = setInterval(() => {
    if (STATE.lat && STATE.lon) console.log("📡", STATE.lat, STATE.lon);
  }, 10000);
  addAlertLog("📡", "Bắt đầu chia sẻ vị trí với gia đình.", "safe");
}
function stopSharing() {
  STATE.sharing = false;
  clearInterval(STATE.shareInterval);
  document.getElementById("btn-share-start")?.classList.remove("hidden");
  document.getElementById("btn-share-stop")?.classList.add("hidden");
  document.getElementById("share-link-box")?.classList.add("hidden");
  const dot = document.getElementById("share-dot"),
    txt = document.getElementById("share-text");
  if (dot) dot.className = "status-dot";
  if (txt) txt.textContent = "Đã dừng chia sẻ vị trí.";
  addAlertLog("🔕", "Đã dừng chia sẻ vị trí.", "safe");
}
function copyShareLink() {
  const input = document.getElementById("share-link");
  if (!input) return;
  navigator.clipboard
    .writeText(input.value)
    .then(() => showToast("✅ Đã copy link chia sẻ!"))
    .catch(() => {
      input.select();
      document.execCommand("copy");
      showToast("✅ Đã copy!");
    });
}
function addFamilyMember() {
  const name = prompt("Nhập tên thành viên:");
  if (!name) return;
  const emojis = ["👨", "👩", "👦", "👧", "👴", "👵"];
  STATE.familyMembers.push({
    id: Date.now(),
    name,
    emoji: emojis[Math.floor(Math.random() * 6)],
    lat: (STATE.lat || 21.03) + (Math.random() - 0.5) * 0.02,
    lon: (STATE.lon || 105.84) + (Math.random() - 0.5) * 0.02,
    status: "unknown",
    lastSeen: "Chưa kết nối",
    city: "Chưa xác định",
  });
  renderFamilyMembers();
}

// ============================================================
// NOTIFICATIONS + TOAST
// ============================================================
async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default")
    await Notification.requestPermission();
}
function showToast(msg, duration = 3000) {
  const old = document.querySelector(".sw-toast");
  if (old) old.remove();
  const toast = document.createElement("div");
  toast.className = "sw-toast";
  toast.textContent = msg;
  toast.style.cssText =
    "position:fixed;bottom:24px;right:24px;z-index:9999;background:#0b1628;border:1px solid #00d4ff;color:#e8f4ff;padding:12px 20px;border-radius:8px;font-family:Exo 2,sans-serif;font-size:.88rem;box-shadow:0 4px 20px rgba(0,0,0,.5)";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ============================================================
// CHECKLIST
// ============================================================
function initChecklist() {
  document
    .querySelectorAll('.check-item input[type="checkbox"]')
    .forEach((cb) => {
      cb.addEventListener("change", () => {
        const all = document.querySelectorAll(
          '.check-item input[type="checkbox"]',
        );
        const checked = document.querySelectorAll(
          '.check-item input[type="checkbox"]:checked',
        );
        const pct = (checked.length / all.length) * 100;
        const fill = document.getElementById("checklist-fill"),
          count = document.getElementById("checklist-count");
        if (fill) fill.style.width = `${pct}%`;
        if (count)
          count.textContent = `${checked.length}/${all.length} hoàn thành`;
      });
    });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  startClock();
  await requestNotificationPermission();
  // Xóa cache cũ có lưu vị trí
  try {
    const old = localStorage.getItem(CACHE_KEY);
    if (old) {
      const p = JSON.parse(old);
      if (p.lat || p.lon) {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  } catch {}
  await fetchWeather();
  renderFamilyMembers();
  initChecklist();
  initWindy();
  setInterval(fetchWeather, CONFIG.UPDATE_INT);
  addAlertLog(
    "🛡",
    "SafeWeather v3.0 — Dual API | GPS Fast | OpenStreetMap",
    "safe",
  );
  console.log(
    "%c🛡 SafeWeather v3.0",
    "color:#00d4ff;font-size:16px;font-weight:bold",
  );
}

document.addEventListener("DOMContentLoaded", init);
