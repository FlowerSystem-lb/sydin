"use client";

import Image from "next/image";
import Link from "next/link";
import UiIcon from "@/components/UiIcon";

interface MobileInventoryCardProps {
  id: number;
  name: string;
  image: string;
  sku?: string | null;
  quantity: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
  category?: string;
  depot?: string;
}

export default function MobileInventoryCard({
  id,
  name,
  image,
  sku,
  quantity,
  status,
  category,
  depot,
}: MobileInventoryCardProps) {
  const statusConfig = {
    "in-stock": {
      bg: "bg-emerald-500/15",
      border: "border-emerald-400/30",
      text: "text-emerald-400",
      label: "In stock",
    },
    "low-stock": {
      bg: "bg-amber-500/15",
      border: "border-amber-400/30",
      text: "text-amber-400",
      label: "Low stock",
    },
    "out-of-stock": {
      bg: "bg-red-500/15",
      border: "border-red-400/30",
      text: "text-red-400",
      label: "Out of stock",
    },
  };

  const config = statusConfig[status];

  return (
    <Link href={`/dashboard/inventory/${id}`}>
      <div className="mobile-inventory-card">
        <div className="mobile-inventory-card-image">
          {image ? (
            <Image
              src={image}
              alt={name}
              fill
              sizes="60px"
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-theme-inset">
              <UiIcon
                name="box"
                className="h-6 w-6 text-theme-subtle"
              />
            </div>
          )}
        </div>

        <div className="mobile-inventory-card-content">
          <h3 className="mobile-inventory-card-name">{name}</h3>
          <p className="mobile-inventory-card-sku">
            {sku ? `SKU: ${sku}` : "No SKU"}
          </p>
          {(category || depot) && (
            <div className="mobile-inventory-card-tags">
              {category && (
                <span className="mobile-inventory-card-tag">
                  {category}
                </span>
              )}
              {depot && (
                <span className="mobile-inventory-card-tag">
                  {depot}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mobile-inventory-card-right">
          <div className={`mobile-inventory-card-badge ${config.bg} ${config.border} ${config.text}`}>
            <span className="mobile-inventory-card-quantity">
              {quantity}
            </span>
            <span className="mobile-inventory-card-status">
              {config.label}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
