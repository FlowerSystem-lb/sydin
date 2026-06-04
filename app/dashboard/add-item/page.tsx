"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function AddItemPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] =
    useState("");
  const [quantity, setQuantity] =
    useState("");

  const [image, setImage] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    try {
      setLoading(true);

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        alert("Please login");
        setLoading(false);
        return;
      }

      let imageUrl = "";

      // Upload image
      if (image) {
        const fileName = `${Date.now()}-${image.name}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("products")
          .upload(fileName, image);

        if (uploadError) {
          alert(uploadError.message);
          setLoading(false);
          return;
        }

        const { data } =
          supabase.storage
            .from("products")
            .getPublicUrl(fileName);

        imageUrl = data.publicUrl;
      }

      // Insert inventory item
      const { error } =
        await supabase
          .from("inventory")
          .insert([
            {
              name,
              category,
              quantity:
                Number(quantity),
              image: imageUrl,
              user_id: user.id,
            },
          ]);

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      alert("Item added successfully");

      router.push(
        "/dashboard/inventory"
      );
    } catch (error) {
      console.log(error);

      alert("Something went wrong");
    }

    setLoading(false);
  };

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

            <Link href="/dashboard/add-item">
              Add Item
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 lg:p-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold mb-10">
              Add Item
            </h1>

            <form
              onSubmit={handleSubmit}
              className="bg-[#080808] border border-neutral-800 rounded-[30px] p-6 lg:p-10 flex flex-col gap-6"
            >
              <input
                type="text"
                placeholder="Product Name"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-xl lg:text-2xl outline-none"
                required
              />

              <input
                type="text"
                placeholder="Category"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value
                  )
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-xl lg:text-2xl outline-none"
                required
              />

              <input
                type="number"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value
                  )
                }
                className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-xl lg:text-2xl outline-none"
                required
              />

              <div>
                <p className="text-xl mb-3">
                  Product Image
                </p>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImage(
                      e.target
                        .files?.[0] ||
                        null
                    )
                  }
                  className="text-lg"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-white text-black py-5 rounded-2xl text-xl lg:text-2xl font-bold hover:opacity-90 transition"
              >
                {loading
                  ? "Saving..."
                  : "Save Item"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}