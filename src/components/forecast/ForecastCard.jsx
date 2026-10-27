import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertCircle, Factory } from "lucide-react";
import ForecastStat from "./ForecastStat";

const STATUS = {
  green: { label: "Optimal", cls: "bg-green-600", Icon: TrendingUp, ic: "text-green-600" },
  yellow: { label: "Low", cls: "bg-yellow-500", Icon: AlertCircle, ic: "text-yellow-500" },
  red: { label: "Critical", cls: "bg-destructive", Icon: TrendingDown, ic: "text-destructive" },
  none: { label: "No demand", cls: "bg-muted-foreground", Icon: AlertCircle, ic: "text-muted-foreground" },
};
const n = (v) => (v || 0).toLocaleString();

export default function ForecastCard({ item }) {
  const s = STATUS[item.status];
  const trend = item.trendPct === null ? "no prior data" : `${item.trendPct > 0 ? "+" : ""}${item.trendPct}% vs prior 4 wks`;
  return (
    <Card className={item.status === "red" ? "border-destructive" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <s.Icon className={`w-4 h-4 ${s.ic}`} />
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-xs text-muted-foreground">{item.sku}</p>
            </div>
          </div>
          <Badge className={`${s.cls} text-white`}>{s.label}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <ForecastStat label="Avg Sales" value={`${item.avgDaily} lb/day`} sub={trend} />
          <ForecastStat label="Target" value={`${n(item.target)} lb`} sub={`${item.coverDays}d cover + ${n(item.safety)} safety${item.targetCases ? ` · ${item.targetCases} cs` : ""}`} />
          <ForecastStat label="Open Orders" value={`${n(item.orderLbs)} lb`} sub="ship next 2 wks" />
          <ForecastStat label="Usable On Hand" value={`${n(item.usable)} lb`} sub={item.daysOfCover !== null ? `${item.daysOfCover} days of cover` : "—"} />
          <ForecastStat label="In Production" value={`${n(item.wip)} lb`} sub={`projected ${n(item.projected)} lb`} />
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div className={`h-2 rounded-full ${s.cls}`} style={{ width: `${Math.min(item.pct, 100)}%` }} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{item.pct}% of target · {item.salesDays} sales days</span>
          {item.held > 0 && <Badge variant="outline" className="border-orange-400 text-orange-600">{n(item.held)} lb on hold</Badge>}
          {item.atRisk > 0 && <Badge variant="outline" className="border-destructive text-destructive">{n(item.atRisk)} lb may expire before selling</Badge>}
        </div>

        {item.shortfall > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted p-3">
            <p className="text-sm">
              <span className="font-semibold">Make: </span>
              {item.batches ? `${item.batches} batch${item.batches > 1 ? "es" : ""} × ${n(item.batchLbs)} lb = ${n(item.suggestedLbs)} lb raw` : `${n(item.suggestedLbs)} lb raw`}
              <span className="text-muted-foreground"> (short {n(item.shortfall)} lb finished{item.shortCases ? ` · ${item.shortCases} cs` : ""})</span>
            </p>
            <Button asChild size="sm" variant="outline">
              <Link to="/production-orders"><Factory className="w-4 h-4 mr-1" />Production Orders</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}