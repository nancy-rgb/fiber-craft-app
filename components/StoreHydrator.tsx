"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/lib/store/useProjectStore";

export function StoreHydrator() {
  useEffect(() => {
    void useProjectStore.persist.rehydrate();
  }, []);
  return null;
}
