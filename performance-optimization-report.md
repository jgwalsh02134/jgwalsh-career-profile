# Performance Optimization Report - jgwalsh.com

## Executive Summary

This report analyzes the current performance bottlenecks in the jgwalsh.com website and provides actionable optimizations focusing on bundle size reduction, load time improvements, and general performance enhancements.

## Key Performance Issues Identified

### 1. **Large Inline JavaScript Libraries (Critical)**
- **Issue**: 4 HTML files contain ~4.4MB each of inline JavaScript (Plotly.js library)
- **Impact**: 17.6MB+ of redundant JavaScript across 4 files
- **Files affected**:
  - `interactive_neighborhood_treemap.html`
  - `interactive_crime_arrest_trends.html`
  - `case_resolution_sankey_2024.html`
  - `interactive_violent_crime_sunburst.html`

### 2. **No Asset Optimization**
- No minification of CSS/JS files
- No compression (gzip/brotli)
- No bundle splitting or code splitting
- No lazy loading implementation

### 3. **Missing Performance Best Practices**
- No caching headers configured
- External fonts loaded synchronously
- No preconnect/prefetch resource hints
- No image optimization

## Recommended Optimizations

### Priority 1: Extract and Optimize Plotly.js (Immediate Impact)

#### Current State:
```html
<!-- Each file contains full Plotly library inline -->
<script>(function(){var Plotly = ...})()</script>
```

#### Optimized Solution:

1. **Extract Plotly to external file**:
```html
<!-- Use CDN with integrity check -->
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" 
        integrity="sha384-..." 
        crossorigin="anonymous"></script>

<!-- Or self-host minified version -->
<script src="/assets/js/plotly.min.js"></script>
```

2. **Implement lazy loading for visualizations**:
```javascript
// Lazy load Plotly when visualization comes into view
const lazyLoadPlotly = () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadPlotlyAndRender(entry.target);
        observer.unobserve(entry.target);
      }
    });
  });
  
  document.querySelectorAll('.plotly-graph-div').forEach(el => {
    observer.observe(el);
  });
};
```

### Priority 2: Implement Build Process

Create a build process to optimize assets:

1. **Install build tools**:
```bash
npm init -y
npm install --save-dev webpack webpack-cli terser-webpack-plugin css-minimizer-webpack-plugin
npm install --save-dev html-webpack-plugin compression-webpack-plugin
```

2. **Create webpack.config.js**:
```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
          },
        },
      }),
      new CssMinimizerPlugin(),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        }
      }
    }
  },
  plugins: [
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    }),
    new CompressionPlugin({
      algorithm: 'brotliCompress',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
      filename: '[path][base].br'
    })
  ]
};
```

### Priority 3: Optimize Resource Loading

1. **Implement resource hints**:
```html
<head>
  <!-- Preconnect to external domains -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Preload critical resources -->
  <link rel="preload" href="/assets/css/style.css" as="style">
  <link rel="preload" href="/assets/js/script.js" as="script">
</head>
```

2. **Optimize font loading**:
```html
<!-- Current (blocking) -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Optimized (non-blocking with font-display) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
```

### Priority 4: Implement Caching Strategy

1. **Configure service worker for offline support**:
```javascript
// sw.js
const CACHE_NAME = 'jgwalsh-v1';
const urlsToCache = [
  '/',
  '/assets/css/style.css',
  '/assets/js/script.js',
  '/assets/js/plotly.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

2. **Add cache headers in Cloudflare Worker**:
```javascript
// cloudflare-worker/src/index.js
export default {
  async fetch(request, env, ctx) {
    const response = await fetch(request);
    const newResponse = new Response(response.body, response);
    
    // Add cache headers
    newResponse.headers.set('Cache-Control', 'public, max-age=3600');
    
    // Cache static assets for longer
    if (request.url.match(/\.(js|css|jpg|png|gif|svg|ico)$/)) {
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    
    return newResponse;
  },
};
```

### Priority 5: Code Optimization

1. **Minify CSS (current: 4.2KB → ~2.8KB)**:
```bash
# Install CSS minifier
npm install --save-dev cssnano postcss postcss-cli

# Create postcss.config.js
module.exports = {
  plugins: [
    require('cssnano')({
      preset: 'default',
    }),
  ],
};

# Minify CSS
postcss assets/css/style.css -o assets/css/style.min.css
```

2. **Optimize JavaScript loading**:
```javascript
// Convert script.js to use modern ES6 modules
// Before
document.addEventListener('DOMContentLoaded', () => {
  // Chart.js initialization
});

// After - with dynamic imports
const initChart = async () => {
  const { Chart } = await import('https://cdn.jsdelivr.net/npm/chart.js@4/+esm');
  const ctx = document.getElementById('project-chart')?.getContext('2d');
  if (ctx) {
    new Chart(ctx, { /* config */ });
  }
};

// Load only when needed
if (document.getElementById('project-chart')) {
  initChart();
}
```

## Performance Metrics Improvements

### Current Performance Estimates:
- Initial page load: ~18MB (with all visualizations)
- Time to Interactive: ~8-12 seconds on 3G
- Lighthouse Performance Score: ~25-35

### Expected Performance After Optimization:
- Initial page load: ~200KB (without visualizations)
- Lazy loaded visualizations: ~2.5MB per visualization
- Time to Interactive: ~2-3 seconds on 3G
- Lighthouse Performance Score: ~85-95

## Implementation Roadmap

### Phase 1 (Immediate - 1 day):
1. Extract Plotly.js from HTML files
2. Implement CDN loading for Plotly
3. Add basic resource hints

### Phase 2 (Short-term - 3 days):
1. Set up build process with Webpack
2. Implement CSS/JS minification
3. Add compression (gzip/brotli)

### Phase 3 (Medium-term - 1 week):
1. Implement lazy loading for visualizations
2. Add service worker for offline support
3. Optimize Cloudflare Worker caching

### Phase 4 (Long-term - 2 weeks):
1. Convert to modern build system (Vite/Parcel)
2. Implement progressive enhancement
3. Add performance monitoring

## Monitoring and Maintenance

1. **Set up performance monitoring**:
   - Google PageSpeed Insights API
   - Lighthouse CI
   - Web Vitals tracking

2. **Regular audits**:
   - Monthly Lighthouse audits
   - Bundle size tracking
   - User experience metrics

## Conclusion

The primary performance bottleneck is the 17.6MB+ of redundant inline JavaScript across visualization pages. By extracting Plotly.js and implementing lazy loading, we can achieve an immediate 88% reduction in initial page load size. Combined with build optimizations and caching strategies, the site can achieve excellent performance scores while maintaining all current functionality.

**Estimated total savings**: ~17.4MB (97% reduction)
**Estimated load time improvement**: 75% faster on average connections