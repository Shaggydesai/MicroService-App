import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

const SORTS = [
  ['relevance', 'Relevance'],
  ['price-asc', 'Price — Low to High'],
  ['price-desc', 'Price — High to Low'],
  ['rating', 'Popularity'],
  ['newest', 'Newest First'],
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const category = params.get('category') || '';
  const selectedBrands = (params.get('brand') || '').split(',').filter(Boolean);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  useEffect(() => {
    api('/products/categories', { auth: false }).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api(`/products/brands${category ? `?category=${encodeURIComponent(category)}` : ''}`, { auth: false })
      .then(setBrands).catch(() => {});
  }, [category]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams(params);
    qs.set('limit', '20');
    api(`/products?${qs}`, { auth: false })
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params]);

  const toggleBrand = (b) => {
    const next = selectedBrands.includes(b) ? selectedBrands.filter((x) => x !== b) : [...selectedBrands, b];
    set('brand', next.join(','));
  };

  return (
    <div className="page listing">
      <aside className="card filters">
        <h3>Filters</h3>
        <div className="filter-group">
          <h4>CATEGORY</h4>
          <label><input type="radio" checked={!category} onChange={() => set('category', '')} /> All</label>
          {categories.map((c) => (
            <label key={c.name}>
              <input type="radio" checked={category === c.name} onChange={() => { set('category', c.name); }} />
              {c.name} <span className="muted">({c.count})</span>
            </label>
          ))}
        </div>
        <div className="filter-group">
          <h4>PRICE</h4>
          <div className="price-inputs">
            <input type="number" placeholder="Min" defaultValue={params.get('minPrice') || ''}
              onBlur={(e) => set('minPrice', e.target.value)} />
            <span>to</span>
            <input type="number" placeholder="Max" defaultValue={params.get('maxPrice') || ''}
              onBlur={(e) => set('maxPrice', e.target.value)} />
          </div>
        </div>
        {brands.length > 0 && (
          <div className="filter-group">
            <h4>BRAND</h4>
            {brands.map((b) => (
              <label key={b}>
                <input type="checkbox" checked={selectedBrands.includes(b)} onChange={() => toggleBrand(b)} /> {b}
              </label>
            ))}
          </div>
        )}
        <button className="btn btn-outline" onClick={() => setParams({})}>Clear all</button>
      </aside>

      <section className="card results">
        <div className="results-head">
          <p>
            {params.get('q') ? <>Showing results for “<b>{params.get('q')}</b>” — </> : null}
            {data.total} products
          </p>
          <div className="sorts">
            <b>Sort By</b>
            {SORTS.map(([key, label]) => (
              <button key={key} className={(params.get('sort') || 'relevance') === key ? 'active' : ''}
                onClick={() => set('sort', key)}>{label}</button>
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {loading ? <p className="center">Loading…</p> : (
          <>
            {data.items.length === 0 && <p className="center muted">No products match your filters.</p>}
            <div className="grid">
              {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {data.pages > 1 && (
              <div className="pager">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={n === data.page ? 'active' : ''} onClick={() => set('page', String(n))}>{n}</button>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
