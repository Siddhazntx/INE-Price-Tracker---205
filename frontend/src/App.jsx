import { useState, useEffect, useCallback } from 'react';
import AddProduct from './components/AddProduct';
import ProductList from './components/ProductList';
import { getProducts } from './api';

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProducts();
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="app-shell" id="top">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#top" aria-label="INE Price Tracker home">
            <span className="brand__mark" aria-hidden="true">INE</span>
            <span className="brand__divider" aria-hidden="true" />
            <span className="brand__name">Price Tracker</span>
          </a>

          <nav className="primary-nav" aria-label="Main navigation">
            <a href="#overview">Overview</a>
            <a href="#track-product">Track a product</a>
            <a href="#tracked-products">Products</a>
          </nav>

          <div className="header-status">
            <span className="status-indicator" />
            <span>PRICE MONITORING</span>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="hero-section" id="overview">
          <div className="hero-copy">
            <p className="eyebrow"><span /> PRODUCT INTELLIGENCE</p>
            <h1>INE Price Tracker</h1>
            <p className="hero-lede">Track product prices and availability with a clearer view of every change.</p>
            <div className="hero-meta">
              <span className="hero-meta__accent" />
              <span>One place for your tracked products</span>
            </div>
          </div>

          <div className="watchlist-summary" aria-label={`${products.length} tracked products`}>
            <div className="summary-heading">
              <span>YOUR WATCHLIST</span>
              <span className="summary-live"><span /> LIVE</span>
            </div>
            <div className="summary-value">{products.length.toString().padStart(2, '0')}</div>
            <p>Products in your tracker</p>
            <div className="summary-rule" aria-hidden="true">
              <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>
        </section>

        <div className="dashboard-grid">
          <aside className="dashboard-sidebar" id="track-product">
          <AddProduct onProductAdded={fetchProducts} />
          </aside>
          <section className="products-section" id="tracked-products" aria-labelledby="products-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow eyebrow--dark">YOUR COLLECTION</p>
                <h2 id="products-title">Tracked products</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="section-count">{products.length} tracked</span>
                <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/export/csv`} download className="btn" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>Export CSV</a>
              </div>
            </div>
            <ProductList products={products} loading={loading} error={error} />
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
