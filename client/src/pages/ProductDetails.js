// src/pages/ProductDetails.jsx
import React, { useState, useEffect } from "react";
import Layout from "./../components/Layout";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/ProductDetailsStyles.css";

const ProductDetails = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState({});
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    const slug = params?.slug;

    // Reset view immediately on slug change so tests don't see stale data
    setProduct({});
    setRelatedProducts([]);

    if (!slug) return;

    let ignore = false;

    (async () => {
      try {
        // Load main product
        const { data } = await axios.get(`/api/v1/product/get-product/${slug}`);
        if (ignore) return;

        const prod = data?.product ?? {};
        setProduct(prod);

        // Load related only if both IDs exist
        const pid = prod?._id;
        const cid = prod?.category?._id;
        if (pid && cid) {
          const rel = await axios.get(
            `/api/v1/product/related-product/${pid}/${cid}`
          );
          if (ignore) return;
          setRelatedProducts(
            Array.isArray(rel?.data?.products) ? rel.data.products : []
          );
        } else {
          setRelatedProducts([]);
        }
      } catch (e) {
        if (!ignore) {
          // Keep UI stable if anything fails
          setRelatedProducts([]);
        }
        // optional: console.log(e);
      }
    })();

    return () => {
      // Cancel state updates if slug changes/unmounts
      ignore = true;
    };
  }, [params?.slug]);

  return (
    <Layout data-testid="layout">
      <div className="row container product-details">
        <div className="col-md-6">
          <img
            src={product?._id ? `/api/v1/product/product-photo/${product._id}` : ""}
            className="card-img-top"
            alt={product?.name ?? ""}
            height="300"
            width={"350px"}
          />
        </div>

        <div className="col-md-6 product-details-info">
          {product?._id ? (
            <>
              <h1 className="text-center">Product Details</h1>
              <hr />
              <h6>Name : {product?.name ?? ""}</h6>
              <h6>Description : {product?.description ?? ""}</h6>
              <h6>
                Price :
                {typeof product?.price === "number"
                  ? product.price.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })
                  : ""}
              </h6>
              <h6>Category : {product?.category?.name ?? ""}</h6>
              <button className="btn btn-secondary ms-1">ADD TO CART</button>
            </>
          ) : (
            // render nothing or a lightweight placeholder while loading
            <div aria-label="loading-product" />
          )}
        </div>
      </div>

      <hr />

      <div className="row container similar-products">
        <h4>Similar Products ➡️</h4>
        {(!relatedProducts || relatedProducts.length < 1) && (
          <p className="text-center">No Similar Products found</p>
        )}
        <div className="d-flex flex-wrap">
          {relatedProducts?.map((p, i) => (
            <div className="card m-2" key={p?._id ?? p?.slug ?? `rel-${i}`}>
              <img
                src={p?._id ? `/api/v1/product/product-photo/${p._id}` : ""}
                className="card-img-top"
                alt={p?.name ?? ""}
              />
              <div className="card-body">
                <div className="card-name-price">
                  <h5 className="card-title">{p?.name ?? ""}</h5>
                  <h5 className="card-title card-price">
                    {typeof p?.price === "number"
                      ? p.price.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })
                      : "—"}
                  </h5>
                </div>
                <p className="card-text ">
                  {(p?.description ?? "").substring(0, 60)}...
                </p>
                <div className="card-name-price">
                  <button
                    className="btn btn-info ms-1"
                    onClick={() => navigate(`/product/${p?.slug}`)}
                  >
                    More Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default ProductDetails;
