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
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [listError, setListError] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);

  useEffect(() => {
    api<{ categories: string[] }>("/products/categories").then((res) => setCategories(res.categories));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  async function load() {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await api<{ products: Product[] }>(`/products?${params}`);
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
    setFormError("");
    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/products", { method: "POST", body: JSON.stringify(form) });
      }
      resetForm();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan produk");
    }
  }

  async function handleDelete(id: number) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id);
      setTimeout(() => setConfirmingDeleteId((current) => (current === id ? null : current)), 3000);
      return;
    }
    setConfirmingDeleteId(null);
    setListError("");
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : "Gagal menghapus produk");
    }
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
            className="rounded border border-slate-300 px-3 py-2.5"
            required
          />
          <input
            placeholder="Nama produk"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded border border-slate-300 px-3 py-2.5"
            required
          />
          <input
            placeholder="Kategori"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded border border-slate-300 px-3 py-2.5"
          />
          <textarea
            placeholder="Deskripsi singkat"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded border border-slate-300 px-3 py-2.5"
            rows={2}
          />
          <label className="text-xs text-slate-500">Harga</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="rounded border border-slate-300 px-3 py-2.5"
          />
          <label className="text-xs text-slate-500">Stok</label>
          <input
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            className="rounded border border-slate-300 px-3 py-2.5"
          />
          <label className="text-xs text-slate-500">Batas stok rendah</label>
          <input
            type="number"
            value={form.lowStockThreshold}
            onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
            className="rounded border border-slate-300 px-3 py-2.5"
          />
        </div>
        {formError && <p className="mt-2 text-xs text-rose-600">{formError}</p>}
        <div className="mt-3 flex gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-[var(--brand-600)] px-3 py-2.5 text-sm font-medium text-white">
            {editingId ? "Simpan" : "Tambah"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="lg:col-span-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="mb-3 rounded-lg border border-slate-300 px-2 py-2.5 text-sm outline-none focus:border-[var(--brand-500)]"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {listError && (
          <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{listError}</p>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[480px] text-sm">
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
                  <td className="whitespace-nowrap px-3 py-2">Rp{p.price.toLocaleString("id-ID")}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${p.lowStock ? "font-medium text-amber-600" : ""}`}>
                    {p.stock} {p.lowStock && "⚠"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded px-2 py-1.5 text-xs text-[var(--brand-600)] hover:bg-[var(--brand-50)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className={`rounded px-2 py-1.5 text-xs hover:underline ${
                        confirmingDeleteId === p.id
                          ? "font-semibold text-rose-600"
                          : "text-rose-500 hover:bg-rose-50"
                      }`}
                    >
                      {confirmingDeleteId === p.id ? "Yakin?" : "Hapus"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
