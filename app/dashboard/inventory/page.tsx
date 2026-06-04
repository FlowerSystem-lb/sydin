"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const fetchItems = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } =
      await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .order("id", {
          ascending: false,
        });

    if (!error && data) {
      setItems(data);
    }

    setLoading(false);
  };

  const deleteItem = async (
    id: number
  ) => {
    const confirmDelete =
      confirm(
        "Delete this item?"
      );

    if (!confirmDelete) return;

    const { error } =
      await supabase
        .from("inventory")
        .delete()
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchItems();
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems =
    items.filter((item) =>
      item.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="max-w-7xl mx-auto">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 md:mb-10">
          <h1 className="text-4xl md:text-6xl font-bold">
            Inventory
          </h1>

          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            className="bg-white/5 backdrop-blur-md border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-xl outline-none w-full md:w-[300px] transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <p className="text-2xl animate-pulse text-purple-400">
              Loading...
            </p>
          </div>
        ) : filteredItems.length ===
          0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[30px] text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white">No items found</h2>
            <p className="text-neutral-400 text-lg max-w-md">
              Your inventory is currently empty or no items match your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">

            {filteredItems.map(
              (item) => (
                <div
                  key={item.id}
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[30px] overflow-hidden group hover:-translate-y-2 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_8px_30px_rgb(168,85,247,0.15)] transition-all duration-300"
                >

                  {item.image ? (
                    <div className="relative w-full h-[200px] md:h-[260px] overflow-hidden">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="h-[200px] md:h-[260px] bg-white/5 flex items-center justify-center text-neutral-500 text-xl border-b border-white/5">
                      No Image
                    </div>
                  )}

                  <div className="p-6 flex flex-col gap-4">

                    <div>
                      <h2 className="text-3xl font-bold">
                        {item.name}
                      </h2>

                      <p className="text-neutral-400 text-lg mt-1">
                        {item.category}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-semibold">
                        Qty:
                        {" "}
                        {item.quantity}
                      </p>

                      <button
                        onClick={() =>
                          deleteItem(
                            item.id
                          )
                        }
                        className="bg-red-500/80 hover:bg-red-500 text-white px-5 py-3 rounded-xl text-lg font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                  </div>
                </div>
              )
            )}

          </div>
        )}
      </div>
    </div>
  );
}