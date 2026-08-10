const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Custom backend server running on port ${PORT}`);
});
