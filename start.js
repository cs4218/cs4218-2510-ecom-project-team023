import app from "./server.js";

const PORT = process.env.PORT || 6060;

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT} [NODE_ENV=${process.env.NODE_ENV}]`);
});
