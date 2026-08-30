import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  low_stock_threshold: number;
  lowStock: boolean;
}

const emptyForm = {
  sku: "",
  name: "",
  category: "Umum",
  description: "",
  price: 0,
  stock: 0,
  lowStockThreshold: 5,
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await api<{ products: Product[] }>("/products");
    setProducts(res.products);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: p.description,
      price: p.price,
      stock: p.stock,
      lowStockThreshold: p.low_stock_threshold,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/products", { method: "POST", body: JSON.stringify(form) });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan produk");
    }
  }

  async function handleDelete(id: number) {
    await api(`/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">{editingId ? "Edit produk" : "Tambah produk"}</h2>
        <div className="flex flex-col gap-2 text-sm">
          <input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1.5"
            required
          />
          <input
            placeholder="Nama produk"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1.5"
            required
          />
          <input
            placeholder="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1.5"
          />
          <textarea
            placeholder="Deskripsi singkat"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1.5"
            rows={2}
          />
          <label className="text-xs text-slate-500">Harga</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1.5"
          />
          <label className="text-xs text-slate-500">Stok</label>
          <input
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1.5"
          />
          <label className="text-xs text-slate-500">Batas stok rendah</label>
          <input
            type="number"
            value={form.lowStockThreshold}
            onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1.5"
          />
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
            {editingId ? "Simpan" : "Tambah"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-2">
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Produk</th>
              <th className="px-3 py-2">Harga</th>
              <th className="px-3 py-2">Stok</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.sku} · {p.category}
                  </p>
                </td>
                <td className="px-3 py-2">Rp{p.price.toLocaleString("id-ID")}</td>
                <td className={`px-3 py-2 ${p.lowStock ? "font-medium text-amber-600" : ""}`}>
                  {p.stock} {p.lowStock && "⚠"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => startEdit(p)} className="mr-2 text-xs text-indigo-600 hover:underline">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-rose-500 hover:underline">
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
