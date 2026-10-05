export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <h4>ABOUT</h4>
          <p>ShopVerse is a demo microservices e-commerce platform, deployed by GitOps (Argo CD).</p>
        </div>
        <div>
          <h4>HELP</h4>
          <p>Payments · Shipping · Returns · FAQ</p>
        </div>
        <div>
          <h4>TEST PAYMENTS</h4>
          <p>Card 4000 0000 0000 0002 is always declined. Any other card succeeds.</p>
        </div>
      </div>
      <p className="copyright">© {new Date().getFullYear()} ShopVerse</p>
    </footer>
  );
}
