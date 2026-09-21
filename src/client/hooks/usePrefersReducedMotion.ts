import { useEffect, useState } from "react";

export function usePrefersReducedMotion(forced: boolean): boolean {
  const [system, setSystem] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return forced || system;
}
