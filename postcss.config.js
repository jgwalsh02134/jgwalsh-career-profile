module.exports = {
  plugins: [
    require('cssnano')({
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: false,
        colormin: true,
        minifyFontValues: true,
        minifySelectors: true,
        // Keep CSS custom properties (variables)
        cssDeclarationSorter: {
          exclude: true
        },
        // Optimize calc() expressions
        calc: true,
        // Convert colors to shorter forms
        colormin: true,
        // Merge adjacent rules
        mergeRules: true,
        // Merge duplicate selectors
        uniqueSelectors: true,
        // Remove empty rules
        discardEmpty: true,
        // Minimize font-weight values
        minifyFontValues: {
          removeQuotes: false
        }
      }]
    })
  ]
};