import { useEffect, useState } from 'react';
import { api, formatDate, formatPrice } from '../api.js';

const NEXT = { CONFIRMED: 'PACKED', PACKED: 'SHIPPED', SHIPPED: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };
const BLANK = { name: '', brand: '', category: '', price: '', mrp: '', stock: '', images: '', highlights: '', description: '' };

export default function Admin() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState(BLANK);
  const [msg, setMsg] = useState('');

  const loadOrders = () => api('/orders/admin/all').then(setOrders).catch((e) => setMsg(e.message));
  useEffect(() => { loadOrders(); }, []);

  const advance = async (o) => {
    try {
      await api(`/orders/${o.orderNumber}/status`, { method: 'PATCH', body: { status: NEXT[o.status] } });
      loadOrders();
    } catch (e) { setMsg(e.message); }
  };

  const createProduct = async (e) => {
    e.preventDefault();
    try {
      const split = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
      const created = await api('/products', {
        method: 'POST',
        body: {
          ...product,
          price: Number(product.price),
          mrp: Number(product.mrp),
          stock: Number(product.stock),
          images: split(product.images),
          highlights: split(product.highlights),
        },
      });
      setMsg(`Created "${created.name}"`);
      setProduct(BLANK);
    } catch (err) { setMsg(err.message); }
  };

  return (
    <div className="page">
      <div className="tabs">
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
        <button className={tab === 'product' ? 'active' : ''} onClick={() => setTab('product')}>Add Product</button>
      </div>
      {msg && <p className="notice">{msg}</p>}
      {tab === 'orders' ? (
        <div className="card">
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderNumber}>
                  <td>{o.orderNumber}</td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.shippingAddress.fullName}</td>
                  <td>{formatPrice(o.amounts.total)}</td>
                  <td>{o.payment.method} / {o.payment.status}</td>
                  <td>{o.status}</td>
                  <td>{NEXT[o.status] && <button className="btn btn-blue small" onClick={() => advance(o)}>→ {NEXT[o.status]}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <form className="card admin-form" onSubmit={createProduct}>
          {Object.keys(BLANK).map((k) => (
            <label key={k} className="field">
              <span>{k}{['images', 'highlights'].includes(k) ? ' (comma separated)' : ''}</span>
              <input required={['name', 'category', 'price', 'mrp', 'stock'].includes(k)} value={product[k]}
                type={['price', 'mrp', 'stock'].includes(k) ? 'number' : 'text'}
                onChange={(e) => setProduct({ ...product, [k]: e.target.value })} />
            </label>
          ))}
          <button className="btn btn-buy">Create product</button>
        </form>
      )}
    </div>
  );
}
