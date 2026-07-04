import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import "./adminPricing.css";

const DEFAULT_GROUPS = {
  "Malls — Pune": ["phoenix_marketcity_pune", "amanora_mall", "seasons_mall", "westend_mall", "pavilion_mall", "elpro_city_square", "the_pavillion"],
  "Hotels — Pune": ["jw_marriott_pune", "conrad_pune", "ritz_carlton_pune", "hyatt_regency_pune", "sheraton_grand_pune", "novotel_pune", "blue_diamond_pune"],
  "Other Locations": ["hospital", "metro", "airport", "other"],
};

const KEY_LABELS = {
  phoenix_marketcity_pune: "Phoenix Marketcity Pune", amanora_mall: "Amanora Mall",
  seasons_mall: "Seasons Mall", westend_mall: "Westend Mall", pavilion_mall: "Pavilion Mall",
  elpro_city_square: "Elpro City Square", the_pavillion: "The Pavillion",
  jw_marriott_pune: "JW Marriott Hotel Pune", conrad_pune: "Conrad Pune",
  ritz_carlton_pune: "The Ritz-Carlton, Pune", hyatt_regency_pune: "Hyatt Regency Pune",
  sheraton_grand_pune: "Sheraton Grand Pune", novotel_pune: "Novotel Pune",
  blue_diamond_pune: "Blue Diamond Pune", hospital: "Hospital",
  metro: "Metro Station", airport: "Airport", other: "Other",
};

