const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");

// Read propertyData.js and convert to a plain JS assignment for inline injection
const fs = require("fs");
const propertyDataRaw = fs.readFileSync(
  path.resolve(__dirname, "propertyData.js"),
  "utf8"
);
// Strip ES module export syntax → plain window variable
const propertyDataInline = propertyDataRaw.replace(
  /export\s+const\s+ALL_PROPERTIES\s*=/,
  "window.ALL_PROPERTIES ="
);

module.exports = {
  entry: "./index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "/fishers-house-search-2026/",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", ["@babel/preset-react", { runtime: "automatic" }]],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.GOOGLE_MAPS_API_KEY": JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || ""),
    }),
    // Main React app
    new HtmlWebpackPlugin({
      template: "./public/index.html",
    }),
    // Map app — injects property data inline at build time
    new HtmlWebpackPlugin({
      template: "./public/map/index.html",
      filename: "map/index.html",
      inject: false, // Don't inject bundle.js into the map page
      templateParameters: {
        propertyDataInline, // Passed to the template as <%= propertyDataInline %>
      },
    }),
  ],
};
