// pages/Browse.jsx
// Public list of approved, non-deleted items with search and filters.
// The page structure mirrors the static lost-items.html / found-items.html:
// a page header, a search + filter band, then a grid of item cards.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { imageSrc } from "../api.js";

function Browse() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchItems({ search, type, category }) {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (type) params.type = type;
    if (category) params.category = category;
    try {
      const res = await api.get("/items", { params });
      setItems(res.data.items);
    } catch (err) {
      setItems([]);
    }
    setLoading(false);
  }

  // Sync from the URL (the navbar links to /items?type=lost|found) and reload
  // whenever the query string changes.
  useEffect(() => {
    const s = searchParams.get("search") || "";
    const t = searchParams.get("type") || "";
    const c = searchParams.get("category") || "";
    setSearch(s);
    setType(t);
    setCategory(c);
    fetchItems({ search: s, type: t, category: c });
  }, [searchParams]);

  function submitFilters(e) {
    e.preventDefault();
    fetchItems({ search, type, category });
  }

  function reset() {
    setSearch("");
    setType("");
    setCategory("");
    fetchItems({ search: "", type: "", category: "" });
  }

  const heading =
    type === "lost" ? "Lost Items" : type === "found" ? "Found Items" : "Browse Items";

  const blurb =
    type === "lost"
      ? "Browse through items that have been reported as lost. If you've found any of these items, please report it."
      : type === "found"
      ? "Browse through items that have been handed in. If one of them is yours, open it to make a claim."
      : "Browse everything that has been reported as lost or found.";

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
                placeholder="Search for items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" aria-label="Search">
                <i className="fas fa-search"></i>
              </button>
            </div>

            <div className="filter-options">
              <div className="filter-group">
                <label htmlFor="type">Type:</label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="lost">Lost</option>
                  <option value="found">Found</option>
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="category">Category:</label>
                <input
                  id="category"
                  type="text"
                  placeholder="e.g. electronics"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label>&nbsp;</label>
                <button className="btn" type="submit">
                  Apply Filters
                </button>
              </div>
              <div className="filter-group">
                <label>&nbsp;</label>
                <button className="btn secondary" type="button" onClick={reset}>
                  Reset
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      <section className="items-listing">
        <div className="container">
          {loading ? (
            <p className="empty text-center">Loading...</p>
          ) : items.length === 0 ? (
            <p className="empty text-center">No items found.</p>
          ) : (
            <div className="items-grid">
              {items.map((item) => (
                <Link
                  className="item-card"
                  key={item._id}
                  to={`/items/${item._id}`}
                >
                  <div className="item-image">
                    {item.imageUrl ? (
                      <img src={imageSrc(item.imageUrl)} alt={item.itemName} />
                    ) : (
                      <div className="no-image">No photo</div>
                    )}
                    <span className={`status ${item.type}`}>{item.type}</span>
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
          )}
        </div>
      </section>
    </main>
  );
}

export default Browse;
