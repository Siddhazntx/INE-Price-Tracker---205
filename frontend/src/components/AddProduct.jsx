import { useState } from 'react';
import { addProduct, searchProducts } from '../api';

export default function AddProduct({ onProductAdded }) {
  const [productUrl, setProductUrl] = useState('');
  const [optionName, setOptionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await searchProducts(searchQuery);
      setSearchResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product) => {
    setProductUrl(`https://demo.inelabteamdev.com/item/${product.id}`);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await addProduct(productUrl, optionName);
      setResult(data.data);
      if (onProductAdded) {
        onProductAdded();
      }
      setProductUrl('');
      setOptionName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card track-form-card">
      <div className="card-heading">
        <p className="eyebrow eyebrow--dark">ADD TO WATCHLIST</p>
        <h2 className="card-title">Track a Product</h2>
        <p className="card-description">Search for a product or paste a URL to monitor it.</p>
      </div>
      
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSearch} style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name..."
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn" disabled={searching || !searchQuery} style={{ width: 'auto' }}>
            {searching ? '...' : 'Search'}
          </button>
        </div>
      </form>

      {searchResults.length > 0 && (
        <div className="search-results" style={{ marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
          {searchResults.map(p => (
            <div key={p.id} onClick={() => handleSelectProduct(p)} style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
              <strong>{p.name}</strong> - <span>{p.sku}</span>
            </div>
          ))}
        </div>
      )}
      
      <form className="track-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="productUrl">Product URL *</label>
          <input
            id="productUrl"
            type="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            required
            placeholder="https://demo.inelabteamdev.com/item/2609"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="optionName">Option Name</label>
          <input
            id="optionName"
            type="text"
            value={optionName}
            onChange={(e) => setOptionName(e.target.value)}
            placeholder="e.g. Warm white"
          />
        </div>
        
        <button type="submit" className="btn" disabled={loading || !productUrl}>
          {loading ? 'Scraping...' : 'Track Product'}
        </button>
      </form>

      {result && (
        <div className="result-section">
          <h3 className="result-heading">Scrape Successful!</h3>
          
          <div className="result-item">
            <span className="result-label">Product Name</span>
            <span className="result-value">{result.product?.name || 'N/A'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Option</span>
            <span className="result-value">{result.option?.option_value || 'Default'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Price</span>
            <span className="result-value">${result.priceHistory?.price}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Stock Status</span>
            <span className="result-value">{result.priceHistory?.stock_status || 'Unknown'}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Attempt</span>
            <span className="result-value">{result.scrapeLog?.attempt_number}</span>
          </div>
          <div className="result-item">
            <span className="result-label">Duration</span>
            <span className="result-value">{result.scrapeLog?.duration_ms} ms</span>
          </div>
        </div>
      )}
    </section>
  );
}
