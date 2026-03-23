const path = require("path")
const esbuild = require(require.resolve("esbuild", { paths: [path.join(__dirname, "..")] }))

esbuild.build({
  entryPoints: [path.join(__dirname, "src/index.js")],
  bundle: true,
  minify: true,
  outfile: path.join(__dirname, "../public/widget.js"),
  platform: "browser",
  target: ["es2020"],
}).catch(() => process.exit(1))
