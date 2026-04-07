import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { quotes as quotesApi, groupCostPools, groupLaborPools } from '../api/client'

// ── Constants ────────────────────────────────────────────────────────

const LC_LABELS = {
  LC100: 'Handling', LC101: 'Processing', LC102: 'Belt Sand',
  LC103: 'Cutting', LC104: 'CNC', LC105: 'Wood Fab',
  LC106: 'Fin Sand', LC107: 'Metal Fab', LC108: 'Stone Fab',
  LC109: 'Finishing', LC110: 'Assembly', LC111: 'Packing',
}

const COST_CATEGORIES = [
  { value: 'misc', label: 'Misc' },
  { value: 'consumables', label: 'Consumables' },
  { value: 'stock_base_shipping', label: 'SB Shipping' },
  { value: 'unit_cost', label: 'Unit Cost' },
  { value: 'group_cost', label: 'Group Cost' },
  { value: 'species', label: 'Species' },
  { value: 'stone', label: 'Stone' },
  { value: 'stock_base', label: 'Stock Base' },
  { value: 'powder_coat', label: 'Powder Coat' },
  { value: 'custom_base', label: 'Custom Base' },
]

const LABOR_CENTERS = Object.entries(LC_LABELS).map(([v, l]) => ({ value: v, label: `${v} – ${l}` }))

const DIST_OPTIONS = [
  { value: 'units', label: 'By Units' },
  { value: 'sqft', label: 'By Sq Ft' },
  { value: 'bdft', label: 'By Bd Ft' },
]

// ── Helpers ──────────────────────────────────────────────────────────

