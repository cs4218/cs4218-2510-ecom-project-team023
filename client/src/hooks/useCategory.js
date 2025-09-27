// src/hooks/useCategory.js
import { useState, useEffect } from "react";
import axios from "axios";

export default function useCategory() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let ignore = false; // prevents setState after unmount

    (async () => {
      try {
        const { data } = await axios.get("/api/v1/category/get-category");

        if (ignore) return;

        // Normalize: if payload missing/invalid, use []
        const list = Array.isArray(data?.category) ? data.category : [];
        setCategories(list);
      } catch (err) {
        if (ignore) return;
        // Also normalize on error
        setCategories([]);
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return categories; // always an array
}
