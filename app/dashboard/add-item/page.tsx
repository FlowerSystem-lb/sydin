"use client";

import { useState } from "react";
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

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login");
      return;
    }

    let imageUrl = "";

    if (image) {
      const fileName = `${Date.now()}-${image.name}`;

      const { error: uploadError } =
        await supabase.storage
          .from("products")
          .upload(fileName, image);

      if (uploadError) {
        alert(uploadError.message);
        setLoading(false);
        return;
      }

      const { data } = supabase.storage
        .from("products")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }

    const { error } =
      await supabase.from("inventory").insert([
        {
          name,
          category,
          quantity: Number(quantity),
          image: imageUrl,
          user_id: user.id,
        },
      ]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    alert("Item added");

    router.push("/dashboard/inventory");
  };

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-6xl font-bold mb-10">
          Add Item
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
          <input
            type="text"
            placeholder="Product Name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="text"
            placeholder="Category"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="number"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) =>
              setQuantity(e.target.value)
            }
            className="bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-2xl outline-none"
          />

          <input
            type="file"
            onChange={(e) =>
              setImage(
                e.target.files?.[0] || null
              )
            }
            className="text-xl"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black py-5 rounded-2xl text-2xl font-bold"
          >
            {loading
              ? "Saving..."
              : "Save Item"}
          </button>
        </form>
      </div>
    </div>
  );
}