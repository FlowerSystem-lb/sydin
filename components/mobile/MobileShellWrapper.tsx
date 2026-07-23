"use client";

import { useEffect, useState } from "react";
import MobileShell from "./MobileShell";
import { supabase } from "@/app/lib/supabase";

export default function MobileShellWrapper({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const loadAlertCount = async () => {
      try {
        const { data: items } = await supabase
          .from("inventory")
          .select("id, quantity, min_stock_level")
          .eq("user_id", userId)
          .limit(100);

        if (items) {
          const outOfStock = items.filter((item) => item.quantity === 0).length;
          const lowStock = items.filter(
            (item) =>
              item.quantity > 0 &&
              item.quantity <= (item.min_stock_level || 5)
          ).length;
          setAlertCount(outOfStock + lowStock);
        }
      } catch (error) {
        console.error("Error loading alert count:", error);
      }
    };

    loadAlertCount();
  }, [userId]);

  return <MobileShell alertCount={alertCount}>{children}</MobileShell>;
}
