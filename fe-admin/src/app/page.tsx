import React from "react";
import OverviewDashboard from "../components/OverviewDashboard";

/**
 * Overview page.
 *
 * A genuine at-a-glance dashboard: live incident counts, the latest public
 * announcement, and recent dispatches. The full-bleed geospatial view lives
 * on the dedicated `/map` (Operations Map) page — this page links to it rather
 * than re-rendering the same map (they previously duplicated each other).
 */
export default function Dashboard() {
  return <OverviewDashboard />;
}
