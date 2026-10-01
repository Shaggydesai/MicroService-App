import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatPrice, onImgError } from '../api.js';

export const STATUS_COLOR = {
  CONFIRMED: '#2874f0', PACKED: '#ff9f00', SHIPPED: '#ff9f00', OUT_FOR_DELIVERY: '#ff9f00',
  DELIVERED: '#26a541', CANCELLED: '#ff6161',
};

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/orders').then(setOrders).catch((e) => setError(e.message)); }, []);

  if (error) return <div className="page error">{error}</div>;
  if (!orders) return <div className="page center">Loading…</div>;
  if (orders.length === 0) {
    return (
      <div className="page card center empty">
        <div className="empty-icon">📦</div>
        <h2>No orders yet</h2>
        <Link to="/products" className="btn btn-blue">Start shopping</Link>
      </div>
    );
  }
  return (
    <div className="page">
      <h2 className="section-title">My Orders</h2>
      {orders.map((o) => (
        <Link key={o.orderNumber} to={`/orders/${o.orderNumber}`} className="card order-row">
          <img src={o.items[0]?.image} alt="" onError={onImgError} />
          <div className="grow">
            <h3>{o.items[0]?.name}{o.items.length > 1 && <span className="muted"> + {o.items.length - 1} more</span>}</h3>
            <p className="muted">Order #{o.orderNumber} · {formatDate(o.createdAt)}</p>
          </div>
          <strong>{formatPrice(o.amounts.total)}</strong>
          <span className="status"><i style={{ background: STATUS_COLOR[o.status] }} />{o.status.replaceAll('_', ' ')}</span>
        </Link>
      ))}
    </div>
  );
}
