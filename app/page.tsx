export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">

      <nav className="flex items-center justify-between px-8 py-6 border-b border-white/10">
        <h1 className="text-2xl font-bold">SydIn</h1>

        <button className="px-5 py-2 rounded-xl bg-white text-black font-medium hover:scale-105 transition">
          Login
        </button>
      </nav>

      <section className="flex flex-col items-center justify-center text-center px-6 py-32">

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-12 max-w-3xl shadow-2xl">

          <h1 className="text-6xl md:text-7xl font-bold leading-tight">
            Modern Inventory
            <span className="block text-gray-400">
              Management SaaS
            </span>
          </h1>

          <p className="mt-8 text-lg text-gray-400 max-w-2xl mx-auto">
            Manage inventory, stock, products, QR codes,
            history, and business analytics in one powerful platform.
          </p>

          <div className="mt-10 flex gap-4 justify-center flex-wrap">

            <button className="px-8 py-4 rounded-2xl bg-white text-black font-semibold hover:scale-105 transition">
              Get Started
            </button>

            <button className="px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/10 transition">
              Learn More
            </button>

          </div>
        </div>
      </section>
    </main>
  );
}