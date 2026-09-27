const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function getProducts() {
  const response = await fetch(`${API_URL}/api/products`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }
  return response.json();
}

export async function getOptionHistory(optionId) {
  const response = await fetch(`${API_URL}/api/options/${optionId}/history`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }
  return response.json();
}

export async function addProduct(productUrl, optionName) {
  const response = await fetch(`${API_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ productUrl, optionName })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to add product');
  }
  
  return data;
}

export async function searchProducts(query) {
  const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Search failed');
  }
  return response.json();
}
