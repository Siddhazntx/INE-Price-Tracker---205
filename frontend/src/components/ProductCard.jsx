import { useState, useEffect } from 'react';
import { getOptionHistory } from '../api';

function OptionDetails({ opt }) {
  const history = opt.price_history && opt.price_history.length > 0 ? opt.price_history[0] : null;
  
  const [historyData, setHistoryData] = useState({ priceHistory: [], scrapeLogs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    getOptionHistory(opt.id)
      .then(data => {
        if (mounted) {
          setHistoryData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load history", err);
        if (mounted) setLoading(false);
      });
      
    return () => { mounted = false; };
  }, [opt.id]);

  return (
    <section className="option-panel">
      <div className="option-heading">
        <span className="option-heading__label">{opt.option_group || 'Option'}</span>
        <span className="option-heading__value">{opt.option_value || 'Default'}</span>
      </div>
      
      {history ? (
        <div className="current-data">
          <div className="current-data__line">
            <span className="data-label">Current price</span>
            <span className="current-price">
              {history.price !== null ? `₹${history.price.toLocaleString()}` : "Price unavailable"}
            </span>
          </div>
          
          <div className="current-data__line">
            <span className="data-label">Stock status</span>
            <span className={`stock-status stock-status--${history.stock_status || 'unknown'}`}>
              {history.stock_status 
                ? history.stock_status.charAt(0).toUpperCase() + history.stock_status.slice(1) 
                : 'Unknown'}
            </span>
          </div>
          
          {history.stock_count !== null && (
            <div className="current-data__line">
              <span className="data-label">Stock count</span>
              <span className="data-value">{history.stock_count}</span>
            </div>
          )}
          
          <div className="data-timestamp">
            Last checked: {new Date(history.scraped_at).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="no-price-data">
          No price data yet
        </div>
      )}

      <div className="history-stack">
        {loading ? (
          <div className="history-loading" role="status">Loading history...</div>
        ) : (
          <>
            <h4 className="subsection-title">Price History</h4>
            {historyData.priceHistory.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.priceHistory.map((ph, idx) => (
                      <tr key={idx}>
                        <td>{new Date(ph.scraped_at).toLocaleString()}</td>
                        <td className="table-price">{ph.price !== null ? `₹${ph.price.toLocaleString()}` : '-'}</td>
                        <td>
                          {ph.stock_status ? ph.stock_status.charAt(0).toUpperCase() + ph.stock_status.slice(1) : '-'}
                          {ph.stock_count !== null ? ` (${ph.stock_count})` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-empty">No price history available.</div>
            )}

            <h4 className="subsection-title subsection-title--logs">Scrape Log</h4>
            {historyData.scrapeLogs.length > 0 ? (
              <div className="table-scroll">
                <table className="data-table scrape-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Attempt</th>
                      <th>Outcome</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.scrapeLogs.map((log, idx) => {
                      const isSuccess = log.outcome === 'success';
                      const outcomeClass = log.outcome === 'success' ? 'outcome--success' : log.outcome === 'retried' ? 'outcome--retried' : 'outcome--failed';
                      
                      return (
                        <tr key={idx}>
                          <td>{new Date(log.attempted_at).toLocaleString()}</td>
                          <td>{log.attempt_number}</td>
                          <td>
                            <span className={`outcome-badge ${outcomeClass}`}>
                              {log.outcome.charAt(0).toUpperCase() + log.outcome.slice(1)}
                            </span>
                          </td>
                          <td className="table-price">{isSuccess && log.price !== null ? `₹${log.price.toLocaleString()}` : '-'}</td>
                          <td>
                            {isSuccess && log.stock_status ? log.stock_status.charAt(0).toUpperCase() + log.stock_status.slice(1) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-empty">No scrape logs available.</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default function ProductCard({ product }) {
  const formattedDate = new Date(product.updated_at).toLocaleString();
  
  return (
    <article className="card product-card">
      <div className="product-card__topline">
        {product.brand && <div className="brand">{product.brand}</div>}
        <span className="product-card__id">ID {product.store_product_id}</span>
      </div>
      <h3 className="name">{product.name || `Product ${product.store_product_id}`}</h3>
      <a href={product.product_url} target="_blank" rel="noopener noreferrer" className="url">
        <span className="url__label">PRODUCT SOURCE</span>
        <span className="url__value">{product.product_url}</span>
      </a>
      
      {product.tracked_options && product.tracked_options.length > 0 && (
        <div className="option-list">
          {product.tracked_options.map((opt) => (
            <OptionDetails key={opt.id} opt={opt} />
          ))}
        </div>
      )}

      <div className="footer">
        <span className="footer__label">Last updated</span>
        <time dateTime={product.updated_at}>{formattedDate}</time>
      </div>
    </article>
  );
}
