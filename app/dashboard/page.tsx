"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import LogoutButton from "@/components/LogoutButton";

interface Item {
  id: number;
  name: string;
  quantity: number;
}

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.log(error);
      return;
    }

    setItems(data || []);
  };

  const totalProducts = items.length;

  const totalStock = items.reduce(
    (acc, item) => acc + item.quantity,
    0
  );

  const lowStock = items.filter(
    (item) => item.quantity <= 10
  ).length;

  const recentItems = items.slice(-5).reverse();

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="w-[260px] border-r border-neutral-800 p-8">
        <h1 className="text-5xl font-bold">
          SydIn
        </h1>

        <p className="text-neutral-400 mt-3">
          Inventory SaaS
        </p>

        <div className="mt-20 flex flex-col gap-6 text-2xl">
          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/dashboard/inventory">
            Inventory
          </Link>

          <Link href="/dashboard/add-item">
            Add Item
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-12">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-7xl font-bold">
            Dashboard
          </h1>

          <LogoutButton />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="bg-[#080808] border border-neutral-800 rounded-[30px] p-8">
            <p className="text-neutral-400 text-2xl">
              Total Products
            </p>

            <h2 className="text-6xl font-bold mt-4">
              {totalProducts}
            </h2>
          </div>

          <div className="bg-[#080808] border border-neutral-800 rounded-[30px] p-8">
            <p className="text-neutral-400 text-2xl">
              Total Stock
            </p>

            <h2 className="text-6xl font-bold mt-4">
              {totalStock}
            </h2>
          </div>

          <div className="bg-[#080808] border border-neutral-800 rounded-[30px] p-8">
            <p className="text-neutral-400 text-2xl">
              Low Stock
            </p>

            <h2 className="text-6xl font-bold mt-4 text-red-500">
              {lowStock}
            </h2>
          </div>
        </div>

        {/* Recent Items */}
        <div className="bg-[#080808] border border-neutral-800 rounded-[30px] p-8">
          <h2 className="text-4xl font-bold mb-8">
            Recent Items
          </h2>

          <div className="flex flex-col gap-5">
            {recentItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-neutral-800 rounded-2xl p-5"
              >
                <div>
                  <h3 className="text-2xl font-semibold">
                    {item.name}
                  </h3>

                  <p className="text-neutral-500">
                    Product ID: {item.id}
                  </p>
                </div>

                <div className="text-3xl font-bold">
                  {item.quantity}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}