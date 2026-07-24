import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/projects/ProgressBar";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  value: number | string;
  valueLabel?: string;
  progressLabel?: string;
  progressValue?: number;
  progressColor?: string;
  footer?: React.ReactNode;
  alert?: React.ReactNode;
}

export function MetricCard({
  title,
  icon,
  iconBgColor,
  iconColor,
  value,
  valueLabel,
  progressLabel,
  progressValue,
  progressColor = "bg-primary",
  footer,
  alert,
}: MetricCardProps) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-center mb-3">
          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", iconBgColor, iconColor)}>
            {icon}
          </div>
          <h3 className="ml-2 text-sm font-medium text-slate-600">{title}</h3>
        </div>
        
        <div className="flex items-baseline">
          <span className="text-2xl font-bold text-slate-800">{value}</span>
          {valueLabel && <span className="ml-1 text-sm text-slate-500">{valueLabel}</span>}
        </div>
        
        {(progressLabel && progressValue !== undefined) && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">{progressLabel}</span>
              <span className="text-slate-700 font-medium">{progressValue}%</span>
            </div>
            <ProgressBar value={progressValue} className={progressColor} />
          </div>
        )}
        
        {footer && <div className="mt-4">{footer}</div>}
        
        {alert && alert}
      </CardContent>
    </Card>
  );
}
