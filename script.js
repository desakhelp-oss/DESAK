/* ======================================================
   DESAK — Interactive Functionality
   ====================================================== */

// ========== Scroll Animation for Section Headers ==========
document.querySelectorAll('.section-header').forEach(header => {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) header.classList.add('is-visible');
        });
    }, { threshold: 0.2 });
    observer.observe(header);
});

// ========== Cart Utility Functions ==========
function getCart() {
    return JSON.parse(localStorage.getItem('desakCart')) || [];
}
function saveCart(cart) {
    localStorage.setItem('desakCart', JSON.stringify(cart));
}

// ========== Add to Cart ==========
function addToCart(name, price) {
    const cart = getCart();
    const existing = cart.find(item => item.name === name);
    if (existing) existing.quantity++;
    else cart.push({ name, price: parseFloat(price), quantity: 1 });
    saveCart(cart);
    showCartToast(name);
    updateCartDisplay();
}

// ========== Remove from Cart ==========
function removeFromCart(name) {
    const cart = getCart().filter(i => i.name !== name);
    saveCart(cart);
    updateCartDisplay();
}

// ========== Update Quantity ==========
function updateQuantity(name, newQty) {
    const cart = getCart();
    const item = cart.find(i => i.name === name);
    if (!item) return;
    if (newQty <= 0) return removeFromCart(name);
    item.quantity = newQty;
    saveCart(cart);
    updateCartDisplay();
}

// ========== Update Cart Page ==========
function updateCartDisplay() {
    const cartList = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const emptyMsg = document.getElementById('empty-msg');
    if (!cartList) return; // only runs on cart.html

    const cart = getCart();
    cartList.innerHTML = '';
    if (cart.length === 0) {
        emptyMsg.style.display = 'block';
        cartTotal.textContent = '';
        return;
    }
    emptyMsg.style.display = 'none';

    let total = 0;
    cart.forEach(item => {
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
      <span>${item.name}</span>
      <span>₹${item.price.toFixed(2)}</span>
      <input type="number" min="1" value="${item.quantity}" data-name="${item.name}">
      <span>₹${(item.price * item.quantity).toFixed(2)}</span>
      <button class="remove-btn" data-name="${item.name}">✖</button>
    `;
        cartList.appendChild(li);
        total += item.price * item.quantity;
    });
    cartTotal.textContent = `Total: ₹${total.toFixed(2)}`;

    cartList.querySelectorAll('input[type="number"]').forEach(inp => {
        inp.addEventListener('change', e => {
            const name = e.target.dataset.name;
            const val = parseInt(e.target.value);
            if (!isNaN(val)) updateQuantity(name, val);
        });
    });

    cartList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', e => removeFromCart(btn.dataset.name));
    });
}

// ========== Toast Notification ==========
function showCartToast(name) {
    const toast = document.getElementById('cart-toast');
    toast.innerHTML = `✅ <strong>${name}</strong> added to cart — <a href="cart.html" style="color:#fff;text-decoration:underline;">View Cart</a>`;
    toast.classList.add('show');
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== Carousel Hover Slide ==========
document.addEventListener('DOMContentLoaded', () => {
    const carousels = document.querySelectorAll('.product-carousel');
    carousels.forEach(carousel => {
        let frameId = null, startTime = null, offset = 0;
        const duration = 9000; // full cycle in ms

        function animate(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime + offset) % duration;
            const progress = elapsed / duration;

            const positions = [0, -33.333, -66.666, -100, -133.333, -166.666, -200, -233.333, 0];
            const seg = Math.floor(progress * 8);
            const segProg = (progress * 8) - seg;
            const startPos = positions[seg];
            const endPos = positions[(seg + 1) % positions.length];
            const translate = startPos + (endPos - startPos) * segProg;
            carousel.style.transform = `translateX(${translate}%)`;
            frameId = requestAnimationFrame(animate);
        }

        function startAnim() {
            if (!frameId) {
                startTime = null;
                frameId = requestAnimationFrame(animate);
            }
        }

        function stopAnim() {
            if (frameId) {
                cancelAnimationFrame(frameId);
                frameId = null;
                offset = (performance.now() - (startTime || 0) + offset) % duration;
            }
        }

        // only image hover triggers animation
        carousel.querySelectorAll('.product-img').forEach(img => {
            img.addEventListener('mouseenter', startAnim);
            img.addEventListener('mouseleave', stopAnim);
        });
    });

    // Hook up Add to Cart buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const name = btn.dataset.name;
            const price = btn.dataset.price;
            addToCart(name, price);
        });
    });

    // Checkout button behavior
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            const cart = getCart();
            if (cart.length === 0) return alert('Your cart is empty!');
            alert('Thank you for your purchase! (Checkout coming soon)');
            localStorage.removeItem('desakCart');
            updateCartDisplay();
        });
    }

    updateCartDisplay();
    // ---- get DOM elements (single declaration only) ----
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const switchToSignup = document.getElementById('switch-to-signup');
    const switchToLogin = document.getElementById('switch-to-login');
    const accountLink = document.getElementById('account-link');
    const profilePic = document.getElementById('profile-pic');
    const username = document.getElementById('username');

    // ---- modal open/close ----
    window.onAuthStateChanged(auth, (user) => {
        const accountLink = document.getElementById("account-link");
        const profilePic = document.getElementById("profile-pic");
        const username = document.getElementById("username");

        if (!accountLink) return;

        if (user) {
            // Show profile name
            const name = user.displayName || user.email.split("@")[0];
            username.textContent = name;

            // Show profile photo if exists
            profilePic.src = user.photoURL || "https://www.silcharmunicipality.in/wp-content/uploads/2021/02/male-face.jpg";

            // 👉 If LOGGED IN — clicking name goes to ACCOUNT PAGE
            accountLink.onclick = (e) => {
                e.preventDefault();
                window.location.href = "account.html";   // 🔥 NEW DASHBOARD PAGE
            };

        } else {
            // User not logged in
            username.textContent = "";
            profilePic.src = "https://www.silcharmunicipality.in/wp-content/uploads/2021/02/male-face.jpg";

            // 👉 If NOT LOGGED IN — go to LOGIN PAGE
            accountLink.onclick = (e) => {
                e.preventDefault();
                window.location.href = "login.html";
            };
        }
    });


 



});
