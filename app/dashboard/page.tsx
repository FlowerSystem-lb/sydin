"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

interface Item {
  id: number;
  name: string;
  category: string;
  quantity: number;
  image: string;
  sku?: string;
  notes?: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchItems = async () => {
    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) return;

    const { data, error } =
      await supabase
        .from("inventory")
        .select("*")
        .eq("user_id", user.id)
        .order("id", {
          ascending: false,
        });

    if (error) {
      console.log(error);
      return;
    }

    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAdding(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert("Please login");
        setIsAdding(false);
        return;
      }

      let imageUrl = "";
      if (image) {
        const fileName = `${Date.now()}-${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          alert(uploadError.message);
          setIsAdding(false);
          return;
        }

        const { data } = supabase.storage.from("products").getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase.from("inventory").insert([{
        name,
        sku,
        category,
        quantity: Number(quantity),
        notes,
        image: imageUrl,
        user_id: user.id,
      }]);

      if (error) {
        alert(error.message);
        setIsAdding(false);
        return;
      }

      alert("Item added successfully");
      setIsModalOpen(false);
      setName("");
      setSku("");
      setCategory("");
      setQuantity("");
      setNotes("");
      setImage(null);
      fetchItems();
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
    }
    setIsAdding(false);
  };

  const deleteItem = async (
    id: number
  ) => {
    const confirmDelete =
      confirm("Delete this item?");

    if (!confirmDelete) return;

    const { error } =
      await supabase
        .from("inventory")
        .delete()
        .eq("id", id);

    if (error) {
      alert("Error deleting item");
      return;
    }

    fetchItems();
  };

  const filteredItems =
    items.filter(
      (item) =>
        item.name
          .toLowerCase()
          .includes(
            search.toLowerCase()
          ) ||
        item.category
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
    );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden lg:flex w-[260px] min-h-screen border-r border-neutral-800 p-8 flex-col">
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

            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-left hover:text-white transition-colors"
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 lg:p-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
            <h1 className="text-5xl lg:text-7xl font-bold">
              Inventory
            </h1>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white hover:bg-neutral-200 text-black px-6 py-4 rounded-2xl text-xl font-semibold text-center transition-colors"
            >
              Add Item
            </button>
          </div>

          {/* Search */}
          <div className="mb-10">
            <input
              type="text"
              placeholder="Search inventory..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 focus:border-purple-500/50 rounded-2xl px-6 py-5 text-lg lg:text-2xl outline-none transition-colors"
            />
          </div>

          {/* Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[30px] overflow-hidden group hover:-translate-y-2 hover:bg-white/10 hover:border-purple-500/30 hover:shadow-[0_8px_30px_rgb(168,85,247,0.15)] transition-all duration-300"
              >
                {item.image ? (
                  <div className="w-full h-[240px] lg:h-[320px] overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="w-full h-[240px] lg:h-[320px] bg-white/5 flex items-center justify-center text-neutral-500 text-xl border-b border-white/5">
                    No Image
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-3xl lg:text-4xl font-bold">
                        {item.name}
                      </h2>

                      <p className="text-neutral-400 text-lg lg:text-xl mt-2">
                        {item.category}
                      </p>
                    </div>

                    <div className="text-3xl lg:text-4xl font-bold">
                      {item.quantity}
                    </div>
                  </div>

                  {/* Low stock */}
                  {item.quantity <=
                    10 && (
                    <div className="mt-5 inline-block bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm lg:text-lg">
                      Low Stock
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <button className="flex-1 bg-white/90 hover:bg-white text-black py-3 rounded-2xl text-lg font-semibold transition-colors">
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        deleteItem(
                          item.id
                        )
                      }
                      className="flex-1 bg-red-500/80 hover:bg-red-500 text-white py-3 rounded-2xl text-lg font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredItems.length ===
            0 && (
            <div className="flex flex-col items-center justify-center py-20 px-4 mt-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[30px] text-center">
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
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[30px] w-full max-w-2xl p-6 md:p-10 my-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl md:text-4xl font-bold">Add Item</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white transition-colors p-2"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddItem} className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-neutral-400 mb-2">Product Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-lg outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-2">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-lg outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-2">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-lg outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-2">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-lg outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-neutral-400 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 focus:border-purple-500/50 rounded-2xl px-5 py-4 text-lg outline-none transition-colors min-h-[100px] resize-y"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-2">Upload Image</label>
                <div className="border border-white/10 rounded-2xl p-4 bg-black/50 flex items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                    className="text-neutral-300 w-full file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-purple-500/20 file:text-purple-400 hover:file:bg-purple-500/30 transition-colors cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl text-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 bg-purple-600/80 hover:bg-purple-600 text-white py-4 rounded-2xl text-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isAdding ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
