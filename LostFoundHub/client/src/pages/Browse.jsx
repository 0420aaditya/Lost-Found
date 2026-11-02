// pages/Browse.jsx
// Public list of approved, non-deleted items with search, filters, sorting,
// pagination, and URL-persisted filter state.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { imageSrc } from "../api.js";
import Pagination from "../components/Pagination.jsx";

const SORT_KEYS = ["newest", "oldest", "name", "date"];
const PAGE_SIZE = 12;

function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawType = searchParams.get("type") || "";
  const rawSort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search") || "";
  const type = ["lost", "found"].includes(rawType) ? rawType : "";
  const category = searchParams.get("category") || "";
  const sort = SORT_KEYS.includes(rawSort) ? rawSort : "newest";
  const parsedPage = Number(searchParams.get("page") || "1");
  const page =
    Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [form, setForm] = useState({ search, type, category, sort });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the form controls in sync with the URL (navbar links, back button...).
  useEffect(() => {
    setForm({ search, type, category, sort });
  }, [search, type, category, sort]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const params = { page, limit: PAGE_SIZE, sort };
      if (search) params.search = search;
      if (type) params.type = type;
      if (category) params.category = category;
      try {
        const res = await api.get("/items", { params });
        if (!active) return;
        setItems(res.data.items);
        setPagination(res.data.pagination);
      } catch (err) {
        if (!active) return;
        setItems([]);
        setError(err.response?.data?.message || "Could not load items.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [search, type, category, sort, page, reloadKey]);

  function submitFilters(event) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (form.search.trim()) next.set("search", form.search.trim());
    if (form.type) next.set("type", form.type);
    if (form.category.trim()) next.set("category", form.category.trim());
    if (form.sort && form.sort !== "newest") next.set("sort", form.sort);
    setSearchParams(next);
  }

  function reset() {
    setSearchParams(new URLSearchParams());
  }

  function goToPage(nextPage) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const heading =
    type === "lost"
      ? "Lost Items"
      : type === "found"
      ? "Found Items"
      : "Browse Items";

  const blurb =
    type === "lost"
      ? "Browse items that have been reported as lost. If you found one of them, submit a found report."
      : type === "found"
      ? "Browse found items. If one is yours, open it to submit a claim once it is at the hub."
      : "Browse everything that has been approved as lost or found.";

  const start =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  );

  return (
    <main>
      <section className="page-header">
        <div className="container">
          <h1>{heading}</h1>
          <p>{blurb}</p>
        </div>
      </section>

      <section className="search-filter">
        <div className="container">
          <form onSubmit={submitFilters}>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search by name, description or location..."
                aria-label="Search items"
                value={form.search}
                maxLength={100}
                onChange={(e) =>
                  setForm({ ...form, search: e.target.value })
                }
              />
              <button type="submit" aria-label="Search">
                <i className="fas fa-search"></i>
              </button>
            </div>

            <div className="filter-options">
              <div className="filter-group">
                <label htmlFor="type">Type</label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="">All Types</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  type="text"
                  placeholder="e.g. electronics"
                  value={form.category}
                  maxLength={60}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <div className="filter-group">
                <label htmlFor="sort">Sort</label>
                <select
                  id="sort"
                  value={form.sort}
                  onChange={(e) => setForm({ ...form, sort: e.target.value })}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A-Z</option>
                  <option value="date">Item date</option>
                </select>
              </div>
              <div className="filter-group">
                <label>&nbsp;</label>
                <button className="btn" type="submit">
                  Apply Filters
                </button>
              </div>
              <div className="filter-group">
                <label>&nbsp;</label>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={reset}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="items-listing">
        <div className="container">
          {error && (
            <div className="alert error" role="alert">
              {error}{" "}
              <button
                type="button"
                className="btn btn-sm secondary"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <p className="empty text-center">Loading...</p>
          ) : items.length === 0 ? (
            <p className="empty text-center">
              No items match your search. Try clearing the filters.
            </p>
          ) : (
            <>
              <p className="muted text-center">
                Showing {start}&ndash;{end} of {pagination.total} item
                {pagination.total === 1 ? "" : "s"}
              </p>
              <div className="items-grid">
                {items.map((item) => (
                  <Link
                    className="item-card"
                    key={item._id}
                    to={`/items/${item._id}`}
                  >
                    <div className="item-image">
                      {item.imageUrl ? (
                        <img
                          src={imageSrc(item.imageUrl)}
                          alt={item.itemName}
                          loading="lazy"
                        />
                      ) : (
                        <div className="no-image">No photo</div>
                      )}
                      <span className={`status ${item.type}`}>
                        {item.type}
                      </span>
                    </div>
                    <div className="item-details">
                      <span className="item-category">{item.category}</span>
                      <h3>{item.itemName}</h3>
                      <p className="location">
                        <i className="fas fa-map-marker-alt"></i>{" "}
                        {item.locationLostOrFound}
                      </p>
                      <p className="date">
                        <i className="far fa-calendar-alt"></i>{" "}
                        {new Date(item.dateLostOrFound).toLocaleDateString()}
                      </p>
                      <span className="btn btn-sm">View Details</span>
                    </div>
                  </Link>
                ))}
              </div>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onChange={goToPage}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default Browse;
