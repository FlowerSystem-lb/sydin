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
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState("");

  const [editingItem, setEditingItem] =
    useState<Item | null>(null);

  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] =
    useState("");
  const [editQuantity, setEditQuantity] =
    useState("");

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const deleteItem = async (id: number) => {
    const confirmDelete = confirm("Delete this item?");

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Error deleting item");
      return;
    }

    fetchItems();
  };

  const openEditModal = (item: Item) => {
    setEditingItem(item);

    setEditName(item.name);
    setEditCategory(item.category);
    setEditQuantity(item.quantity.toString());
  };

  const updateItem = async () => {
    if (!editingItem) return;

    const { error } = await supabase
      .from("inventory")
      .update({
        name: editName,
        category: editCategory,
        quantity: Number(editQuantity),
      })
      .eq("id", editingItem.id);

    if (error) {
      alert("Error updating item");
      return;
    }

    alert("Item updated");

    setEditingItem(null);

    fetchItems();
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

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
            Inventory
          </h1>

          <Link
            href="/dashboard/add-item"
            className="bg-white text-black px-8 py-4 rounded-2xl text-2xl font-semibold"
          >
            Add Item
          </Link>
        </div>

        {/* Search */}
        <div className="mb-10">
          <input
            type="text"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full bg-[#080808] border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />
        </div>

        {/* Items */}
        <div className="grid grid-cols-2 gap-8">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#080808] border border-neutral-800 rounded-[30px] overflow-hidden"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-[320px] object-cover"
                />
              )}

              <div className="p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-5xl font-bold">
                      {item.name}
                    </h2>

                    <p className="text-neutral-400 text-2xl mt-3">
                      {item.category}
                    </p>
                  </div>

                  <div className="text-5xl font-bold">
                    {item.quantity}
                  </div>
                </div>

                {item.quantity <= 10 && (
                  <div className="mt-5 inline-block bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-lg">
                    Low Stock
                  </div>
                )}

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() =>
                      openEditModal(item)
                    }
                    className="bg-white text-black px-6 py-3 rounded-2xl text-xl font-semibold"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() =>
                      deleteItem(item.id)
                    }
                    className="bg-red-500 px-6 py-3 rounded-2xl text-xl font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#080808] border border-neutral-800 rounded-[30px] p-10 w-[700px]">
            <h2 className="text-5xl font-bold mb-10">
              Edit Item
            </h2>

            <div className="flex flex-col gap-6">
              <input
                type="text"
                value={editName}
                onChange={(e) =>
                  setEditName(e.target.value)
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
              />

              <input
                type="text"
                value={editCategory}
                onChange={(e) =>
                  setEditCategory(
                    e.target.value
                  )
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
              />

              <input
                type="number"
                value={editQuantity}
                onChange={(e) =>
                  setEditQuantity(
                    e.target.value
                  )
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
              />
            </div>

            <div className="flex gap-4 mt-10">
              <button
                onClick={updateItem}
                className="flex-1 bg-white text-black py-5 rounded-2xl text-2xl font-semibold"
              >
                Save Changes
              </button>

              <button
                onClick={() =>
                  setEditingItem(null)
                }
                className="flex-1 bg-red-500 py-5 rounded-2xl text-2xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}