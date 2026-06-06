"use client";

import { useEffect, useState } from "react";

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:720px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isPhone;
}
