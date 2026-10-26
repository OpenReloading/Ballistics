const path = require('node:path')

// read by `webpackConfig` of .dependency-cruiser.cjs, the only place its resolver takes an alias from
module.exports = { resolve: { alias: { '@': path.resolve('apps/web/src') } } }
