import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

const ICONS = {
  Mobiles: '📱', Electronics: '💻', Fashion: '👕', 'Home & Kitchen': '🏠', Appliances: '🧺',
  Books: '📚', Beauty: '💄', Sports: '🏏', Gaming: '🎮',
};

const BANNERS = [
  { title: 'Big Savings Days', text: 'Up to 70% off on top brands', color: 'linear-gradient(120deg,#2874f0,#6a5af9)' },
  { title: 'Electronics Fest', text: 'Laptops, TVs & headphones from ₹999', color: 'linear-gradient(120deg,#ff6161,#ff9f00)' },
  { title: 'Fashion Week', text: 'Min. 50% off on trending styles', color: 'linear-gradient(120deg,#00a86b,#2874f0)' },
];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [deals, setDeals] = useState([]);
  const [banner, setBanner] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/products/categories', { auth: false }),
      api('/products?featured=true&limit=10', { auth: false }),
      api('/products?sort=rating&limit=10', { auth: false }),
    ])
      .then(([c, f, d]) => { setCategories(c); setFeatured(f.items); setDeals(d.items); })
      .catch((e) => setError(e.message));
    const t = setInterval(() => setBanner((b) => (b + 1) % BANNERS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const b = BANNERS[banner];
  return (
    <div className="page">
      <section className="card categories">
        {categories.map((c) => (
          <Link key={c.name} to={`/products?category=${encodeURIComponent(c.name)}`} className="category">
            <span className="cat-icon">{ICONS[c.name] || '🛍️'}</span>
            <span>{c.name}</span>
          </Link>
        ))}
      </section>

      <section className="banner" style={{ background: b.color }}>
        <div>
          <h1>{b.title}</h1>
          <p>{b.text}</p>
          <Link to="/products" className="btn btn-yellow">Shop Now</Link>
        </div>
        <div className="dots">
          {BANNERS.map((_, i) => (
            <button key={i} className={i === banner ? 'active' : ''} onClick={() => setBanner(i)} aria-label={`Banner ${i + 1}`} />
          ))}
        </div>
      </section>

      {error && <p className="error">Could not load products: {error}</p>}

      <Shelf title="Featured Products" items={featured} link="/products?featured=true" />
      <Shelf title="Top Rated" items={deals} link="/products?sort=rating" />
    </div>
  );
}

function Shelf({ title, items, link }) {
  if (!items.length) return null;
  return (
    <section className="card shelf">
      <div className="shelf-head">
        <h2>{title}</h2>
        <Link to={link} className="btn btn-blue">View All</Link>
      </div>
      <div className="shelf-row">
        {items.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
