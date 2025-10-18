import React from "react";
import Layout from "./../components/Layout";
import { useSearch } from "../context/search";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/cart";
import toast from "react-hot-toast";

const Search = () => {
  const [values] = useSearch();
  const navigate = useNavigate();
  const [cart, setCart] = useCart();

  const handleAddToCart = (product) => {
    if (!product?._id) return;

    try {
      // ✅ Always read the freshest cart from localStorage
      const existing = JSON.parse(localStorage.getItem("cart") || "[]");

      // ✅ Push a *new* item each time (no deduping or quantity)
      const updated = [...existing, product];

      // ✅ Force new array reference so React re-renders
      const fresh = [...updated];

      setCart(fresh);
      localStorage.setItem("cart", JSON.stringify(fresh));

      toast.success(`${product.name} added to cart`);
    } catch (err) {
      console.error("Add to cart failed:", err);
      toast.error("Unable to add to cart");
    }
  };

  return (
    <Layout title="Search Results">
      <div className="container">
        <div className="text-center">
          <h1>Search Results</h1>
          <h6>
            {Array.isArray(values?.results) && values.results.length > 0
              ? `Found ${values.results.length}`
              : "No Products Found"}
          </h6>

          <div className="d-flex flex-wrap mt-4">
            {(values?.results ?? []).map((p) => (
              <div className="card m-2" style={{ width: "18rem" }} key={p._id}>
                <img
                  src={`/api/v1/product/product-photo/${p._id}`}
                  className="card-img-top"
                  alt={p.name}
                />
                <div className="card-body">
                  <h5 className="card-title">{p.name}</h5>
                  <p className="card-text">
                    {(p.description ?? "").substring(0, 30)}...
                  </p>
                  <p className="card-text">Price: ${p.price}</p>

                  <button
                    className="btn btn-primary ms-1"
                    onClick={() => navigate(`/product/${p.slug}`)}
                  >
                    More Details
                  </button>

                  <button
                    className="btn btn-secondary ms-1"
                    onClick={() => handleAddToCart(p)}
                    data-testid={`add-cart-${p._id}`}
                  >
                    ADD TO CART
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Search;
