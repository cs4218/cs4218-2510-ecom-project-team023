import React, { useState, useContext, createContext } from "react";

const SearchContext = createContext();
const SearchProvider = ({ children }) => {
  const [searchValues, setSearchValues] = useState({
    keyword: "",
    results: [],
  });

  return (
    <SearchContext.Provider value={[searchValues, setSearchValues]}>
      {children}
    </SearchContext.Provider>
  );
};

// custom hook
const useSearch = () => useContext(SearchContext);

export { useSearch, SearchProvider };