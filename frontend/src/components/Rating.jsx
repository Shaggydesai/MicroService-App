export default function Rating({ value = 0, count }) {
  return (
    <div className="rating">
      <span className="stars">{Number(value).toFixed(1)} ★</span>
      {count !== undefined && <span className="muted">({Number(count).toLocaleString('en-IN')})</span>}
    </div>
  );
}
