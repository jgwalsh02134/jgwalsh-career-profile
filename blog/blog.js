(function () {
  const FEED_MANIFEST_URL = '/blog/index.json';
  const FEED_FALLBACK_URL = '/data/blog/posts.json';
  const THUMB_FALLBACK = '/data/blog/thumbs/placeholder.svg';
  const DENSITY_OPTIONS = {
    comfortable: 9,
    cozy: 15,
    compact: 21,
  };

  const root = document.documentElement;
  root.classList.add('js-enabled');

  document.addEventListener('DOMContentLoaded', () => {
    updateYearStamps();
    const page = document.body.dataset.page;

    if (page === 'blog-index') {
      initIndexPage();
    } else if (page === 'blog-post') {
      initPostPage();
    }
  });

  function updateYearStamps() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = year;
    });
  }

  async function loadPosts() {
    try {
      const manifest = await fetchJson(FEED_MANIFEST_URL);
      if (manifest) {
        if (Array.isArray(manifest.posts)) {
          return { posts: manifest.posts, source: FEED_MANIFEST_URL };
        }
        if (Array.isArray(manifest.items)) {
          return { posts: manifest.items, source: FEED_MANIFEST_URL };
        }
        if (manifest.postsUrl) {
          const posts = await fetchJson(manifest.postsUrl);
          if (Array.isArray(posts)) {
            return { posts, source: manifest.postsUrl };
          }
        }
      }
    } catch (manifestError) {
      console.warn('Unable to load blog manifest:', manifestError);
    }

    try {
      const posts = await fetchJson(FEED_FALLBACK_URL);
      if (Array.isArray(posts)) {
        return { posts, source: FEED_FALLBACK_URL };
      }
    } catch (postsError) {
      console.error('Unable to load blog posts:', postsError);
    }

    return { posts: [], source: FEED_FALLBACK_URL };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) {
      throw new Error(`Request failed for ${url}: ${response.status}`);
    }
    return response.json();
  }

  function initIndexPage() {
    const fallbackList = document.querySelector('[data-fallback]');
    const grid = document.querySelector('[data-listing]');
    const tagBar = document.getElementById('tagBar');
    const pager = document.querySelector('[data-pager]');
    const prevBtn = pager?.querySelector('[data-prev]');
    const nextBtn = pager?.querySelector('[data-next]');
    const pageInfo = pager?.querySelector('[data-page-info]');
    const searchInput = document.getElementById('blog-search');
    const sortSelect = document.getElementById('blog-sort');
    const densitySelect = document.getElementById('blog-density');

    if (!grid || !searchInput || !sortSelect || !densitySelect) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    let activeTag = params.get('tag');
    let currentPage = parsePositiveInt(params.get('page')) || 1;
    let density = params.get('density');
    if (!Object.prototype.hasOwnProperty.call(DENSITY_OPTIONS, density)) {
      density = 'comfortable';
    }

    densitySelect.value = density;
    sortSelect.value = params.get('sort') || 'newest';
    searchInput.value = params.get('q') || '';

    let allPosts = [];

    document.addEventListener('keydown', (event) => {
      if (event.key === '/' && document.activeElement === document.body) {
        event.preventDefault();
        searchInput.focus();
      }
    });

    densitySelect.addEventListener('change', () => {
      density = densitySelect.value;
      currentPage = 1;
      persistState();
      render();
    });

    sortSelect.addEventListener('change', () => {
      currentPage = 1;
      persistState();
      render();
    });

    searchInput.addEventListener('input', () => {
      currentPage = 1;
      persistState();
      render();
    });

    prevBtn?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage -= 1;
        persistState();
        render();
      }
    });

    nextBtn?.addEventListener('click', () => {
      currentPage += 1;
      persistState();
      render();
    });

    loadPosts().then(({ posts }) => {
      if (!posts.length) {
        grid.hidden = false;
        grid.innerHTML = '<p class="post-card__meta">No posts available yet. Please check back soon.</p>';
        return;
      }

      allPosts = posts.map((post) => ({
        ...post,
        slug: post.slug || toSlug(post.title ?? ''),
      }));

      renderTags();
      render();

      if (fallbackList) {
        fallbackList.hidden = true;
        fallbackList.setAttribute('aria-hidden', 'true');
      }
    }).catch((error) => {
      console.error('Error rendering blog index:', error);
      if (grid) {
        grid.hidden = false;
        grid.innerHTML = '<p class="post-card__meta">Error loading posts. The static list is shown below.</p>';
      }
    });

    function render() {
      if (!allPosts.length) {
        return;
      }

      const searchTerm = searchInput.value.trim().toLowerCase();
      const sortValue = sortSelect.value;
      const pageSize = DENSITY_OPTIONS[density] || DENSITY_OPTIONS.comfortable;
      grid.dataset.density = density;

      let filtered = allPosts;

      if (activeTag) {
        filtered = filtered.filter((post) => Array.isArray(post.tags) && post.tags.includes(activeTag));
      }

      if (searchTerm) {
        filtered = filtered.filter((post) => {
          const values = [post.title, post.summary, (post.tags || []).join(' ')].filter(Boolean);
          return values.join(' ').toLowerCase().includes(searchTerm);
        });
      }

      filtered = filtered.slice().sort((a, b) => {
        if (sortValue === 'title') {
          return (a.title || '').localeCompare(b.title || '');
        }
        const aDate = a.date || '';
        const bDate = b.date || '';
        if (sortValue === 'oldest') {
          return aDate.localeCompare(bDate);
        }
        return bDate.localeCompare(aDate);
      });

      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(Math.max(1, currentPage), totalPages);
      const start = (currentPage - 1) * pageSize;
      const visible = filtered.slice(start, start + pageSize);

      grid.innerHTML = '';

      if (!visible.length) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'post-card__meta';
        emptyMessage.textContent = 'No posts match your filters.';
        grid.append(emptyMessage);
      } else {
        const fragment = document.createDocumentFragment();
        visible.forEach((post) => fragment.appendChild(buildCard(post)));
        grid.append(fragment);
      }

      grid.hidden = false;
      grid.setAttribute('aria-hidden', 'false');

      if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
      }
      if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
      }
      if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
      }

      if (pager) {
        const hidePager = totalPages <= 1;
        pager.style.display = hidePager ? 'none' : 'flex';
        pager.setAttribute('aria-hidden', hidePager ? 'true' : 'false');
      }
    }

    function renderTags() {
      if (!tagBar) {
        return;
      }

      const tags = new Set();
      allPosts.forEach((post) => {
        (post.tags || []).forEach((tag) => tags.add(tag));
      });

      const sortedTags = Array.from(tags).sort((a, b) => a.localeCompare(b));
      tagBar.innerHTML = '';

      const fragment = document.createDocumentFragment();
      const buttons = [];

      const allButton = createTagButton('All', null);
      buttons.push(allButton);
      fragment.appendChild(allButton);

      sortedTags.forEach((tag) => {
        const button = createTagButton(tag, tag);
        buttons.push(button);
        fragment.appendChild(button);
      });

      tagBar.append(fragment);
      updateTagStates();

      function createTagButton(label, value) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-button';
        button.textContent = label;
        button.addEventListener('click', () => {
          activeTag = value === activeTag ? null : value;
          currentPage = 1;
          updateTagStates();
          persistState();
          render();
        });
        return button;
      }

      function updateTagStates() {
        buttons.forEach((button) => {
          const value = button.textContent === 'All' ? null : button.textContent;
          const isActive = (value === null && activeTag == null) || value === activeTag;
          button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
      }
    }

    function persistState() {
      const newParams = new URLSearchParams();
      if (searchInput.value.trim()) {
        newParams.set('q', searchInput.value.trim());
      }
      if (sortSelect.value !== 'newest') {
        newParams.set('sort', sortSelect.value);
      }
      if (activeTag) {
        newParams.set('tag', activeTag);
      }
      if (density && density !== 'comfortable') {
        newParams.set('density', density);
      }
      if (currentPage > 1) {
        newParams.set('page', String(currentPage));
      }

      const query = newParams.toString();
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }
  }

  function initPostPage() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
      window.location.replace('/blog/');
      return;
    }

    const titleEl = document.getElementById('post-title');
    const metaEl = document.getElementById('post-meta');
    const heroFigure = document.getElementById('post-hero');
    const heroImage = document.getElementById('post-hero-image');
    const heroCaption = document.getElementById('post-hero-caption');
    const articleEl = document.getElementById('post-content');

    if (!titleEl || !metaEl || !articleEl) {
      return;
    }

    loadPosts().then(async ({ posts }) => {
      const post = posts.find((item) => (item.slug || toSlug(item.title ?? '')) === slug);

      if (!post) {
        articleEl.textContent = 'Post not found.';
        articleEl.removeAttribute('aria-busy');
        return;
      }

      titleEl.textContent = post.title || 'Untitled';
      document.title = `${titleEl.textContent} — jgwalsh.com`;

      const date = post.date ? new Date(`${post.date}T00:00:00`) : null;
      const metaBits = [];
      if (date && !Number.isNaN(date.getTime())) {
        const timeEl = document.createElement('time');
        timeEl.dateTime = post.date;
        timeEl.textContent = formatLongDate(date);
        metaBits.push(timeEl.outerHTML);
      }
      if (post.author) {
        metaBits.push(post.author);
      }
      if (post.readingTime || post.reading_time) {
        metaBits.push(post.readingTime || post.reading_time);
      }
      if (Array.isArray(post.tags) && post.tags.length) {
        const tags = post.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ');
        metaBits.push(tags);
      }
      metaEl.innerHTML = metaBits.join(' · ');

      const heroSource = post.hero || post.thumb;
      if (heroSource && heroImage && heroFigure) {
        heroImage.src = heroSource;
        heroImage.width = 1280;
        heroImage.height = 720;
        heroImage.loading = 'eager';
        heroImage.decoding = 'async';
        heroImage.alt = post.heroAlt || post.thumbAlt || `${titleEl.textContent} — hero image`;
        if (heroCaption) {
          heroCaption.textContent = post.heroAlt || '';
          heroCaption.hidden = !heroCaption.textContent;
        }
        heroFigure.hidden = false;
      }

      const bodyUrl = post.bodyUrl || `/data/blog/${encodeURIComponent(post.slug)}.html`;
      try {
        const response = await fetch(bodyUrl, { cache: 'no-store', credentials: 'omit' });
        if (!response.ok) {
          throw new Error(`Body not found: ${response.status}`);
        }
        const html = await response.text();
        articleEl.innerHTML = html;
      } catch (bodyError) {
        console.error('Unable to load post body:', bodyError);
        articleEl.textContent = 'Error loading post body.';
      } finally {
        articleEl.removeAttribute('aria-busy');
      }

      updateDocumentMeta(post, slug);
    }).catch((error) => {
      console.error('Unable to initialise post page:', error);
      articleEl.textContent = 'Error loading this article.';
      articleEl.removeAttribute('aria-busy');
    });
  }

  function buildCard(post) {
    const url = post.url || `/blog/post.html?slug=${encodeURIComponent(post.slug)}`;
    const thumb = post.thumb || THUMB_FALLBACK;

    const article = document.createElement('article');
    article.className = 'post-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'post-card__thumb';
    const img = document.createElement('img');
    img.src = thumb;
    img.width = 1280;
    img.height = 720;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = post.thumbAlt || `${post.title || 'Blog post'} — thumbnail`;
    thumbWrap.appendChild(img);

    const heading = document.createElement('h2');
    const link = document.createElement('a');
    link.href = url;
    link.textContent = post.title || 'Untitled';
    heading.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'post-card__meta';
    const metaBits = [];
    if (post.date) {
      const date = new Date(`${post.date}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        metaBits.push(formatShortDate(date));
      }
    }
    if (post.readingTime || post.reading_time) {
      metaBits.push(post.readingTime || post.reading_time);
    }
    if (post.author) {
      metaBits.push(post.author);
    }
    meta.textContent = metaBits.join(' · ');

    const summary = document.createElement('p');
    summary.className = 'post-card__summary';
    summary.textContent = post.summary || '';

    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'post-card__tags';
    if (Array.isArray(post.tags)) {
      post.tags.forEach((tag) => {
        const pill = document.createElement('span');
        pill.className = 'post-card__tag';
        pill.textContent = tag;
        tagsWrap.appendChild(pill);
      });
    }

    article.appendChild(thumbWrap);
    article.appendChild(heading);
    article.appendChild(meta);
    article.appendChild(summary);
    article.appendChild(tagsWrap);

    return article;
  }

  function updateDocumentMeta(post, slug) {
    const canonicalUrl = `https://jgwalsh.com/blog/post.html?slug=${encodeURIComponent(slug)}`;
    setMeta('#canonical', 'href', canonicalUrl);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[property="og:title"]', 'content', post.title || 'jgwalsh.com — Blog Post');
    setMeta('meta[name="twitter:title"]', 'content', post.title || 'jgwalsh.com — Blog Post');

    const description = post.summary || 'Behavioral insight and data analysis.';
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[name="twitter:description"]', 'content', description);

    const image = post.hero || post.thumb || THUMB_FALLBACK;
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[name="twitter:image"]', 'content', image);
  }

  function setMeta(selector, attribute, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.setAttribute(attribute, value);
    }
  }

  function formatShortDate(date) {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  function formatLongDate(date) {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    });
  }

  function parsePositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function toSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();

/* blog.js — progressive enhancement for blog */