function fmt$(val) {
  if (val == null) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtH(val) {
  if (val == null) return '—'
  return Number(val).toFixed(1) + 'h'
}

function fmtRate(val) {
  if (val == null) return '—'
  return '$' + Number(val).toFixed(2) + '/hr'
}

// ── Sub-components ───────────────────────────────────────────────────

function SummaryRow({ label, value, indent = false, accent, muted }) {
  return (
    <div className={`sp-row${indent ? ' sp-row--indent' : ''}`}>
      <span className="sp-row-label" style={muted ? { color: 'var(--text-muted)' } : undefined}>{label}</span>
      <span
        className="sp-row-value"
        style={accent === 'price' ? { color: 'var(--green-300)' }
          : accent === 'cost' ? { color: 'var(--cost-text)' }
          : accent === 'hours' ? { color: 'var(--hours-text)' }
          : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function SectionHeader({ title, children }) {
  return (
    <div className="sp-section-header">
      <span className="sp-section-title">{title}</span>
      {children}
    </div>
  )
}

function PoolCard({ pool, type, productList, onUpdate, onDelete }) {
  const [localAmount, setLocalAmount] = useState(
    type === 'cost' ? String(pool.total_amount ?? '') : String(pool.total_hours ?? '')
  )
  const [saving, setSaving] = useState(false)

  // Sync if pool changes from outside
  useEffect(() => {
    setLocalAmount(type === 'cost' ? String(pool.total_amount ?? '') : String(pool.total_hours ?? ''))
  }, [pool.total_amount, pool.total_hours, type])

  const memberIds = new Set((pool.members || []).map(m => m.product_id))
  const api = type === 'cost' ? groupCostPools : groupLaborPools
  const amountField = type === 'cost' ? 'total_amount' : 'total_hours'

  async function saveAmount() {
    const num = parseFloat(localAmount)
    if (isNaN(num)) return
    setSaving(true)
    try {
      const updated = await api.update(pool.id, { [amountField]: num })
      onUpdate(updated)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function handleDistChange(e) {
    try {
      const updated = await api.update(pool.id, { distribution_type: e.target.value })
      onUpdate(updated)
    } catch (e) { console.error(e) }
  }

  async function toggleMember(productId) {
    const isMember = memberIds.has(productId)
    try {
      const updated = isMember
        ? await api.removeMember(pool.id, productId)
        : await api.addMember(pool.id, productId)
      onUpdate(updated)
    } catch (e) { console.error(e) }
  }

  const label = type === 'cost'
    ? (pool.description || pool.cost_category || 'Cost Pool')
    : (pool.description || `${pool.labor_center} – ${LC_LABELS[pool.labor_center] || ''}`)

  return (
    <div className="sp-pool-card">
      <div className="sp-pool-header">
        <span className="sp-pool-label">{label}</span>
        <button className="sp-icon-btn sp-icon-btn--danger" onClick={() => onDelete(pool.id)} title="Delete pool">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="sp-pool-fields">
        <div className="sp-pool-field">
          <label>{type === 'cost' ? 'Total $' : 'Total hrs'}</label>
          <input
            type="number"
            step={type === 'cost' ? '1' : '0.25'}
            value={localAmount}
            onChange={e => setLocalAmount(e.target.value)}
            onBlur={saveAmount}
            disabled={saving}
          />
        </div>
        <div className="sp-pool-field">
          <label>Distribute by</label>
          <select value={pool.distribution_type || 'units'} onChange={handleDistChange}>
            {DIST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="sp-pool-members">
        {productList.map(p => (
          <label key={p.id} className="sp-member-row">
            <input
              type="checkbox"
              checked={memberIds.has(p.id)}
              onChange={() => toggleMember(p.id)}
            />
            <span>{p.title || p.id.slice(0, 8)}</span>
            {memberIds.has(p.id) && (
              <span className="sp-member-share">
                {type === 'cost'
                  ? (pool.members?.find(m => m.product_id === p.id)?.cost_pp != null
                      ? `$${Number(pool.members.find(m => m.product_id === p.id).cost_pp).toFixed(2)}`
                      : '')
                  : (pool.members?.find(m => m.product_id === p.id)?.hours_pp != null
                      ? `${Number(pool.members.find(m => m.product_id === p.id).hours_pp).toFixed(2)}h`
                      : '')}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  )
}

function NewPoolForm({ type, productList, quoteId, onCreated, onCancel }) {
  const [form, setForm] = useState(
    type === 'cost'
      ? { description: '', cost_category: 'misc', total_amount: '', distribution_type: 'sqft' }
      : { description: '', labor_center: 'LC100', total_hours: '', distribution_type: 'units' }
  )
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const api = type === 'cost' ? groupCostPools : groupLaborPools

  function toggleProduct(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate() {
    const amount = type === 'cost' ? parseFloat(form.total_amount) : parseFloat(form.total_hours)
    if (isNaN(amount) || amount <= 0) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        [type === 'cost' ? 'total_amount' : 'total_hours']: amount,
        product_ids: [...selectedIds],
        on_qty_change: 'redistribute',
      }
      const updated = await api.create(quoteId, payload)
      onCreated(updated)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div className="sp-new-pool-form">
      <div className="sp-pool-fields">
        <div className="sp-pool-field" style={{ flexBasis: '100%' }}>
          <label>Description</label>
          <input
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder={type === 'cost' ? 'e.g. Misc Supplies' : 'e.g. LC100 Handling'}
          />
        </div>
        {type === 'cost' ? (
          <div className="sp-pool-field">
            <label>Category</label>
            <select value={form.cost_category} onChange={e => setForm(f => ({ ...f, cost_category: e.target.value }))}>
              {COST_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        ) : (
          <div className="sp-pool-field">
            <label>Labor Center</label>
            <select value={form.labor_center} onChange={e => setForm(f => ({ ...f, labor_center: e.target.value }))}>
              {LABOR_CENTERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div className="sp-pool-field">
          <label>{type === 'cost' ? 'Total $' : 'Total hrs'}</label>
          <input
            type="number"
            step={type === 'cost' ? '1' : '0.25'}
            value={type === 'cost' ? form.total_amount : form.total_hours}
            onChange={e => setForm(f => ({
              ...f,
              [type === 'cost' ? 'total_amount' : 'total_hours']: e.target.value
            }))}
            placeholder="0"
          />
        </div>
        <div className="sp-pool-field">
          <label>Distribute by</label>
          <select value={form.distribution_type} onChange={e => setForm(f => ({ ...f, distribution_type: e.target.value }))}>
            {DIST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="sp-pool-members">
        {productList.map(p => (
          <label key={p.id} className="sp-member-row">
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => toggleProduct(p.id)}
            />
            <span>{p.title || p.id.slice(0, 8)}</span>
          </label>
        ))}
      </div>

      <div className="sp-new-pool-actions">
        <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating...' : 'Create'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main SidePanel ───────────────────────────────────────────────────

export default function SidePanel({ quote, activeOption, onOptionSelect, onQuoteUpdate }) {
  const [summary, setSummary] = useState(null)
  const [laborExpanded, setLaborExpanded] = useState(true)
  const [addingCostPool, setAddingCostPool] = useState(false)
  const [addingLaborPool, setAddingLaborPool] = useState(false)
  const [shippingSaving, setShippingSaving] = useState(false)
  const [localShipping, setLocalShipping] = useState(String(quote?.shipping ?? '0'))

  const options = quote?.options || []
  const productList = activeOption?.products || []
  const costPools = quote?.group_cost_pools || []
  const laborPools = quote?.group_labor_pools || []

  // Sync shipping from quote prop
  useEffect(() => {
    setLocalShipping(String(quote?.shipping ?? '0'))
  }, [quote?.shipping])

  // Fetch summary whenever computed totals change
  useEffect(() => {
    if (!quote?.id) return
    quotesApi.summary(quote.id)
      .then(setSummary)
      .catch(e => console.error('Summary load failed:', e))
  }, [quote?.id, quote?.total_price, quote?.total_cost, quote?.total_hours])

  async function handleDeleteCostPool(poolId) {
    if (!window.confirm('Delete this shared cost pool?')) return
    try {
      const updated = await groupCostPools.delete(poolId)
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  async function handleDeleteLaborPool(poolId) {
    if (!window.confirm('Delete this shared hours pool?')) return
    try {
      const updated = await groupLaborPools.delete(poolId)
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  async function saveShipping() {
    const val = parseFloat(localShipping) || 0
    setShippingSaving(true)
    try {
      const updated = await quotesApi.update(quote.id, { shipping: val })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
    setShippingSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <aside className="quote-canvas-left">

      {/* ── Option Switcher ── */}
      {options.length > 1 && (
        <div className="canvas-panel">
          <div className="canvas-panel-title">Option View</div>
          <div className="option-tabs">
            {options.map((opt, idx) => (
              <button key={opt.id} className={`option-tab${activeOption?.id === opt.id ? ' active' : ''}`} onClick={() => onOptionSelect(opt.id)}>
                {opt.name || `Option ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Job Summary ── */}
      <div className="canvas-panel">
        <div className="canvas-panel-title">Summary</div>

        {/* Cost groups */}
        {summary ? (
          <>
            <SummaryRow label="Materials" value={fmt$(summary.material_cost_total)} accent="cost" />
            <SummaryRow label="Base Costs" value={fmt$(summary.base_cost_total)} accent="cost" />
            <SummaryRow label="Other Costs" value={fmt$(summary.other_cost_total)} accent="cost" />
            <div className="sp-divider" />
            <SummaryRow label="Total Cost" value={fmt$(summary.total_cost)} accent="cost" />
            <SummaryRow label="Total Margin" value={fmt$(summary.total_margin)} muted />
            <SummaryRow label="Material Price" value={fmt$(summary.total_material_price)} />
            <div className="sp-divider" />

            {/* Labor by LC */}
            <div
              className="sp-expandable-header"
              onClick={() => setLaborExpanded(v => !v)}
            >
              <span className="sp-row-label" style={{ color: 'var(--hours-text)' }}>
                Labor {summary.total_hours ? `${Number(summary.total_hours).toFixed(1)}h` : ''}
              </span>
              {laborExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            {laborExpanded && Object.entries(summary.hours_by_labor_center || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([lc, hrs]) => (
                <SummaryRow
                  key={lc}
                  label={`${lc} ${LC_LABELS[lc] || ''}`}
                  value={fmtH(hrs)}
                  indent
                  accent="hours"
                />
              ))
            }
            <SummaryRow label="Hours Price" value={fmt$(summary.hours_price)} />
            <div className="sp-divider" />

            {/* Financial summary */}
            <SummaryRow label="Quote Total" value={fmt$(summary.quote_total)} accent="price" />
            <SummaryRow label="Shipping" value={fmt$(summary.shipping)} muted />
            <SummaryRow label="Grand Total" value={fmt$(summary.grand_total)} accent="price" />
            <div className="sp-divider" />
            <SummaryRow label="Op Revenue" value={fmt$(summary.op_revenue)} />
            <SummaryRow label="Job $/hr" value={fmtRate(summary.job_dollar_per_hr)} />
          </>
        ) : (
          <>
            <SummaryRow label="Quote Total" value={fmt$(quote?.total_price)} accent="price" />
            <SummaryRow label="Total Hours" value={fmtH(quote?.total_hours)} accent="hours" />
            <SummaryRow label="Grand Total" value={fmt$(quote?.grand_total)} accent="price" />
          </>
        )}
      </div>

      {/* ── Shipping ── */}
      <div className="canvas-panel">
        <div className="canvas-panel-title">Shipping</div>
        <div className="sp-inline-field">
          <span className="sp-inline-prefix">$</span>
          <input
            type="number"
            step="10"
            value={localShipping}
            onChange={e => setLocalShipping(e.target.value)}
            onBlur={saveShipping}
            disabled={shippingSaving}
          />
        </div>
      </div>

      {/* ── Shared Costs ── */}
      <div className="canvas-panel">
        <SectionHeader title="Shared Costs">
          {!addingCostPool && (
            <button className="sp-add-btn" onClick={() => setAddingCostPool(true)} title="Add cost pool">
              <Plus size={13} />
            </button>
          )}
        </SectionHeader>

        {costPools.map(pool => (
          <PoolCard
            key={pool.id}
            pool={pool}
            type="cost"
            productList={productList}
            onUpdate={onQuoteUpdate}
            onDelete={handleDeleteCostPool}
          />
        ))}

        {addingCostPool && (
          <NewPoolForm
            type="cost"
            productList={productList}
            quoteId={quote.id}
            onCreated={(updated) => { onQuoteUpdate(updated); setAddingCostPool(false) }}
            onCancel={() => setAddingCostPool(false)}
          />
        )}

        {costPools.length === 0 && !addingCostPool && (
          <p className="sp-empty">No shared costs yet</p>
        )}
      </div>

      {/* ── Shared Hours ── */}
      <div className="canvas-panel">
        <SectionHeader title="Shared Hours">
          {!addingLaborPool && (
            <button className="sp-add-btn" onClick={() => setAddingLaborPool(true)} title="Add hours pool">
              <Plus size={13} />
            </button>
          )}
        </SectionHeader>

        {laborPools.map(pool => (
          <PoolCard
            key={pool.id}
            pool={pool}
            type="labor"
            productList={productList}
            onUpdate={onQuoteUpdate}
            onDelete={handleDeleteLaborPool}
          />
        ))}

        {addingLaborPool && (
          <NewPoolForm
            type="labor"
            productList={productList}
            quoteId={quote.id}
            onCreated={(updated) => { onQuoteUpdate(updated); setAddingLaborPool(false) }}
            onCancel={() => setAddingLaborPool(false)}
          />
        )}

        {laborPools.length === 0 && !addingLaborPool && (
          <p className="sp-empty">No shared hours yet</p>
        )}
      </div>

    </aside>
  )
}
