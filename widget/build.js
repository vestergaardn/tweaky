const path = require("path")
const esbuild = require(require.resolve("esbuild", { paths: [path.join(__dirname, "..")] }))

esbuild.build({
  entryPoints: [path.join(__dirname, "src/index.js")],
  bundle: true,
  minify: true,
  outfile: path.join(__dirname, "../public/widget.js"),
  platform: "browser",
  target: ["es2020"],
  define: {
    "process.env.API_URL": JSON.stringify(
      process.env.API_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000")
    ),
  },
}).catch(() => process.exit(1))
