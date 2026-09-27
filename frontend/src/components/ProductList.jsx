import ProductCard from './ProductCard';

export default function ProductList({ products, loading, error }) {
  if (loading) {
    return <div className="loading-container" role="status">Loading products...</div>;
  }

  if (error) {
    return (
      <div className="error-message list-error" role="alert">
        Failed to load products: {error}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__mark" aria-hidden="true">INE</span>
        <p className="eyebrow eyebrow--dark">YOUR WATCHLIST</p>
        <h3>No products tracked yet</h3>
        <p className="empty-state__copy">Add a product using the form to start tracking prices.</p>
      </div>
    );
  }

  return (
    <div className="product-list">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
