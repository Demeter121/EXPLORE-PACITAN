import React from "react";

export function LocationCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm animate-pulse flex flex-col">
      {/* Thumbnail Skeleton */}
      <div className="w-full aspect-video bg-slate-200 dark:bg-slate-800 relative" />
      
      {/* Content Skeleton */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function LocationGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <LocationCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LocationDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-pulse">
      {/* Hero Header Skeleton */}
      <div className="w-full h-72 sm:h-96 bg-slate-200 dark:bg-slate-800 relative" />

      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
            </div>
            <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
          <div className="h-12 w-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>

        {/* Gallery thumbs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-xl" />
        </div>

        {/* Description & metadata */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
        </div>

        {/* Facilities badges */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
