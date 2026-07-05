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
import { useAuth } from "../context/useAuth";
import api from "../api/axios";
import { compactNumber } from "../utils/format";
import "./admin/AdminAnalytics.css";
import "./FeaturePages.css";

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

function Analytics() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [loadingCampaignAnalytics, setLoadingCampaignAnalytics] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/analytics/overview")
      .then((res) => setOverview(res.data.data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    api
      .get("/analytics/campaigns")
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
      .get(`/analytics/campaigns/${selectedCampaignId}`)
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

  return (
    <div className="page-shell">
      <div className="feature-page-hero feature-page-card">
        <p className="feature-eyebrow">Analytics</p>
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

export default Analytics;