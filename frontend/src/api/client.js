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
  summary: (id) => request(`/quotes/${id}/summary`),
};

// ── Products ──

export const products = {
  add: (optionId, data) => request(`/options/${optionId}/products`, { method: 'POST', body: data }),
  update: (optionId, productId, data) => request(`/options/${optionId}/products/${productId}`, { method: 'PATCH', body: data }),
  delete: (optionId, productId) => request(`/options/${optionId}/products/${productId}`, { method: 'DELETE' }),
};

// ── Quote Blocks ──

export const quoteBlocks = {
  create: (quoteId, data) => request(`/quotes/${quoteId}/blocks`, { method: 'POST', body: data }),
  update: (blockId, data) => request(`/blocks/${blockId}`, { method: 'PATCH', body: data }),
  delete: (blockId) => request(`/blocks/${blockId}`, { method: 'DELETE' }),
  addMember: (blockId, productId) => request(`/blocks/${blockId}/members/${productId}`, { method: 'POST' }),
  removeMember: (blockId, productId) => request(`/blocks/${blockId}/members/${productId}`, { method: 'DELETE' }),
  updateMember: (blockId, productId, data) => request(`/blocks/${blockId}/members/${productId}`, { method: 'PATCH', body: data }),
};

// ── System Defaults ──

export const defaults = {
  get: () => request('/defaults'),
  update: (data) => request('/defaults', { method: 'PATCH', body: data }),
};

// ── Components (Material Builder) ──

export const components = {
  add: (productId, data) => request(`/products/${productId}/components`, { method: 'POST', body: data }),
  update: (productId, componentId, data) => request(`/products/${productId}/components/${componentId}`, { method: 'PATCH', body: data }),
  delete: (productId, componentId) => request(`/products/${productId}/components/${componentId}`, { method: 'DELETE' }),
};

// ── Description Items ──

export const descriptionItems = {
  add: (productId, data) => request(`/products/${productId}/description-items`, { method: 'POST', body: data }),
  update: (productId, itemId, data) => request(`/products/${productId}/description-items/${itemId}`, { method: 'PATCH', body: data }),
  delete: (productId, itemId) => request(`/products/${productId}/description-items/${itemId}`, { method: 'DELETE' }),
};

// ── Tags ──

export const tags = {
  list: () => request('/tags'),
  create: (data) => request('/tags', { method: 'POST', body: data }),
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
