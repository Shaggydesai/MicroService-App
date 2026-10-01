import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, formatDate, formatPrice, onImgError } from '../api.js';
import { STATUS_COLOR } from './Orders.jsx';

const FLOW = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api(`/orders/${orderNumber}`).then(setOrder).catch((e) => setError(e.message)); }, [orderNumber]);

  const cancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try { setOrder(await api(`/orders/${orderNumber}/cancel`, { method: 'POST' })); } catch (e) { setError(e.message); }
  };

  if (!order) return <div className="page center">{error || 'Loading…'}</div>;
  const reached = FLOW.indexOf(order.status);
  const a = order.shippingAddress;

  return (
    <div className="page">
      {params.get('placed') && (
        <div className="card success-banner">
          <h2>✅ Order placed successfully!</h2>
          <p>Order #{order.orderNumber} — we will notify you when it ships.</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="two-col">
        <section className="card">
          <h2 className="section-title">Order #{order.orderNumber}</h2>
          <p className="muted">Placed on {formatDate(order.createdAt)}</p>
          {order.status === 'CANCELLED' ? (
            <p className="status big"><i style={{ background: STATUS_COLOR.CANCELLED }} />CANCELLED</p>
          ) : (
            <ol className="tracker">
              {FLOW.map((s, i) => (
                <li key={s} className={i <= reached ? 'done' : ''}>{s.replaceAll('_', ' ')}</li>
              ))}
            </ol>
          )}
          {order.items.map((i) => (
            <div key={i.productId} className="cart-line">
              <Link to={`/products/${i.productId}`}><img src={i.image} alt={i.name} onError={onImgError} /></Link>
              <div className="cart-line-info">
                <h3>{i.name}</h3>
                <p className="muted">Qty: {i.quantity}</p>
                <strong>{formatPrice(i.price * i.quantity)}</strong>
              </div>
            </div>
          ))}
          {['CONFIRMED', 'PACKED'].includes(order.status) && (
            <button className="btn btn-outline" onClick={cancel}>Cancel order</button>
          )}
        </section>
        <aside>
          <div className="card summary">
            <h3>DELIVERY ADDRESS</h3>
            <b>{a.fullName}</b>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}</p>
            <p>{a.city}, {a.state} — {a.pincode}</p>
            <p>Phone: {a.phone}</p>
          </div>
          <div className="card summary">
            <h3>PAYMENT</h3>
            <div className="row"><span>Subtotal</span><span>{formatPrice(order.amounts.subtotal)}</span></div>
            <div className="row"><span>Delivery</span><span>{order.amounts.deliveryFee ? formatPrice(order.amounts.deliveryFee) : 'FREE'}</span></div>
            <div className="row total"><span>Total</span><span>{formatPrice(order.amounts.total)}</span></div>
            <p className="muted">{order.payment.method} · {order.payment.status}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
