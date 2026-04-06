/**
 * API client — all backend communication goes through here.
 * 
 * In dev, Vite proxies /api to localhost:8080.
 * In production, same origin serves both API and frontend.
 */

const BASE = '/api';

async function getErrorMessage(res) {
  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const error = await res.json().catch(() => null)
    if (typeof error?.detail === 'string') return error.detail
    if (Array.isArray(error?.detail)) {
      return error.detail.map(item => item.msg || item.message || 'Validation error').join(', ')
    }
  }

  const text = await res.text().catch(() => '')
  return text || res.statusText || `API error: ${res.status}`
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);

  if (!res.ok) {
    throw new Error(await getErrorMessage(res));
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Quotes ──

export const quotes = {
  list: (status) => request(`/quotes${status ? `?status=${status}` : ''}`),
  get: (id) => request(`/quotes/${id}`),
  create: (data) => request('/quotes', { method: 'POST', body: data }),
  update: (id, data) => request(`/quotes/${id}`, { method: 'PATCH', body: data }),
  delete: (id) => request(`/quotes/${id}`, { method: 'DELETE' }),
  recalculate: (id) => request(`/quotes/${id}/recalculate`, { method: 'POST' }),
};

// ── Products ──

export const products = {
  add: (optionId, data) => request(`/options/${optionId}/products`, { method: 'POST', body: data }),
  update: (optionId, productId, data) => request(`/options/${optionId}/products/${productId}`, { method: 'PATCH', body: data }),
  delete: (optionId, productId) => request(`/options/${optionId}/products/${productId}`, { method: 'DELETE' }),
};

// ── Cost Blocks ──

export const costBlocks = {
  add: (productId, data) => request(`/products/${productId}/cost-blocks`, { method: 'POST', body: data }),
  update: (productId, blockId, data) => request(`/products/${productId}/cost-blocks/${blockId}`, { method: 'PATCH', body: data }),
  delete: (productId, blockId) => request(`/products/${productId}/cost-blocks/${blockId}`, { method: 'DELETE' }),
};

// ── Labor Blocks ──

export const laborBlocks = {
  add: (productId, data) => request(`/products/${productId}/labor-blocks`, { method: 'POST', body: data }),
  update: (productId, blockId, data) => request(`/products/${productId}/labor-blocks/${blockId}`, { method: 'PATCH', body: data }),
  delete: (productId, blockId) => request(`/products/${productId}/labor-blocks/${blockId}`, { method: 'DELETE' }),
};

// ── Group Pools ──

export const groupCostPools = {
  create: (quoteId, data) => request(`/quotes/${quoteId}/group-cost-pools`, { method: 'POST', body: data }),
  update: (poolId, data) => request(`/group-cost-pools/${poolId}`, { method: 'PATCH', body: data }),
  delete: (poolId) => request(`/group-cost-pools/${poolId}`, { method: 'DELETE' }),
  addMember: (poolId, productId) => request(`/group-cost-pools/${poolId}/members/${productId}`, { method: 'POST' }),
  removeMember: (poolId, productId) => request(`/group-cost-pools/${poolId}/members/${productId}`, { method: 'DELETE' }),
};

export const groupLaborPools = {
  create: (quoteId, data) => request(`/quotes/${quoteId}/group-labor-pools`, { method: 'POST', body: data }),
  update: (poolId, data) => request(`/group-labor-pools/${poolId}`, { method: 'PATCH', body: data }),
  delete: (poolId) => request(`/group-labor-pools/${poolId}`, { method: 'DELETE' }),
};

// ── Catalog & Context ──

export const catalog = {
  search: (query) => request(`/catalog${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  get: (id) => request(`/catalog/${id}`),
};

export const materialContext = {
  list: () => request('/material-context'),
  get: (type) => request(`/material-context/${encodeURIComponent(type)}`),
};
