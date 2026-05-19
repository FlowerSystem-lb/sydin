"use client";

import { usePathname } from "next/navigation";

export default function Sidebar() {

  const pathname = usePathname();

  const links = [
    {
      name: "Dashboard",
      href: "/dashboard",
    },
    {
      name: "Inventory",
      href: "/dashboard/inventory",
    },
    {
      name: "Settings",
      href: "/dashboard/settings",
    },
  ];

  return (
    <aside className="w-72 min-h-screen bg-zinc-950 border-r border-white/10 p-6">

      <div className="mb-12">

        <h1 className="text-4xl font-bold text-white">
          SydIn
        </h1>

        <p className="text-gray-500 mt-2">
          Inventory SaaS
        </p>

      </div>

      <nav className="flex flex-col gap-3">

        {links.map((link) => {

          const active = pathname === link.href;

          return (
            <a
              key={link.href}
              href={link.href}
              className={`px-5 py-4 rounded-2xl transition font-medium
              ${
                active
                  ? "bg-white text-black"
                  : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.name}
            </a>
          );
        })}

      </nav>

    </aside>
  );
}