function toKey(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function AdminPricing() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [keyLabels, setKeyLabels] = useState(KEY_LABELS);
  const [newEntries, setNewEntries] = useState({ "Malls — Pune": "", "Hotels — Pune": "", "Other Locations": "" });
  const [newGroup, setNewGroup] = useState("");

  useEffect(() => {
    api.get("/pricing").then((res) => {
      setConfig(res.data);
      // Rebuild groups from all keys in placementMultipliers not already in defaults
      const allKeys = Object.keys(res.data.placementMultipliers || {});
      const knownKeys = Object.values(DEFAULT_GROUPS).flat();
      const extra = allKeys.filter((k) => !knownKeys.includes(k));
      if (extra.length) {
        setGroups((prev) => ({ ...prev, "Custom": extra }));
        const extraLabels = {};
        extra.forEach((k) => { extraLabels[k] = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); });
        setKeyLabels((prev) => ({ ...prev, ...extraLabels }));
      }
    }).catch(() => toast.error("Failed to load pricing."));
  }, []);

  const set = (field, val) => setConfig((prev) => ({ ...prev, [field]: val }));
  const setPlacement = (key, val) =>
    setConfig((prev) => ({ ...prev, placementMultipliers: { ...prev.placementMultipliers, [key]: val } }));
  const removeLocation = (group, key) => {
    setGroups((prev) => ({ ...prev, [group]: prev[group].filter((k) => k !== key) }));
    setConfig((prev) => {
      const updated = { ...prev.placementMultipliers };
      delete updated[key];
      return { ...prev, placementMultipliers: updated };
    });
  };

  const addLocation = (group) => {
    const name = newEntries[group]?.trim();
    if (!name) return;
    const key = toKey(name);
    if (!key) return;
    setGroups((prev) => ({ ...prev, [group]: [...(prev[group] || []), key] }));
    setKeyLabels((prev) => ({ ...prev, [key]: name }));
    setConfig((prev) => ({ ...prev, placementMultipliers: { ...prev.placementMultipliers, [key]: 1.0 } }));
    setNewEntries((prev) => ({ ...prev, [group]: "" }));
  };

  const addGroup = () => {
    const name = newGroup.trim();
    if (!name || groups[name]) return;
    setGroups((prev) => ({ ...prev, [name]: [] }));
    setNewEntries((prev) => ({ ...prev, [name]: "" }));
    setNewGroup("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put("/pricing", config);
      setConfig(res.data);
      toast.success("Pricing saved.");
    } catch {
      toast.error("Failed to save pricing.");
    } finally {
      setSaving(false);
    }
  };

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const setPeakScheduleEntry = (idx, field, val) =>
    setConfig((prev) => {
      const updated = [...(prev.peakSchedule || [])];
      updated[idx] = { ...updated[idx], [field]: Number(val) };
      return { ...prev, peakSchedule: updated };
    });

  const removePeakEntry = (idx) =>
    setConfig((prev) => ({ ...prev, peakSchedule: prev.peakSchedule.filter((_, i) => i !== idx) }));

  const addPeakEntry = () =>
    setConfig((prev) => ({ ...prev, peakSchedule: [...(prev.peakSchedule || []), { day: 5, startHour: 18, endHour: 23 }] }));

  const previewTotal = (mult) => {
    if (!config) return "—";
    const d = config.defaultDurationDays || 30;
    const r = config.defaultRepeatRate || 3;
    const s = 30;
    const base = s * (config.costPerSecond ?? 10) * r * d * mult;
    const withFee = base + config.platformFee;
    const total = Math.round(withFee * (1 + config.gstRate));
    return `₹${total.toLocaleString("en-IN")}`;
  };

  if (!config) return (
    <div className="ap-loading">
      <div className="ap-loading-dot" /><div className="ap-loading-dot" /><div className="ap-loading-dot" />
    </div>
  );

  return (
    <div className="ap-page">
      <div className="ap-inner">

        {/* Header */}
        <div className="ap-header">
          <div>
            <p className="ap-eyebrow">Admin</p>
            <h1 className="ap-title">Pricing Configuration</h1>
            <p className="ap-subtitle">All changes apply immediately to new campaign estimates.</p>
          </div>
          <button className="ap-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {config.updatedBy && <p className="ap-updated">Last updated by {config.updatedBy}</p>}

        {/* Formula */}
        <div className="ap-formula-card">
          <p className="ap-section-label">Pricing Formula</p>
          <div className="ap-formula-steps">
            <div className="ap-fstep"><span className="ap-fnum">1</span><span>Video Duration (s) × Cost/s × Repeat Rate = <strong>Daily Base</strong></span></div>
            <div className="ap-fstep"><span className="ap-fnum">2</span><span>(Off-peak Days × 1× + Peak Days × Peak Multiplier) × Daily Base = <strong>Base Cost</strong></span></div>
            <div className="ap-fstep"><span className="ap-fnum">3</span><span>Base Cost × Placement Multiplier = <strong>Adjusted Cost</strong></span></div>
            <div className="ap-fstep"><span className="ap-fnum">4</span><span>Adjusted Cost + Platform Fee = <strong>Subtotal</strong></span></div>
            <div className="ap-fstep"><span className="ap-fnum">5</span><span>Subtotal × (1 + GST Rate) = <strong>Total</strong></span></div>
          </div>
        </div>

        {/* Base Rates */}
        <div className="ap-card">
          <p className="ap-section-label">Base Rates</p>
          <div className="ap-grid-3">
            <div className="ap-field">
              <label>Cost Per Second (₹)</label>
              <input type="number" step="0.5" min="0" value={config.costPerSecond ?? 10} onChange={(e) => set("costPerSecond", Number(e.target.value))} />
            </div>
            <div className="ap-field">
              <label>Platform Fee (₹)</label>
              <input type="number" step="1" min="0" value={config.platformFee} onChange={(e) => set("platformFee", Number(e.target.value))} />
            </div>
            <div className="ap-field">
              <label>GST Rate (0.18 = 18%)</label>
              <input type="number" step="0.01" min="0" max="1" value={config.gstRate} onChange={(e) => set("gstRate", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="ap-card">
          <p className="ap-section-label">Peak Hours Pricing</p>
          <p className="ap-hint" style={{ marginBottom: 12 }}>
            Days matching the schedule below are charged at <strong>Base Cost × Peak Multiplier</strong>. Off-peak days use 1×.
          </p>
          <div className="ap-grid-3" style={{ marginBottom: 16 }}>
            <div className="ap-field">
              <label>Peak Multiplier</label>
              <input
                type="number" step="0.1" min="1"
                value={config.peakMultiplier ?? 1.5}
                onChange={(e) => set("peakMultiplier", Number(e.target.value))}
              />
              <span className="ap-hint">e.g. 1.5 = 50% surcharge on peak days</span>
            </div>
          </div>

          <p className="ap-section-label" style={{ fontSize: 12, marginBottom: 8 }}>Peak Schedule</p>
          {(config.peakSchedule || []).map((entry, idx) => (
            <div key={idx} className="ap-add-row" style={{ marginBottom: 8 }}>
              <select
                value={entry.day}
                onChange={(e) => setPeakScheduleEntry(idx, "day", e.target.value)}
                className="ap-add-input"
                style={{ maxWidth: 140 }}
              >
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input
                type="number" min="0" max="23" placeholder="Start Hr"
                value={entry.startHour}
                onChange={(e) => setPeakScheduleEntry(idx, "startHour", e.target.value)}
                className="ap-mult-input"
                style={{ width: 80 }}
              />
              <span style={{ alignSelf: "center", color: "#888" }}>to</span>
              <input
                type="number" min="0" max="23" placeholder="End Hr"
                value={entry.endHour}
                onChange={(e) => setPeakScheduleEntry(idx, "endHour", e.target.value)}
                className="ap-mult-input"
                style={{ width: 80 }}
              />
              <button className="ap-remove-btn" onClick={() => removePeakEntry(idx)}>×</button>
            </div>
          ))}
          <button className="ap-add-btn" style={{ marginTop: 4 }} onClick={addPeakEntry}>+ Add Day</button>
        </div>

        {/* Campaign Defaults */}
        <div className="ap-card">
          <p className="ap-section-label">Campaign Defaults</p>
          <div className="ap-grid-4">
            <div className="ap-field">
              <label>Default Duration (days)</label>
              <input type="number" step="1" min="1" value={config.defaultDurationDays} onChange={(e) => set("defaultDurationDays", Number(e.target.value))} />
              <span className="ap-hint">Pre-filled in campaign form</span>
            </div>
            <div className="ap-field">
              <label>Default Repeat Rate</label>
              <input type="number" step="1" min="1" value={config.defaultRepeatRate} onChange={(e) => set("defaultRepeatRate", Number(e.target.value))} />
              <span className="ap-hint">Plays per day default</span>
            </div>
            <div className="ap-field">
              <label>Min Repeat Rate</label>
              <input type="number" step="1" min="1" value={config.minRepeatRate} onChange={(e) => set("minRepeatRate", Number(e.target.value))} />
            </div>
            <div className="ap-field">
              <label>Max Repeat Rate</label>
              <input type="number" step="1" min="1" value={config.maxRepeatRate} onChange={(e) => set("maxRepeatRate", Number(e.target.value))} />
            </div>
          </div>
        </div>

        {/* Placement Groups */}
        {Object.entries(groups).map(([groupName, keys]) => (
          <div key={groupName} className="ap-card">
            <div className="ap-card-header">
              <p className="ap-section-label">{groupName}</p>
              <span className="ap-badge">{keys.length} locations</span>
            </div>

            <div className="ap-location-grid">
              {keys.map((key) => {
                const mult = config.placementMultipliers?.[key] ?? 1;
                return (
                  <div key={key} className="ap-location-item">
                    <div className="ap-location-top">
                      <span className="ap-location-name">{keyLabels[key] || key}</span>
                      <button className="ap-remove-btn" onClick={() => removeLocation(groupName, key)} title="Remove">×</button>
                    </div>
                    <div className="ap-location-bottom">
                      <div className="ap-mult-row">
                        <span className="ap-mult-label">Multiplier</span>
                        <input
                          type="number" step="0.1" min="0.1"
                          value={mult}
                          onChange={(e) => setPlacement(key, Number(e.target.value))}
                          className="ap-mult-input"
                        />
                      </div>
                      <span className="ap-location-preview">~{previewTotal(mult)} / 30d</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add location */}
            <div className="ap-add-row">
              <input
                type="text"
                placeholder={`Add ${groupName.split(" — ")[0].toLowerCase()} name...`}
                value={newEntries[groupName] || ""}
                onChange={(e) => setNewEntries((prev) => ({ ...prev, [groupName]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addLocation(groupName)}
                className="ap-add-input"
              />
              <button className="ap-add-btn" onClick={() => addLocation(groupName)}>+ Add</button>
            </div>
          </div>
        ))}

        {/* Add new group */}
        <div className="ap-card ap-new-group-card">
          <p className="ap-section-label">Add New Location Group</p>
          <div className="ap-add-row">
            <input
              type="text"
              placeholder="e.g. Airports — Mumbai"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
              className="ap-add-input"
            />
            <button className="ap-add-btn" onClick={addGroup}>+ Create Group</button>
          </div>
        </div>

        <div className="ap-save-bar">
          <button className="ap-save-btn ap-save-btn-lg" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Pricing Config"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminPricing;
