export default function Pagination({ skip, take, total, onPageChange }) {
  const totalPages  = Math.ceil(total / take)
  const currentPage = Math.floor(skip / take) + 1
  const isFirst     = skip === 0
  const isLast      = skip + take >= total

  if (totalPages <= 1) return null

  const goTo = (page) => onPageChange((page - 1) * take)

  // Build page numbers — always show first, last, current ± 1
  const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', marginTop: '8px'
    }}>
      {/* Summary */}
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
        {skip + 1}–{Math.min(skip + take, total)} of {total}
      </span>

      {/* Page buttons */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          className="btn btn-sm"
          onClick={() => goTo(currentPage - 1)}
          disabled={isFirst}
          style={{ padding: '4px 8px' }}
        >
          <i className="ti ti-chevron-left" />
        </button>

        {sorted.map((page, i) => {
          const prev = sorted[i - 1]
          return (
            <div key={page} style={{ display: 'flex', gap: '4px' }}>
              {prev && page - prev > 1 && (
                <span style={{ padding: '4px 4px', color: 'var(--text-hint)', fontSize: '13px' }}>
                  …
                </span>
              )}
              <button
                className={`btn btn-sm ${page === currentPage ? 'btn-primary' : ''}`}
                onClick={() => goTo(page)}
                style={{ padding: '4px 10px', minWidth: '32px' }}
              >
                {page}
              </button>
            </div>
          )
        })}

        <button
          className="btn btn-sm"
          onClick={() => goTo(currentPage + 1)}
          disabled={isLast}
          style={{ padding: '4px 8px' }}
        >
          <i className="ti ti-chevron-right" />
        </button>
      </div>

      {/* Page size */}
      <select
        className="form-input"
        value={take}
        onChange={e => onPageChange(0, parseInt(e.target.value))}
        style={{ width: 'auto', padding: '4px 8px', fontSize: '13px' }}
      >
        <option value={10}>10 / page</option>
        <option value={20}>20 / page</option>
        <option value={50}>50 / page</option>
      </select>
    </div>
  )
}