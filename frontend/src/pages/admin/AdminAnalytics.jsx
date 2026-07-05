import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/useAuth";
import api from "../../api/axios";
import { compactNumber } from "../../utils/format";
import "./AdminAnalytics.css";
import "../FeaturePages.css";

const AGE_COLORS = {
  "0-12": "#89a9c9",
  "13-18": "#00a8cc",
  "19-25": "#0055cc",
  "26-35": "#2a4a6a",
  "36-50": "#b2294b",
  "50+": "#d98c3d",
};

const GENDER_COLORS = {
  male: "#0055cc",
  female: "#b2294b",
  unknown: "#89a9c9",
};

const BRAND_BAR_COLORS = ["#0055cc", "#00a8cc", "#2a4a6a", "#b2294b", "#d98c3d", "#89a9c9"];

function AdminAnalytics() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [loadingCampaignAnalytics, setLoadingCampaignAnalytics] = useState(false);
  const [revenue, setRevenue] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    if (user && user.role !== "admin") {
      navigate("/dashboard");
      return;
    }
  }, [token, user, navigate]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/admin/analytics/overview")
      .then((res) => setOverview(res.data.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/admin/analytics/revenue")
      .then((res) => setRevenue(res.data.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/admin/analytics/campaigns")
      .then((res) => {
        const list = res.data.data || [];
        setCampaigns(list);
        if (list.length > 0) {
          setSelectedCampaignId(list[0].id);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !selectedCampaignId) return;
    setLoadingCampaignAnalytics(true);
    api
      .get(`/admin/analytics/campaigns/${selectedCampaignId}`)
      .then((res) => setCampaignAnalytics(res.data.data))
      .catch(() => setCampaignAnalytics(null))
      .finally(() => setLoadingCampaignAnalytics(false));
  }, [token, selectedCampaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId),
    [campaigns, selectedCampaignId],
  );

  const genderChartData = useMemo(() => {
    if (!campaignAnalytics?.genderDistribution) return [];
    return campaignAnalytics.genderDistribution
      .filter((row) => row.count > 0)
      .map((row) => ({
        name: row.gender,
        value: row.count,
        fill: GENDER_COLORS[row.gender] || "#89a9c9",
      }));
  }, [campaignAnalytics]);

  const topBrandsChartData = useMemo(() => {
    if (!revenue?.byBrand) return [];
    return revenue.byBrand.slice(0, 8).map((row, i) => ({
      ...row,
      fill: BRAND_BAR_COLORS[i % BRAND_BAR_COLORS.length],
    }));
  }, [revenue]);

  return (
    <div className="page-shell">
      <div className="feature-page-hero feature-page-card">
        <p className="feature-eyebrow">Admin</p>
        <h1 className="feature-title">Analytics</h1>
        <p className="feature-copy">
          Impressions, audience age/gender mix, and time-of-day trends per campaign —
          currently running on generated demo data until the robots start sending live events.
        </p>
      </div>

      <div className="feature-metrics-row" style={{ marginBottom: "1.25rem" }}>
        <div className="feature-metric-card">
          <span>{overview ? compactNumber(overview.totalImpressions) : "—"}</span>
          <p>Total impressions</p>
        </div>
        <div className="feature-metric-card">
          <span>{overview ? compactNumber(overview.totalDisplays) : "—"}</span>
          <p>Total displays</p>
        </div>
        <div className="feature-metric-card">
          <span>{overview?.activeRobots ?? "—"}</span>
          <p>Active robots (24h)</p>
        </div>
        <div className="feature-metric-card">
          <span>{overview?.campaignsTracked ?? "—"}</span>
          <p>Campaigns tracked</p>
        </div>
      </div>

      {/* ---------------- Revenue section (admin-only) ---------------- */}
      <div className="feature-page-card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-kicker">Network Revenue</p>
        <h2 className="feature-title">Money in, by brand</h2>
        <p className="feature-copy feature-copy-tight">
          Revenue is spend-to-date where available, falling back to the quoted
          campaign cost otherwise.
        </p>

        <div className="feature-metrics-row" style={{ marginTop: "1rem", marginBottom: "1.25rem" }}>
          <div className="feature-metric-card">
            <span>{revenue ? `$${compactNumber(revenue.totalRevenue)}` : "—"}</span>
            <p>Total revenue</p>
          </div>
          <div className="feature-metric-card">
            <span>{revenue?.totalCampaigns ?? "—"}</span>
            <p>Campaigns counted</p>
          </div>
          <div className="feature-metric-card">
            <span>{revenue?.topBrand || "—"}</span>
            <p>Top-paying brand</p>
          </div>
        </div>

        {revenue?.byBrand?.length > 0 && (
          <>
            <div className="feature-chart-wrap" style={{ marginBottom: "1.25rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topBrandsChartData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e8f3" />
                  <XAxis type="number" tick={{ fill: "#2a4a6a", fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="brandName"
                    tick={{ fill: "#2a4a6a", fontSize: 12 }}
                    width={110}
                  />
                  <Tooltip formatter={(value) => [`$${compactNumber(value)}`, "Revenue"]} />
                  <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                    {topBrandsChartData.map((entry) => (
                      <Cell key={entry.brandName} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="feature-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>Brand</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>Campaigns</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.byBrand.map((row) => (
                    <tr key={row.brandName} style={{ borderTop: "1px solid #d9e8f3" }}>
                      <td style={{ padding: "0.5rem" }}>{row.brandName}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem" }}>{row.campaignCount}</td>
                      <td style={{ textAlign: "right", padding: "0.5rem" }}>
                        ${compactNumber(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {/* -------------- end Revenue section -------------- */}

      <div className="feature-page-card" style={{ marginBottom: "1.25rem" }}>
        <p className="section-kicker">Per-campaign audience analytics</p>
        <h2 className="feature-title">Who's looking at this ad, and when</h2>
        <p className="feature-copy feature-copy-tight">
          Select an ad/campaign to see how many people looked at it, their age group split,
          and which hours it gets the most attention.
        </p>

        {campaigns.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>
            No campaigns found yet — create a campaign to see analytics here.
          </p>
        ) : (
          <select
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
            style={{
              marginTop: "0.75rem",
              padding: "0.6rem 0.9rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color, #d9e8f3)",
              fontFamily: "inherit",
              fontSize: "0.9rem",
              minWidth: "260px",
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brandName} — {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadingCampaignAnalytics ? (
        <div className="feature-page-card" style={{ textAlign: "center", padding: "2rem" }}>
          <p>Loading analytics for {selectedCampaign?.brandName || "campaign"}...</p>
        </div>
      ) : campaignAnalytics ? (
        <>
          <div className="feature-metrics-row" style={{ marginBottom: "1.25rem" }}>
            <div className="feature-metric-card">
              <span>{compactNumber(campaignAnalytics.totalImpressions)}</span>
              <p>Impressions — {selectedCampaign?.brandName}</p>
            </div>
            <div className="feature-metric-card">
              <span>{campaignAnalytics.insights?.topAgeGroup || "—"}</span>
              <p>Top age group</p>
            </div>
            <div className="feature-metric-card">
              <span>{campaignAnalytics.insights?.peakHour || "—"}</span>
              <p>Peak hour</p>
            </div>
          </div>

          <section className="page-width feature-grid-two">
            <div className="feature-card feature-page-card feature-chart-card">
              <p className="section-kicker">Audience Age Mix</p>
              <h2 className="feature-title">Who's viewing this ad</h2>
              <div className="feature-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignAnalytics.ageDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d9e8f3" />
                    <XAxis dataKey="ageGroup" tick={{ fill: "#2a4a6a", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#2a4a6a", fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                      {campaignAnalytics.ageDistribution.map((entry) => (
                        <Cell key={entry.ageGroup} fill={AGE_COLORS[entry.ageGroup]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="feature-card feature-page-card feature-chart-card">
              <p className="section-kicker">Gender Mix</p>
              <h2 className="feature-title">Audience composition</h2>
              <div className="feature-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      dataKey="value"
                      innerRadius={62}
                      outerRadius={110}
                      paddingAngle={4}
                    >
                      {genderChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="page-width feature-card feature-page-card feature-chart-card" style={{ marginTop: "1.25rem" }}>
            <p className="section-kicker">Time of Day</p>
            <h2 className="feature-title">When people look at this ad</h2>
            <div className="feature-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={campaignAnalytics.hourlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e8f3" />
                  <XAxis dataKey="hour" tick={{ fill: "#2a4a6a", fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fill: "#2a4a6a", fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#00a8cc" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="page-width feature-card feature-page-card feature-chart-card" style={{ marginTop: "1.25rem" }}>
            <p className="section-kicker">Age Group × Time of Day</p>
            <h2 className="feature-title">Who's watching, and exactly when</h2>
            <p className="feature-copy feature-copy-tight">
              E.g. "6pm: 12 people aged 19-25 looked at this ad" — read straight off the stacked bars.
            </p>
            <div className="feature-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignAnalytics.ageByHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e8f3" />
                  <XAxis dataKey="hour" tick={{ fill: "#2a4a6a", fontSize: 11 }} interval={2} />
                  <YAxis tick={{ fill: "#2a4a6a", fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                  {Object.keys(AGE_COLORS).map((ageGroup) => (
                    <Bar key={ageGroup} dataKey={ageGroup} stackId="age" fill={AGE_COLORS[ageGroup]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : (
        <div className="feature-page-card" style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "var(--text-secondary)" }}>
            No audience data for this campaign yet.
          </p>
        </div>
      )}
    </div>
  );
}

export default AdminAnalytics;