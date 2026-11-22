import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import { Skeleton } from "./Skeleton";

const MapScene = lazy(() => import("./MapScene"));

export function LazyMap(props: ComponentProps<typeof MapScene>) {
  return <Suspense fallback={<Skeleton className={props.className ?? "h-96"} />}><MapScene {...props} /></Suspense>;
}
