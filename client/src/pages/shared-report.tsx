import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Loader2,
  TrendingUp,
  Zap,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SharedReportData {
  id: number;
  title: string;
  reportData: {
    title: string;
    markdown: string;
    candidates: any[];
    generatedAt: string;
  };
  viewCount: number;
  createdAt: string;
}

function getQuadrantLabel(impact: number, effort: number): string {
  if (impact >= 50 && effort < 50) return "Quick Win";
  if (impact >= 50 && effort >= 50) return "Major Project";
  if (impact < 50 && effort < 50) return "Fill-In";
  return "Avoid";
}

function getQuadrantBadgeColor(label: string): string {
  switch (label) {
    case "Quick Win": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Major Project": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Fill-In": return "bg-amber-100 text-amber-700 border-amber-200";
    default: return "bg-red-100 text-red-700 border-red-200";
  }
}

export default function SharedReportPage() {
  const [location] = useLocation();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"visual" | "markdown">("visual");

  const token = location.split("/shared-report/")[1];

  useEffect(() => {
    if (!token) {
      setError("Invalid report link");
      setLoading(false);
      return;
    }

    fetch(`/api/discovery-reports/shared/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Report not found");
        return res.json();
      })
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Report Not Found</h2>
            <p className="text-sm text-slate-500">
              {error || "This report may have been removed or the link is invalid."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { reportData } = report;
  const candidates = reportData.candidates || [];
  const scored = candidates.filter((c: any) => c.riceScore != null);
  const quickWins = scored.filter((c: any) => (c.impactScore ?? 0) >= 60 && (c.effortScore ?? 100) <= 40);
  const approved = candidates.filter((c: any) => c.status === "approved");
  const sorted = [...candidates].sort((a: any, b: any) => (b.riceScore ?? 0) - (a.riceScore ?? 0));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-100">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(reportData.generatedAt || report.createdAt).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {report.viewCount} view{report.viewCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge variant="outline">{candidates.length} features</Badge>
            {scored.length > 0 && (
              <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50">
                {scored.length} scored
              </Badge>
            )}
            {quickWins.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Zap className="h-3 w-3 mr-0.5" />
                {quickWins.length} Quick Win{quickWins.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {approved.length > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-0.5" />
                {approved.length} Approved
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant={viewMode === "visual" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("visual")}
              className="text-xs"
            >
              <BarChart3 className="h-3 w-3 mr-1.5" />
              Visual
            </Button>
            <Button
              variant={viewMode === "markdown" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("markdown")}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1.5" />
              Markdown
            </Button>
          </div>
        </div>

        {viewMode === "markdown" ? (
          <Card>
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none prose-slate">
                <ReactMarkdown>{reportData.markdown}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {scored.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                    Priority Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">#</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Feature</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Impact</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Effort</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Confidence</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">RICE</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((c: any, i: number) => {
                          const cat = c.impactScore != null && c.effortScore != null
                            ? getQuadrantLabel(c.impactScore, c.effortScore)
                            : null;
                          return (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 text-xs text-slate-400">{c.priorityRank ?? i + 1}</td>
                              <td className="py-2.5 px-3">
                                <span className="text-sm font-medium text-slate-700">{c.featureTitle}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">{c.impactScore ?? "—"}</td>
                              <td className="py-2.5 px-3 text-center text-sm">{c.effortScore ?? "—"}</td>
                              <td className="py-2.5 px-3 text-center text-sm">{c.confidenceScore ?? "—"}</td>
                              <td className="py-2.5 px-3 text-center text-sm font-bold">{c.riceScore ?? "—"}</td>
                              <td className="py-2.5 px-3 text-center">
                                {cat && (
                                  <Badge variant="outline" className={`text-[10px] ${getQuadrantBadgeColor(cat)}`}>
                                    {cat === "Quick Win" && <Zap className="h-2.5 w-2.5 mr-0.5" />}
                                    {cat}
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Feature Recommendations</h2>
              {sorted.map((c: any, i: number) => (
                <Card key={i} className={c.status === "approved" ? "border-emerald-200 bg-emerald-50/20" : ""}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${c.status === "approved" ? "bg-emerald-100" : "bg-orange-100"}`}>
                          {c.status === "approved" ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Lightbulb className="h-4 w-4 text-orange-600" />
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-slate-800">{c.featureTitle}</h3>
                      </div>
                      {c.riceScore != null && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          RICE: {c.riceScore}
                        </Badge>
                      )}
                    </div>

                    {c.whyNow && (
                      <p className="text-sm text-slate-600 mb-3">{c.whyNow}</p>
                    )}

                    {c.evidence && c.evidence.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Evidence</p>
                        <ul className="space-y-1">
                          {c.evidence.map((e: string, j: number) => (
                            <li key={j} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {c.uiChanges && (
                        <div className="p-2 bg-blue-50 rounded-md">
                          <div className="text-[10px] font-medium text-blue-700 mb-0.5">UI Changes</div>
                          <p className="text-xs text-blue-600">{c.uiChanges}</p>
                        </div>
                      )}
                      {c.dataModelChanges && (
                        <div className="p-2 bg-purple-50 rounded-md">
                          <div className="text-[10px] font-medium text-purple-700 mb-0.5">Data Model</div>
                          <p className="text-xs text-purple-600">{c.dataModelChanges}</p>
                        </div>
                      )}
                      {c.workflowChanges && (
                        <div className="p-2 bg-amber-50 rounded-md">
                          <div className="text-[10px] font-medium text-amber-700 mb-0.5">Workflow</div>
                          <p className="text-xs text-amber-600">{c.workflowChanges}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-400">
            Generated by <span className="font-medium text-indigo-500">Requisor</span> AI Discovery Engine
          </p>
        </div>
      </div>
    </div>
  );
}
