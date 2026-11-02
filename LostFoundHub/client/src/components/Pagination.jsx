// components/Pagination.jsx
// Accessible previous/next paging controls with a small window of page numbers.
function buildPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("start-ellipsis");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("end-ellipsis");
  pages.push(total);
  return pages;
}

function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-sm secondary"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </button>

      <ul className="pagination-pages">
        {pages.map((entry) =>
          typeof entry === "number" ? (
            <li key={entry}>
              <button
                type="button"
                className={`pagination-page${entry === page ? " active" : ""}`}
                onClick={() => onChange(entry)}
                aria-current={entry === page ? "page" : undefined}
              >
                {entry}
              </button>
            </li>
          ) : (
            <li key={entry} className="pagination-ellipsis" aria-hidden="true">
              &hellip;
            </li>
          )
        )}
      </ul>

      <button
        type="button"
        className="btn btn-sm secondary"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </button>
    </nav>
  );
}

export default Pagination;
