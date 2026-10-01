import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { formatPrice, onImgError } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import PriceSummary from '../components/PriceSummary.jsx';

export default function Cart() {
  const { cart, update, remove } = useCart();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const run = (fn) => fn().then(() => setError('')).catch((e) => setError(e.message));

  if (cart.items.length === 0) {
    return (
      <div className="page card center empty">
        <div className="empty-icon">🛒</div>
        <h2>Your cart is empty!</h2>
        <p className="muted">Add items to it now.</p>
        <Link to="/products" className="btn btn-blue">Shop now</Link>
      </div>
    );
  }

  const blocked = cart.items.some((i) => !i.inStock);
  return (
    <div className="page two-col">
      <section className="card">
        <h2 className="section-title">My Cart ({cart.summary.count})</h2>
        {error && <p className="error">{error}</p>}
        {cart.items.map((item) => (
          <div key={item.productId} className="cart-line">
            <Link to={`/products/${item.productId}`}><img src={item.image} alt={item.name} onError={onImgError} /></Link>
            <div className="cart-line-info">
              <Link to={`/products/${item.productId}`}><h3>{item.name}</h3></Link>
              <p className="muted">{item.brand}</p>
              <div className="price-row">
                <strong>{formatPrice(item.price)}</strong>
                {item.mrp > item.price && <s>{formatPrice(item.mrp)}</s>}
              </div>
              {!item.inStock && <p className="oos">Only {item.stock} available</p>}
              <div className="qty">
                <button disabled={item.quantity <= 1} onClick={() => run(() => update(item.productId, item.quantity - 1))}>−</button>
                <span>{item.quantity}</span>
                <button disabled={item.quantity >= 10} onClick={() => run(() => update(item.productId, item.quantity + 1))}>+</button>
                <button className="link-btn" onClick={() => run(() => remove(item.productId))}>REMOVE</button>
              </div>
            </div>
          </div>
        ))}
        <div className="place-order">
          <button className="btn btn-buy" disabled={blocked} onClick={() => navigate('/checkout')}>PLACE ORDER</button>
        </div>
      </section>
      <PriceSummary summary={cart.summary} />
    </div>
  );
}
