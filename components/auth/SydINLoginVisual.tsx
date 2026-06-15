import SydINMark from "@/components/brand/SydINMark";
import UiIcon, { type UiIconName } from "@/components/UiIcon";

const metrics: Array<{
  label: string;
  detail: string;
  icon: UiIconName;
  tone: string;
}> = [
  {
    label: "Catalog",
    detail: "Organized",
    icon: "box",
    tone: "blue",
  },
  {
    label: "Stock",
    detail: "In sync",
    icon: "layers",
    tone: "cyan",
  },
  {
    label: "Attention",
    detail: "Review ready",
    icon: "alert",
    tone: "violet",
  },
];

const activity = [
  ["Stock level updated", "Warehouse team"],
  ["New item organized", "Inventory team"],
  ["Code scan completed", "Mobile workflow"],
];

export default function SydINLoginVisual() {
  return (
    <aside className="login-visual" aria-hidden="true">
      <div className="login-visual-glow login-visual-glow-one" />
      <div className="login-visual-glow login-visual-glow-two" />
      <div className="login-orbit login-orbit-one" />
      <div className="login-orbit login-orbit-two" />
      <span className="login-orbit-dot login-orbit-dot-one" />
      <span className="login-orbit-dot login-orbit-dot-two" />

      <span className="login-cube login-cube-one">
        <i />
        <b />
        <em />
      </span>
      <span className="login-cube login-cube-two">
        <i />
        <b />
        <em />
      </span>

      <div className="login-dashboard-wrap">
        <div className="login-dashboard-shadow" />
        <div className="login-dashboard">
          <nav className="login-dashboard-rail">
            <SydINMark size="md" />
            {(["dashboard", "box", "scan", "reports"] as UiIconName[]).map(
              (icon, index) => (
                <span
                  key={icon}
                  className={
                    index === 0 ? "login-dashboard-rail-active" : ""
                  }
                >
                  <UiIcon name={icon} className="h-4 w-4" />
                </span>
              )
            )}
          </nav>

          <div className="login-dashboard-content">
            <header className="login-dashboard-heading">
              <div>
                <p>Inventory overview</p>
                <h2>Your workspace at a glance</h2>
              </div>
              <span className="login-dashboard-status">
                <i />
                Live
              </span>
            </header>

            <div className="login-metric-grid">
              {metrics.map((metric, index) => (
                <article
                  key={metric.label}
                  className="login-metric-card"
                  style={
                    {
                      "--login-card-delay": `${180 + index * 90}ms`,
                    } as React.CSSProperties
                  }
                >
                  <span
                    className={`login-metric-icon login-metric-icon-${metric.tone}`}
                  >
                    <UiIcon name={metric.icon} className="h-4 w-4" />
                  </span>
                  <p>{metric.label}</p>
                  <strong>{metric.detail}</strong>
                  <span className="login-metric-bar">
                    <i />
                  </span>
                </article>
              ))}
            </div>

            <div className="login-dashboard-lower">
              <section className="login-chart-card">
                <div className="login-card-heading">
                  <div>
                    <p>Stock flow</p>
                    <span>Recent movement</span>
                  </div>
                  <span>7 days</span>
                </div>

                <div className="login-chart">
                  <span className="login-chart-gridline login-chart-gridline-a" />
                  <span className="login-chart-gridline login-chart-gridline-b" />
                  <span className="login-chart-gridline login-chart-gridline-c" />
                  <svg viewBox="0 0 420 170" preserveAspectRatio="none">
                    <defs>
                      <linearGradient
                        id="login-chart-area"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0" stopColor="#6474ff" stopOpacity=".28" />
                        <stop offset="1" stopColor="#6474ff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      className="login-chart-area"
                      d="M8 145 C55 126 70 132 104 103 S166 114 196 79 S258 88 291 55 S348 68 412 17 L412 166 L8 166 Z"
                    />
                    <path
                      className="login-chart-line"
                      pathLength="1"
                      d="M8 145 C55 126 70 132 104 103 S166 114 196 79 S258 88 291 55 S348 68 412 17"
                    />
                  </svg>
                </div>
              </section>

              <section className="login-activity-card">
                <div className="login-card-heading">
                  <div>
                    <p>Recent activity</p>
                    <span>Across your team</span>
                  </div>
                </div>

                <div className="login-activity-list">
                  {activity.map(([title, detail], index) => (
                    <div key={title} className="login-activity-row">
                      <span>
                        <UiIcon
                          name={index === 2 ? "scan" : index === 1 ? "plus" : "layers"}
                          className="h-3.5 w-3.5"
                        />
                      </span>
                      <p>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </p>
                      <i />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="login-visual-promise">
        <span>
          <UiIcon name="check" className="h-4 w-4" />
        </span>
        <p>
          <strong>Clear inventory</strong>
          <small>Everything important stays easy to find.</small>
        </p>
      </div>
    </aside>
  );
}
