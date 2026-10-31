import { useEffect, useRef, useState, type RefObject } from "react";

const FALLBACK_WIDTH = 1000;

export function useContainerWidth(): { ref: RefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return undefined;
    }
    const update = (): void => {
      setWidth(element.clientWidth > 0 ? element.clientWidth : FALLBACK_WIDTH);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return { ref, width };
}
