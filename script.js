/**
 * Fixed script.js — defensive version
 * - Ensures CART and WISHLIST are always arrays
 * - Guards against null/undefined before using .length or .includes
 * - All features intact: search, wishlist, cart drawer, toast, checkout
 */

(() => {
  "use strict";

  /* CONFIG */
  const SHOP_DOMAIN = "desak-sak.myshopify.com";
  const CART_KEY = "desak_desak_cart_v2";
  const WISHLIST_KEY = "desak_desak_wishlist_v2";
  const TOAST_DURATION = 2600;
  const DEBOUNCE_MS = 160;

  /* UTILITIES */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const safeJSON = (s, fallback) => { try { return JSON.parse(s); } catch (e) { return fallback; } };
  const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("ls fail", e); } };
  const loadJSON = (k, fallback) => {
    const raw = localStorage.getItem(k);
    if (raw === null || raw === undefined) return fallback;
    return safeJSON(raw, fallback);
  };
  const escapeHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const formatINR = (n) => {
    if (isNaN(n)) return "₹0";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return "₹" + Math.round(n);
    }
  };

  /* PRODUCTS (example static catalog) */
  const PRODUCTS = [
    { id: "101", title: "Unisex Hoodie", price: 1099, image: "https://desak-sak.myshopify.com/cdn/shop/files/Back_2_c_10_584ee972-23d2-4339-b7af-61cba4019ebb.jpg?v=1763120934&width=832", url: "https://desak-sak.myshopify.com/products/unisex-hoodie-5?variant=58376455094353", shopify: "" },
    { id: "102", title: "Oslo Grey Hoodie", price: 1399, image: "https://via.placeholder.com/800x1000?text=Oslo+Grey+Hoodie", url: "https://desak-sak.myshopify.com/products/oslo-grey-hoodie", shopify: "" },
    { id: "103", title: "Arctic White Hoodie", price: 1499, image: "https://via.placeholder.com/800x1000?text=Arctic+White+Hoodie", url: "https://desak-sak.myshopify.com/products/arctic-white-hoodie", shopify: "" },
    { id: "201", title: "Classic Grey Hoodie", price: 1299, image: "https://via.placeholder.com/800x1000?text=Classic+Grey+Hoodie", url: "https://desak-sak.myshopify.com/products/classic-grey-hoodie", shopify: "" },
    { id: "202", title: "Beige Fleece Hoodie", price: 2499, image: "https://via.placeholder.com/800x1000?text=Beige+Fleece+Hoodie", url: "https://desak-sak.myshopify.com/products/beige-fleece-hoodie", shopify: "" },
    { id: "203", title: "Black Oversized Hoodie", price: 2199, image: "https://via.placeholder.com/800x1000?text=Black+Oversized+Hoodie", url: "https://desak-sak.myshopify.com/products/black-oversized-hoodie", shopify: "" },
    { id: "204", title: "Urban Zip Hoodie", price: 1899, image: "https://via.placeholder.com/800x1000?text=Urban+Zip+Hoodie", url: "https://desak-sak.myshopify.com/products/urban-zip-hoodie", shopify: "" },
    { id: "301", title: "Milan Beige Sweatshirt", price: 999, image: "https://via.placeholder.com/800x1000?text=Milan+Beige+Sweatshirt", url: "https://desak-sak.myshopify.com/products/milan-beige-sweatshirt", shopify: "" },
    { id: "302", title: "Harbor Navy Sweatshirt", price: 1099, image: "https://via.placeholder.com/800x1000?text=Harbor+Navy+Sweatshirt", url: "https://desak-sak.myshopify.com/products/harbor-navy-sweatshirt", shopify: "" },
    { id: "401", title: "Arctic Wool Scarf", price: 699, image: "https://via.placeholder.com/800x1000?text=Arctic+Wool+Scarf", url: "https://desak-sak.myshopify.com/products/arctic-wool-scarf", shopify: "" },
    { id: "402", title: "Nordic Winter Scarf", price: 799, image: "https://via.placeholder.com/800x1000?text=Nordic+Winter+Scarf", url: "https://desak-sak.myshopify.com/products/nordic-winter-scarf", shopify: "" }
  ];

  /* STATE (load defensively) */
  let PRODUCTS_INDEX = {};
  let CART = loadJSON(CART_KEY, []);
  if (!Array.isArray(CART)) CART = [];
  let WISHLIST = loadJSON(WISHLIST_KEY, []);
  if (!Array.isArray(WISHLIST)) WISHLIST = [];

  /* DOM refs container */
  const DOM = {};
  let searchTimer = null, toastTimer = null;

  /* Build products index merging DOM data-* and PRODUCTS */
  function buildProductsIndex() {
    PRODUCTS_INDEX = {};
    PRODUCTS.forEach(p => PRODUCTS_INDEX[String(p.id)] = { ...p });
    $$(".product-card").forEach(card => {
      const id = card.getAttribute("data-id") || card.dataset.id;
      if (!id) return;
      const title = card.getAttribute("data-title") || card.dataset.title || ($(".product-title", card)?.innerText || "");
      const priceRaw = card.getAttribute("data-price") || card.dataset.price || ($(".product-price", card)?.innerText || "").replace(/[^\d]/g, "");
      const link = card.getAttribute("data-link") || card.dataset.link || "";
      const shopify = card.getAttribute("data-shopify") || card.dataset.shopify || card.getAttribute("data-variant") || card.dataset.variant || "";
      const img = $("img", card)?.getAttribute("src") || "";
      const existing = PRODUCTS_INDEX[String(id)] || { id: String(id) };
      existing.title = existing.title || title || `Product ${id}`;
      existing.price = Number(existing.price || priceRaw || 0);
      existing.image = existing.image || img;
      existing.url = existing.url || link;
      existing.shopify = existing.shopify || shopify || "";
      PRODUCTS_INDEX[String(id)] = existing;
    });
  }

  /* Render products into predefined grids */
  function renderProductsToGrids() {
    const mapping = {
      featuredGrid: ["101", "102", "103", "201"],
      hoodiesGrid: ["201", "202", "203", "204"],
      sweatshirtsGrid: ["301", "302"],
      scarvesGrid: ["401", "402"]
    };
    Object.keys(mapping).forEach(gridId => {
      const container = document.getElementById(gridId);
      if (!container) return;
      container.innerHTML = "";
      mapping[gridId].forEach(pid => {
        const p = PRODUCTS_INDEX[String(pid)];
        if (!p) return;
        const article = document.createElement("article");
        article.className = "product-card card-appear";
        article.setAttribute("role", "listitem");
        article.setAttribute("data-id", String(p.id));
        article.setAttribute("data-price", String(p.price));
        article.setAttribute("data-title", p.title);
        if (p.url) article.setAttribute("data-link", p.url);
        if (p.shopify) article.setAttribute("data-shopify", String(p.shopify));
        article.innerHTML = `
          <div class="product-media">
            <img class="product-image" loading="lazy" alt="${escapeHtml(p.title)}" src="${escapeHtml(p.image)}">
            <button class="wish-heart" aria-label="Add to wishlist">♡</button>
            <div class="meta-strip">
              <div class="product-badge">DESAK</div>
              <div class="product-price-small">${formatINR(p.price)}</div>
            </div>
          </div>
          <div class="product-body">
            <div class="product-title">${escapeHtml(p.title)}</div>
            <div class="product-price">${formatINR(p.price)}</div>
            <div class="product-actions"><button class="btn-cart" data-id="${escapeHtml(p.id)}">Cart 👜</button></div>
          </div>
        `;
        container.appendChild(article);
      });
    });
  }

  /* WISHLIST helpers (defensive) */
  function saveWishlist() { try { saveJSON(WISHLIST_KEY, Array.isArray(WISHLIST) ? WISHLIST : []); } catch(e){} }
  function isWishlisted(id) { if (!Array.isArray(WISHLIST)) return false; return WISHLIST.includes(String(id)); }
  function toggleWishlist(id) {
    id = String(id);
    if (!Array.isArray(WISHLIST)) WISHLIST = [];
    if (isWishlisted(id)) WISHLIST = WISHLIST.filter(x => String(x) !== id);
    else WISHLIST.push(id);
    saveWishlist();
    updateHeartUI(id);
    renderWishlistDrawer();
  }
  function updateHeartUI(id) {
    $$(".product-card").forEach(card => {
      const cid = card.getAttribute("data-id") || card.dataset.id;
      if (!cid) return;
      if (String(cid) !== String(id)) return;
      const heart = card.querySelector(".wish-heart");
      if (!heart) return;
      if (isWishlisted(id)) { heart.classList.add("active"); heart.innerText = "♥"; }
      else { heart.classList.remove("active"); heart.innerText = "♡"; }
    });
  }
  function renderWishlistDrawer() {
    const container = DOM.wishlistItems;
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(WISHLIST) || WISHLIST.length === 0) {
      container.innerHTML = `<p class="muted">No items in wishlist.</p>`;
      return;
    }
    WISHLIST.forEach(id => {
      const p = PRODUCTS_INDEX[String(id)];
      if (!p) return;
      const el = document.createElement("div");
      el.className = "drawer-item";
      el.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px">
          <div>
            <div style="font-weight:700">${escapeHtml(p.title)}</div>
            <div style="color:var(--muted);margin-top:6px">${formatINR(p.price)}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
          <button class="btn-small add-from-wishlist" data-id="${escapeHtml(p.id)}">Add to Cart</button>
          <button class="btn-small remove-from-wishlist" data-id="${escapeHtml(p.id)}">Remove</button>
        </div>
      `;
      container.appendChild(el);
    });
  }

  /* CART helpers (defensive) */
  function saveCart() { try { saveJSON(CART_KEY, Array.isArray(CART) ? CART : []); } catch(e){} }
  function findCartItem(id) { if (!Array.isArray(CART)) return undefined; return CART.find(it => String(it.id) === String(id)); }
  function addToCart(id, qty = 1, showToast = true) {
    id = String(id);
    if (!Array.isArray(CART)) CART = [];
    const p = PRODUCTS_INDEX[String(id)];
    if (!p) { console.warn("Product not found:", id); return; }
    const existing = findCartItem(id);
    if (existing) existing.qty = Number(existing.qty) + Number(qty);
    else CART.push({ id: id, title: p.title, price: Number(p.price || 0), qty: Number(qty || 1), img: p.image || "", variant: p.shopify || "" });
    saveCart();
    renderCartDrawer();
    updateCartCount();
    if (showToast) showAddedToast(p);
  }
  function removeCartItem(id) {
    if (!Array.isArray(CART)) CART = [];
    CART = CART.filter(it => String(it.id) !== String(id));
    saveCart();
    renderCartDrawer();
    updateCartCount();
  }
  function changeCartQty(id, delta) {
    if (!Array.isArray(CART)) CART = [];
    const i = CART.findIndex(it => String(it.id) === String(id));
    if (i === -1) return;
    CART[i].qty = Number(CART[i].qty) + Number(delta);
    if (CART[i].qty <= 0) CART.splice(i, 1);
    saveCart();
    renderCartDrawer();
    updateCartCount();
  }
  function clearCart() {
    if (!confirm("Remove all items from cart?")) return;
    CART = [];
    saveCart();
    renderCartDrawer();
    updateCartCount();
  }

  function renderCartDrawer() {
    const container = DOM.cartItems;
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(CART) || CART.length === 0) {
      container.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      if (DOM.cartSubtotal) DOM.cartSubtotal.innerText = "0";
      return;
    }
    let subtotal = 0;
    CART.forEach(item => {
      subtotal += Number(item.price || 0) * Number(item.qty || 0);
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px">
          <div style="min-width:160px">
            <div style="font-weight:800">${escapeHtml(item.title)}</div>
            <div style="color:var(--muted);margin-top:6px">${formatINR(item.price)} x ${item.qty}</div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn-small cart-dec" data-id="${escapeHtml(item.id)}">-</button>
              <button class="btn-small cart-inc" data-id="${escapeHtml(item.id)}">+</button>
              <button class="btn-small cart-remove" data-id="${escapeHtml(item.id)}">Remove</button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(row);
    });
    if (DOM.cartSubtotal) DOM.cartSubtotal.innerText = subtotal;
  }

  function updateCartCount() {
    const badge = DOM.cartCount || $("#cart-count");
    if (!badge) return;
    const total = Array.isArray(CART) ? CART.reduce((s, it) => s + Number(it.qty || 0), 0) : 0;
    if (total > 0) { badge.style.display = "inline-block"; badge.innerText = total; }
    else { badge.style.display = "none"; }
  }

  /* TOAST (defensive) */
  function showAddedToast(product) {
    const toast = DOM.toast;
    if (!toast) return;
    const msg = DOM.toastMessage || $("#toastMessage");
    if (msg) msg.innerText = `Added — ${product.title}`;
    toast.classList.add("show");
    toast.setAttribute("aria-hidden", "false");
    if (DOM.toastView) DOM.toastView.onclick = (ev) => { ev.preventDefault(); openCartDrawer(); hideToast(); };
    if (DOM.toastClose) DOM.toastClose.onclick = (ev) => { ev.preventDefault(); hideToast(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_DURATION);
  }
  function hideToast() {
    if (!DOM.toast) return;
    DOM.toast.classList.remove("show");
    DOM.toast.setAttribute("aria-hidden", "true");
    clearTimeout(toastTimer);
  }

  /* SEARCH */
  function openSearchOverlay() {
    if (!DOM.searchOverlay) return;
    DOM.searchOverlay.classList.add("active");
    DOM.searchOverlay.setAttribute("aria-hidden", "false");
    DOM.searchInput && DOM.searchInput.focus();
  }
  function closeSearchOverlay() {
    if (!DOM.searchOverlay) return;
    DOM.searchOverlay.classList.remove("active");
    DOM.searchOverlay.setAttribute("aria-hidden", "true");
    if (DOM.searchInput) {
      DOM.searchInput.value = "";
      renderSearchResults("", "");
    }
  }
  function mapSort(val) {
    if (!val) return "";
    const map = { "price-asc": "price-asc", "price-desc": "price-desc", "title-asc": "title-asc", "title-desc": "title-desc" };
    return map[val] || "";
  }
  function renderSearchResults(query = "", sort = "") {
    const container = DOM.searchResults;
    if (!container) return;
    const q = (query || "").trim().toLowerCase();
    const all = Object.values(PRODUCTS_INDEX || {});
    let filtered = all.filter(p => {
      if (!p) return false;
      if (!q) return true;
      const combined = (p.title + " " + (p.tags || "")).toLowerCase();
      return (combined || "").includes(q);
    });
    const s = mapSort(sort);
    if (s === "price-asc") filtered.sort((a, b) => a.price - b.price);
    if (s === "price-desc") filtered.sort((a, b) => b.price - a.price);
    if (s === "title-asc") filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (s === "title-desc") filtered.sort((a, b) => b.title.localeCompare(a.title));
    container.innerHTML = "";
    if (!filtered.length) { container.innerHTML = `<div class="search-hint muted">No products found.</div>`; return; }
    const wrap = document.createElement("div"); wrap.className = "search-list";
    filtered.forEach(p => {
      const a = document.createElement("a"); a.href = p.url || "#"; a.className = "search-item";
      a.innerHTML = `<div class="search-thumb"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px"></div>
                     <div class="search-meta"><div class="search-title" style="font-weight:700">${escapeHtml(p.title)}</div>
                     <div class="search-price" style="color:var(--muted);font-size:13px;margin-top:6px">${formatINR(p.price)}</div></div>`;
      a.addEventListener("click", ev => { ev.preventDefault(); if (p.url && p.url !== "#") window.open(p.url, "_blank"); closeSearchOverlay(); });
      wrap.appendChild(a);
    });
    container.appendChild(wrap);
  }

  /* SHOPIFY CHECKOUT URL builder (defensive) */
  function buildShopifyCheckoutURL() {
    if (!Array.isArray(CART) || CART.length === 0) return "";
    const pairs = [];
    CART.forEach(ci => {
      const variant = ci.variant || (PRODUCTS_INDEX[ci.id] && PRODUCTS_INDEX[ci.id].shopify) || "";
      if (variant && String(variant).trim()) pairs.push(`${variant}:${ci.qty}`);
    });
    if (pairs.length) return `https://${SHOP_DOMAIN}/cart/${pairs.join(",")}`;
    return `https://${SHOP_DOMAIN}`;
  }
  function proceedToCheckout() {
    if (!Array.isArray(CART) || CART.length === 0) { alert("Your cart is empty."); return; }
    const url = buildShopifyCheckoutURL();
    if (url.includes("/cart/")) { window.location.href = url; return; }
    const summary = CART.map(i => `${i.title} x ${i.qty} — ₹${i.price}`).join("\n");
    try { navigator.clipboard.writeText(summary); } catch (e) {}
    if (!confirm("Shopify variant IDs are not configured. A summary has been copied to clipboard. Continue to store homepage?")) return;
    window.location.href = `https://${SHOP_DOMAIN}`;
  }

  /* DRAWERS open/close helpers */
  function openCartDrawer() { if (!DOM.cartDrawer) return; DOM.cartDrawer.classList.add("open"); DOM.cartDrawer.setAttribute("aria-hidden", "false"); renderCartDrawer(); }
  function closeCartDrawer() { if (!DOM.cartDrawer) return; DOM.cartDrawer.classList.remove("open"); DOM.cartDrawer.setAttribute("aria-hidden", "true"); }
  function openWishlistDrawer() { if (!DOM.wishlistDrawer) return; DOM.wishlistDrawer.classList.add("open"); DOM.wishlistDrawer.setAttribute("aria-hidden", "false"); renderWishlistDrawer(); }
  function closeWishlistDrawer() { if (!DOM.wishlistDrawer) return; DOM.wishlistDrawer.classList.remove("open"); DOM.wishlistDrawer.setAttribute("aria-hidden", "true"); }

  /* SYNC UI of product-cards */
  function syncProductCardsUI() {
    $$(".product-card").forEach(card => {
      const id = card.getAttribute("data-id") || card.dataset.id;
      if (!id) return;
      const p = PRODUCTS_INDEX[String(id)] || {};
      const img = card.querySelector(".product-image");
      if (img && (!img.getAttribute("src") || img.getAttribute("src").includes("placeholder"))) { if (p && p.image) img.src = p.image; }
      const titleEl = card.querySelector(".product-title");
      if (titleEl && (!titleEl.innerText || titleEl.innerText.trim() === "")) titleEl.innerText = p.title || titleEl.innerText;
      const priceEl = card.querySelector(".product-price");
      if (priceEl && (!priceEl.innerText || priceEl.innerText.trim() === "")) priceEl.innerText = p.price ? formatINR(p.price) : priceEl.innerText;
      const heart = card.querySelector(".wish-heart");
      if (heart) { heart.innerText = isWishlisted(id) ? "♥" : "♡"; heart.classList.toggle("active", isWishlisted(id)); }
      if (img) { img.style.cursor = "pointer"; img.onclick = () => { const link = card.getAttribute("data-link") || card.dataset.link || (p && p.url) || "#"; if (link && link !== "#") window.open(link, "_blank"); }; }
      const cartBtn = card.querySelector(".btn-cart"); if (cartBtn && !cartBtn.getAttribute("data-id")) cartBtn.setAttribute("data-id", String(id));
    });
  }

  /* INITIAL render & bindings */
  function renderInitial() {
    buildProductsIndex();
    renderProductsToGrids();
    buildProductsIndex();
    syncProductCardsUI();
    renderWishlistDrawer();
    renderCartDrawer();
    updateCartCount();
  }

  function renderProductsToGrids() {
    const mapping = {
      featuredGrid: ["101", "102", "103", "201"],
      hoodiesGrid: ["201", "202", "203", "204"],
      sweatshirtsGrid: ["301", "302"],
      scarvesGrid: ["401", "402"]
    };
    Object.keys(mapping).forEach(gridId => {
      const container = document.getElementById(gridId);
      if (!container) return;
      container.innerHTML = "";
      mapping[gridId].forEach(pid => {
        const p = PRODUCTS_INDEX[String(pid)];
        if (!p) return;
        const article = document.createElement("article");
        article.className = "product-card card-appear";
        article.setAttribute("role", "listitem");
        article.setAttribute("data-id", String(p.id));
        article.setAttribute("data-price", String(p.price));
        article.setAttribute("data-title", p.title);
        if (p.url) article.setAttribute("data-link", p.url);
        if (p.shopify) article.setAttribute("data-shopify", String(p.shopify));
        article.innerHTML = `
          <div class="product-media">
            <img class="product-image" loading="lazy" alt="${escapeHtml(p.title)}" src="${escapeHtml(p.image)}">
            <button class="wish-heart" aria-label="Add to wishlist">♡</button>
            <div class="meta-strip">
              <div class="product-badge">DESAK</div>
              <div class="product-price-small">${formatINR(p.price)}</div>
            </div>
          </div>
          <div class="product-body">
            <div class="product-title">${escapeHtml(p.title)}</div>
            <div class="product-price">${formatINR(p.price)}</div>
            <div class="product-actions"><button class="btn-cart" data-id="${escapeHtml(p.id)}">Cart 👜</button></div>
          </div>
        `;
        container.appendChild(article);
      });
    });
  }

  /* BIND EVENTS (delegation & safe) */
  function bindEvents() {
    DOM.searchToggle = $("#search-toggle");
    DOM.searchOverlay = $("#searchOverlay");
    DOM.searchInput = $("#searchInput");
    DOM.searchSort = $("#searchSort");
    DOM.searchClose = $("#searchClose");
    DOM.searchResults = $("#searchResults");

    DOM.cartToggle = $("#cart-toggle");
    DOM.cartCount = $("#cart-count");
    DOM.cartDrawer = $("#cartDrawer");
    DOM.cartItems = $("#cartItems");
    DOM.cartSubtotal = $("#cartSubtotal");
    DOM.checkoutNow = $("#checkoutNow");
    DOM.clearCart = $("#clearCart");
    DOM.closeCart = $("#closeCart");

    DOM.wishlistToggle = $("#wishlist-toggle");
    DOM.wishlistDrawer = $("#wishlistDrawer");
    DOM.wishlistItems = $("#wishlistItems");
    DOM.closeWishlist = $("#closeWishlist");

    DOM.toast = $("#addedToast");
    DOM.toastMessage = $("#toastMessage");
    DOM.toastView = $("#toastViewCart");
    DOM.toastClose = $("#toastClose");

    DOM.searchToggle && DOM.searchToggle.addEventListener("click", (ev) => { ev.preventDefault(); openSearchOverlay(); });
    DOM.searchClose && DOM.searchClose.addEventListener("click", (ev) => { ev.preventDefault(); closeSearchOverlay(); });
    if (DOM.searchOverlay) DOM.searchOverlay.addEventListener("click", (ev) => { if (ev.target === DOM.searchOverlay) closeSearchOverlay(); });

    if (DOM.searchInput) {
      DOM.searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => renderSearchResults(DOM.searchInput.value, DOM.searchSort ? DOM.searchSort.value : ""), DEBOUNCE_MS);
      });
    }
    if (DOM.searchSort) DOM.searchSort.addEventListener("change", () => renderSearchResults(DOM.searchInput ? DOM.searchInput.value : "", DOM.searchSort.value));

    DOM.cartToggle && DOM.cartToggle.addEventListener("click", (ev) => { ev.preventDefault(); openCartDrawer(); });
    DOM.wishlistToggle && DOM.wishlistToggle.addEventListener("click", (ev) => { ev.preventDefault(); openWishlistDrawer(); });

    DOM.closeCart && DOM.closeCart.addEventListener("click", (ev) => { ev.preventDefault(); closeCartDrawer(); });
    DOM.checkoutNow && DOM.checkoutNow.addEventListener("click", (ev) => { ev.preventDefault(); proceedToCheckout(); });
    DOM.clearCart && DOM.clearCart.addEventListener("click", (ev) => { ev.preventDefault(); clearCart(); });

    DOM.closeWishlist && DOM.closeWishlist.addEventListener("click", (ev) => { ev.preventDefault(); closeWishlistDrawer(); });

    document.body.addEventListener("click", (ev) => {
      const heart = ev.target.closest ? ev.target.closest(".wish-heart") : null;
      if (heart) {
        ev.preventDefault();
        const card = heart.closest(".product-card");
        if (!card) return;
        const id = card.getAttribute("data-id") || card.dataset.id;
        if (!id) return;
        toggleWishlist(id);
        return;
      }
      const cartBtn = ev.target.closest ? ev.target.closest(".btn-cart") : null;
      if (cartBtn) {
        ev.preventDefault();
        let id = cartBtn.getAttribute("data-id") || cartBtn.dataset.id;
        if (!id) {
          const card = cartBtn.closest(".product-card");
          id = card ? (card.getAttribute("data-id") || card.dataset.id) : null;
        }
        if (!id) { console.warn("Cart button clicked but no id"); return; }
        addToCart(id, 1, true);
        return;
      }
    });

    DOM.cartItems && DOM.cartItems.addEventListener("click", (ev) => {
      const dec = ev.target.closest ? ev.target.closest(".cart-dec") : null;
      const inc = ev.target.closest ? ev.target.closest(".cart-inc") : null;
      const rem = ev.target.closest ? ev.target.closest(".cart-remove") : null;
      if (dec) { const id = dec.dataset.id || dec.getAttribute("data-id"); changeCartQty(id, -1); }
      else if (inc) { const id = inc.dataset.id || inc.getAttribute("data-id"); changeCartQty(id, +1); }
      else if (rem) { const id = rem.dataset.id || rem.getAttribute("data-id"); if (confirm("Remove this item?")) removeCartItem(id); }
    });

    DOM.wishlistItems && DOM.wishlistItems.addEventListener("click", (ev) => {
      const add = ev.target.closest ? ev.target.closest(".add-from-wishlist") : null;
      const rem = ev.target.closest ? ev.target.closest(".remove-from-wishlist") : null;
      if (add) {
        const id = add.dataset.id || add.getAttribute("data-id");
        if (id) { addToCart(id, 1, true); WISHLIST = WISHLIST.filter(x => String(x) !== String(id)); saveWishlist(); updateHeartUI(id); renderWishlistDrawer(); }
      }
      if (rem) {
        const id = rem.dataset.id || rem.getAttribute("data-id");
        if (id) { WISHLIST = WISHLIST.filter(x => String(x) !== String(id)); saveWishlist(); updateHeartUI(id); renderWishlistDrawer(); }
      }
    });

    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { closeSearchOverlay(); closeCartDrawer(); closeWishlistDrawer(); } });
  }

  /* RUN ON DOMContentLoaded */
  document.addEventListener("DOMContentLoaded", () => {
    buildProductsIndex();
    renderProductsToGrids();
    buildProductsIndex();
    syncProductCardsUI();

    // populate DOM refs
    DOM.searchToggle = $("#search-toggle");
    DOM.searchOverlay = $("#searchOverlay");
    DOM.searchInput = $("#searchInput");
    DOM.searchSort = $("#searchSort");
    DOM.searchClose = $("#searchClose");
    DOM.searchResults = $("#searchResults");

    DOM.cartToggle = $("#cart-toggle");
    DOM.cartCount = $("#cart-count");
    DOM.cartDrawer = $("#cartDrawer");
    DOM.cartItems = $("#cartItems");
    DOM.cartSubtotal = $("#cartSubtotal");
    DOM.checkoutNow = $("#checkoutNow");
    DOM.clearCart = $("#clearCart");
    DOM.closeCart = $("#closeCart");

    DOM.wishlistToggle = $("#wishlist-toggle");
    DOM.wishlistDrawer = $("#wishlistDrawer");
    DOM.wishlistItems = $("#wishlistItems");
    DOM.closeWishlist = $("#closeWishlist");

    DOM.toast = $("#addedToast");
    DOM.toastMessage = $("#toastMessage");
    DOM.toastView = $("#toastViewCart");
    DOM.toastClose = $("#toastClose");

    // render UI state
    renderWishlistDrawer();
    renderCartDrawer();
    updateCartCount();

    // set hearts initial state & ensure cart btns have ids
    $$(".product-card").forEach(card => {
      const id = card.getAttribute("data-id");
      if (!id) return;
      const heart = card.querySelector(".wish-heart");
      if (heart) { heart.innerText = isWishlisted(id) ? "♥" : "♡"; heart.classList.toggle("active", isWishlisted(id)); }
      const cartBtn = card.querySelector(".btn-cart");
      if (cartBtn && !cartBtn.getAttribute("data-id")) cartBtn.setAttribute("data-id", id);
    });

    bindEvents();
    console.info("DESAK script (defensive) initialized. CART length:", Array.isArray(CART) ? CART.length : "invalid", "WISHLIST length:", Array.isArray(WISHLIST) ? WISHLIST.length : "invalid");
  });

  /* Expose for debugging */
  window.DESAK = {
    PRODUCTS, PRODUCTS_INDEX,
    CART_REF: () => CART, WISHLIST_REF: () => WISHLIST,
    addToCart, removeCartItem, changeCartQty, toggleWishlist, proceedToCheckout, rebuild: () => { buildProductsIndex(); renderProductsToGrids(); buildProductsIndex(); syncProductCardsUI(); renderWishlistDrawer(); renderCartDrawer(); updateCartCount(); }
  };

  /* Helper re-defined near bottom for completeness */
  function renderCartDrawer() {
    const container = DOM.cartItems;
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(CART) || CART.length === 0) {
      container.innerHTML = `<p class="muted">Your cart is empty.</p>`;
      if (DOM.cartSubtotal) DOM.cartSubtotal.innerText = "0";
      return;
    }
    let subtotal = 0;
    CART.forEach(item => {
      subtotal += Number(item.price || 0) * Number(item.qty || 0);
      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start">
          <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" style="width:72px;height:72px;object-fit:cover;border-radius:8px">
          <div style="min-width:160px">
            <div style="font-weight:800">${escapeHtml(item.title)}</div>
            <div style="color:var(--muted);margin-top:6px">${formatINR(item.price)} x ${item.qty}</div>
            <div style="margin-top:10px;display:flex;gap:8px">
              <button class="btn-small cart-dec" data-id="${escapeHtml(item.id)}">-</button>
              <button class="btn-small cart-inc" data-id="${escapeHtml(item.id)}">+</button>
              <button class="btn-small cart-remove" data-id="${escapeHtml(item.id)}">Remove</button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(row);
    });
    if (DOM.cartSubtotal) DOM.cartSubtotal.innerText = subtotal;
  }

})();
