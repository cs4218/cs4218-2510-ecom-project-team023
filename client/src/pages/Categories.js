import React from "react";
import { Link } from "react-router-dom";
import useCategory from "../hooks/useCategory";
import Layout from "../components/Layout";

const Categories = () => {
  // normalize to an array so `.map` never crashes
  const raw = useCategory();
  const categories = Array.isArray(raw) ? raw : [];

  const renderItem = (c, idx) => {
    const name = c?.name ?? "Untitled";
    const slug = c?.slug;
    const key =
      c?._id ?? slug ?? `${name}-${idx}`; // stable-enough fallback for tests

    // Missing slug => safe disabled anchor (no /category/undefined)
    if (!slug) {
      return (
        <div className="col-md-6 mt-5 mb-3 gx-3 gy-3" key={key}>
          <a
            href="#"
            aria-disabled="true"
            className="btn btn-secondary disabled"
            onClick={(e) => e.preventDefault()}
          >
            {name}
          </a>
        </div>
      );
    }

    // Missing name => still link to slug, but show readable fallback label
    return (
      <div className="col-md-6 mt-5 mb-3 gx-3 gy-3" key={key}>
        <Link
          to={`/category/${slug}`}
          className="btn btn-primary"
          data-testid={`link-/category/${slug}`}
        >
          {name}
        </Link>
      </div>
    );
  };

  return (
    <Layout title={"All Categories"} data-testid="layout">
      <div className="container">
        <div className="row">
          {/* Empty state */}
          {categories.length === 0 ? (
            <p className="text-muted mt-4">No categories yet.</p>
          ) : (
            categories.map(renderItem)
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Categories;
