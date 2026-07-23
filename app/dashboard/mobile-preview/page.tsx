"use client";

import { useEffect, useState } from "react";
import MobileShell from "@/components/mobile/MobileShell";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { supabase } from "@/app/lib/supabase";

export default function MobilePreviewPage() {
  const [stats, setStats] = useState({
    lowStockCount: 0,
    outOfStockCount: 0,
    recentActivityCount: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Load inventory for stats
        const { data: items } = await supabase
          .from("inventory")
          .select("id, quantity, min_stock_level")
          .eq("user_id", user.id)
          .limit(100);

        if (items) {
          const lowStockCount = items.filter(
            (item) =>
              item.quantity > 0 &&
              item.quantity <= (item.min_stock_level || 5)
          ).length;
          const outOfStockCount = items.filter(
            (item) => item.quantity === 0
          ).length;

          setStats({
            lowStockCount,
            outOfStockCount,
            recentActivityCount: 5, // Demo value
          });
        }
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };

    loadStats();
  }, []);

  return (
    <MobileShell>
      <MobileDashboard
        lowStockCount={stats.lowStockCount}
        outOfStockCount={stats.outOfStockCount}
      />
    </MobileShell>
  );
}
