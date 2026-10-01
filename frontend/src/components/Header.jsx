import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Header() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const search = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
  };

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="logo">
          Shop<span>Verse</span>
          <small>Explore <em>Plus</em> ✦</small>
        </Link>
        <form className="search" onSubmit={search}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for products, brands and more"
            aria-label="Search"
          />
          <button type="submit" aria-label="Search">🔍</button>
        </form>
        <nav className="header-nav">
          {user ? (
            <div className="account" onMouseLeave={() => setMenu(false)}>
              <button className="link-btn" onClick={() => setMenu((m) => !m)}>
                {user.name.split(' ')[0]} ▾
              </button>
              {menu && (
                <div className="dropdown" onClick={() => setMenu(false)}>
                  <Link to="/orders">My Orders</Link>
                  {user.role === 'admin' && <Link to="/admin">Admin Dashboard</Link>}
                  <button onClick={() => { logout(); navigate('/'); }}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-login">Login</Link>
          )}
          <Link to="/cart" className="cart-link">
            🛒 Cart {cart.summary.count > 0 && <span className="badge">{cart.summary.count}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}
