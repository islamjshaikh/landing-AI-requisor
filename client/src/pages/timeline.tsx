import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Timeline() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Timeline</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">Timeline view is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
