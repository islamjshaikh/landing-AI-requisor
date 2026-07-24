import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  height?: number;
}

export function Skeleton({ className, height }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
      style={height ? { height: `${height}px` } : undefined}
    />
  );
}

export function CardSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center mb-4">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-4 w-24 ml-3" />
      </div>
      <Skeleton className="h-6 w-20 mb-4" />
      <Skeleton className="h-2 w-full mb-2" />
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}
