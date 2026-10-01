import { formatPrice } from '../api.js';

const FREE_DELIVERY_ABOVE = 500;
const DELIVERY_FEE = 40;

export default function PriceSummary({ summary }) {
  const delivery = summary.total >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  return (
    <aside className="card summary">
      <h3>PRICE DETAILS</h3>
      <div className="row"><span>Price ({summary.count} items)</span><span>{formatPrice(summary.mrp)}</span></div>
      <div className="row"><span>Discount</span><span className="green">− {formatPrice(summary.discount)}</span></div>
      <div className="row">
        <span>Delivery Charges</span>
        <span className={delivery ? '' : 'green'}>{delivery ? formatPrice(delivery) : 'FREE'}</span>
      </div>
      <div className="row total"><span>Total Amount</span><span>{formatPrice(summary.total + delivery)}</span></div>
      {summary.discount > 0 && <p className="green savings">You will save {formatPrice(summary.discount)} on this order</p>}
    </aside>
  );
}
