(() => {
  "use strict";
  const REFRESH_MS = 3000;
  const machineGrid = document.getElementById("machineGrid");
  const alertsContent = document.getElementById("alertsContent");
  const chart = document.getElementById("temperatureChart");
  const chartStatus = document.getElementById("chartStatus");
  const connectionState = document.getElementById("connectionState");
  const connectionText = document.getElementById("connectionText");
  const pauseButton = document.getElementById("pauseButton");
  const pauseLabel = document.getElementById("pauseLabel");
  const windows = [...document.querySelectorAll(".window-button")];
  const machineColors = ["#218b7b", "#dc7049", "#648ba1"];
  let chartWindow = 20;
  let dashboard = null;
  let readings = [];
  let timer = null;
  let paused = false;
  let busy = false;
  let hasLoaded = false;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const byId = (id) => document.getElementById(id);
  const formatTemp = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "—";
  const dateLabel = (value, options = {}) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, options).format(date);
  };
  const machineGlyph = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19V8.5L12 5l7 3.5V19M8 19v-5h8v5M9 9.5h.01M15 9.5h.01M12 9.5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 19h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  async function api(path) {
    const response = await fetch(path, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
  }

  function setConnection(state, text) {
    connectionState.dataset.state = state;
    connectionText.textContent = text;
  }

  function renderSummary(snapshot) {
    const summary = snapshot.summary || {};
    byId("onlineCount").textContent = summary.online_machines ?? "—";
    byId("totalCount").textContent = summary.total_machines ?? snapshot.machines?.length ?? "—";
    byId("connectedCount").textContent = summary.connected_machines ?? "—";
    byId("avgTemperature").textContent = formatTemp(summary.avg_temperature_c);
    byId("alertCount").textContent = summary.active_alerts ?? snapshot.alerts?.filter((alert) => !alert.acknowledged).length ?? "—";
    byId("connectivityCount").textContent = summary.connected_machines ?? "—";
    byId("connectivityTotal").textContent = summary.total_machines ?? snapshot.machines?.length ?? "—";
    byId("alertBadge").textContent = summary.active_alerts ?? "0";
    byId("alertFoot").textContent = Number(summary.active_alerts) > 0 ? "THERMAL EVENTS DETECTED" : "HEAT THRESHOLD MONITORING";
    byId("fleetLabel").textContent = `${summary.total_machines ?? snapshot.machines?.length ?? 0} NODES`;
    byId("updatedAt").textContent = snapshot.updated_at ? `SYNC ${dateLabel(snapshot.updated_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Updated moments ago";
  }

  function renderMachines(machines = []) {
    machineGrid.setAttribute("aria-busy", "false");
    if (!machines.length) {
      machineGrid.innerHTML = `<div class="empty-state"><strong>No machines in this view</strong>Machine telemetry will appear when available.</div>`;
      return;
    }
    machineGrid.innerHTML = machines.map((machine, index) => {
      const warning = machine.status === "warning";
      const connected = machine.connectivity === "connected";
      const threshold = Number(machine.threshold_c) || 1;
      const percentage = Math.max(0, Math.min(100, Number(machine.temperature_c) / threshold * 100));
      const machineTime = machine.last_updated ? dateLabel(machine.last_updated, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
      return `<article class="machine-card" data-testid="card-machine-${esc(machine.id)}">
        <div class="machine-top">
          <div class="machine-identity"><span class="machine-icon">${machineGlyph}</span><div class="machine-title"><h3>${esc(machine.name)}</h3><span>${esc(machine.location)}</span></div></div>
          <span class="status-pill ${warning ? "warning" : connected ? "normal" : "disconnected"}">${warning ? "Warning" : connected ? "Normal" : "Offline"}</span>
        </div>
        <div class="machine-reading ${warning ? "warning" : ""}"><strong>${formatTemp(machine.temperature_c)}</strong><span>°C</span><span class="reading-trend">LIMIT ${formatTemp(machine.threshold_c)}°</span></div>
        <div class="threshold-line" aria-label="Temperature at ${Math.round(percentage)} percent of threshold"><div class="threshold-fill ${warning ? "warning" : ""}" style="width:${percentage}%"></div></div>
        <div class="machine-meta"><span class="machine-connectivity ${connected ? "" : "offline"}"><i></i>${connected ? `CONNECTED · ${Number(machine.signal_strength) || 0}%` : "DISCONNECTED"}</span><span>SIM ${machineTime}</span></div>
      </article>`;
    }).join("");
  }

  function renderAlerts(alerts = []) {
    alertsContent.setAttribute("aria-busy", "false");
    const active = alerts.filter((alert) => !alert.acknowledged);
    if (!active.length) {
      alertsContent.innerHTML = `<div class="empty-state"><strong>All clear</strong>No active overheating events. Threshold monitoring remains on.<br><span class="sim-mini">SIMULATED ALERT FEED</span></div>`;
      return;
    }
    alertsContent.innerHTML = active.slice(0, 4).map((alert) => `<article class="alert-item" data-testid="alert-item-${esc(alert.id)}">
      <span class="alert-symbol" aria-hidden="true">!</span>
      <div class="alert-copy"><strong>${esc(alert.machine_name)} · thermal limit</strong><p>${esc(alert.message)} <b>${formatTemp(alert.temperature_c)}°C</b></p></div>
      <time class="alert-time" datetime="${esc(alert.timestamp)}">${dateLabel(alert.timestamp, { hour: "2-digit", minute: "2-digit" })}</time>
    </article>`).join("");
  }

  function showDashboardError(error) {
    setConnection("error", "Connection issue · retrying");
    if (hasLoaded) {
      byId("liveAnnouncement").textContent = "Live telemetry update failed. The last successful snapshot is still shown.";
      return;
    }
    machineGrid.setAttribute("aria-busy", "false");
    alertsContent.setAttribute("aria-busy", "false");
    machineGrid.innerHTML = `<div class="empty-state"><strong>Telemetry unavailable</strong>${esc(error.message)}<br><button class="retry-button" id="retryButton" type="button">Retry connection</button></div>`;
    alertsContent.innerHTML = `<div class="empty-state"><strong>Alert feed unavailable</strong>Reconnect to retrieve simulated events.</div>`;
    chartStatus.className = "chart-status error";
    chartStatus.textContent = "Unable to load simulated readings";
    byId("retryButton")?.addEventListener("click", () => refresh(true));
  }

  async function loadReadings() {
    chartStatus.className = "chart-status";
    chartStatus.textContent = readings.length ? "" : "Loading simulated readings…";
    try {
      const data = await api(`/api/readings?limit=${chartWindow}`);
      readings = Array.isArray(data) ? data : [];
      drawChart(readings, dashboard?.machines || []);
    } catch (error) {
      chartStatus.className = "chart-status error";
      chartStatus.textContent = readings.length ? "" : "Readings unavailable · retrying";
      if (readings.length) drawChart(readings, dashboard?.machines || []);
      console.warn("Unable to retrieve simulated readings", error);
    }
  }

  async function refresh(force = false) {
    if (busy || (paused && !force)) return;
    busy = true;
    if (!hasLoaded) setConnection("connecting", "Connecting to edge network");
    try {
      const snapshot = await api("/api/dashboard");
      if (!snapshot || !snapshot.summary || !Array.isArray(snapshot.machines)) throw new Error("Dashboard response was incomplete");
      dashboard = snapshot;
      hasLoaded = true;
      renderSummary(snapshot);
      renderMachines(snapshot.machines);
      renderAlerts(snapshot.alerts || []);
      setConnection("connected", `Live · synced ${dateLabel(snapshot.updated_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
      byId("liveAnnouncement").textContent = "Simulated fleet telemetry updated.";
      await loadReadings();
    } catch (error) {
      showDashboardError(error);
    } finally {
      busy = false;
    }
  }

  function drawChart(data, machines) {
    chart.replaceChildren();
    chartStatus.textContent = "";
    chartStatus.className = "chart-status";
    if (!Array.isArray(data) || !data.length) {
      chartStatus.textContent = "No readings in this window";
      return;
    }
    const width = 800, height = 250;
    const padding = { top: 12, right: 12, bottom: 28, left: 42 };
    const usableW = width - padding.left - padding.right;
    const usableH = height - padding.top - padding.bottom;
    const stamps = data.map((item) => new Date(item.timestamp).getTime()).filter(Number.isFinite);
    const minTime = Math.min(...stamps), maxTime = Math.max(...stamps);
    const values = data.map((item) => Number(item.temperature_c)).filter(Number.isFinite);
    const thresholds = machines.map((machine) => Number(machine.threshold_c)).filter(Number.isFinite);
    const lo = Math.floor(Math.min(...values, ...thresholds) - 2);
    const hi = Math.ceil(Math.max(...values, ...thresholds) + 2);
    const x = (time) => padding.left + (maxTime === minTime ? .5 : (time - minTime) / (maxTime - minTime)) * usableW;
    const y = (value) => padding.top + (hi - value) / (hi - lo || 1) * usableH;
    const svgEl = (name, attributes = {}) => {
      const el = document.createElementNS("http://www.w3.org/2000/svg", name);
      Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, String(value)));
      chart.appendChild(el);
      return el;
    };
    for (let step = 0; step <= 4; step += 1) {
      const val = lo + (hi - lo) * step / 4;
      const yy = y(val);
      svgEl("line", { x1: padding.left, x2: width - padding.right, y1: yy, y2: yy, stroke: "#e9eeea", "stroke-width": 1 });
      const label = svgEl("text", { x: padding.left - 9, y: yy + 3, fill: "#98a39e", "font-size": 9, "text-anchor": "end", "font-family": "DM Mono, monospace" });
      label.textContent = `${val.toFixed(0)}°`;
    }
    const thresholdValues = machines.map((item) => Number(item.threshold_c)).filter(Number.isFinite);
    if (thresholdValues.length) {
      const threshold = Math.min(...thresholdValues);
      svgEl("line", { x1: padding.left, x2: width - padding.right, y1: y(threshold), y2: y(threshold), stroke: "#dc9272", "stroke-width": 1, "stroke-dasharray": "4 5" });
    }
    for (let tick = 0; tick <= 3; tick += 1) {
      const time = minTime + (maxTime - minTime) * tick / 3;
      const label = svgEl("text", { x: x(time), y: height - 7, fill: "#98a39e", "font-size": 8, "text-anchor": tick === 0 ? "start" : tick === 3 ? "end" : "middle", "font-family": "DM Mono, monospace" });
      label.textContent = dateLabel(time, { hour: "2-digit", minute: "2-digit" });
    }
    const ids = [...new Set(data.map((reading) => reading.machine_id))];
    ids.forEach((id, index) => {
      const series = data.filter((reading) => reading.machine_id === id && Number.isFinite(Number(reading.temperature_c))).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      if (!series.length) return;
      const points = series.map((reading) => `${x(new Date(reading.timestamp).getTime())},${y(Number(reading.temperature_c))}`).join(" ");
      svgEl("polyline", { points, fill: "none", stroke: machineColors[index % machineColors.length], "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: .95 });
      const last = series[series.length - 1];
      svgEl("circle", { cx: x(new Date(last.timestamp).getTime()), cy: y(Number(last.temperature_c)), r: 3.5, fill: machineColors[index % machineColors.length], stroke: "#fbfcfa", "stroke-width": 2 });
    });
    byId("chartRange").textContent = `${dateLabel(minTime, { hour: "2-digit", minute: "2-digit" })} — ${dateLabel(maxTime, { hour: "2-digit", minute: "2-digit" })} · ${data.length} SAMPLES`;
  }

  windows.forEach((button) => button.addEventListener("click", () => {
    chartWindow = Number(button.dataset.window);
    windows.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    loadReadings();
  }));

  pauseButton.addEventListener("click", () => {
    paused = !paused;
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseLabel.textContent = paused ? "Resume live" : "Pause live";
    pauseButton.querySelector(".pause-glyph").textContent = paused ? "▶" : "Ⅱ";
    if (paused) {
      clearInterval(timer);
      timer = null;
      setConnection("paused", "Updates paused · snapshot held");
    } else {
      setConnection(hasLoaded ? "connected" : "connecting", hasLoaded ? "Refreshing live snapshot" : "Connecting to edge network");
      refresh(true);
      timer = setInterval(() => refresh(), REFRESH_MS);
    }
  });

  refresh();
  timer = setInterval(() => refresh(), REFRESH_MS);
})();