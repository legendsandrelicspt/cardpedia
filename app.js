// Supabase client: the publishable key is intended for browser use.
// Data access is controlled by PostgreSQL Row Level Security (RLS).
const supabaseClient = (() => {
  const config = window.CARDPEDIA_SUPABASE_CONFIG;
  if (!config || !window.supabase?.createClient) {
    console.warn("Cardpedia: Supabase configuration or SDK is unavailable.");
    return null;
  }
  return window.supabase.createClient(config.url, config.publishableKey);
})();
window.cardpediaSupabase = supabaseClient;

async function verifySupabaseConnection() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("games")
    .select("id,name")
    .eq("is_active", true)
    .order("name");
  if (error) {
    console.error("Cardpedia: Supabase connection check failed.", error.message);
    return;
  }
  console.info(`Cardpedia: Supabase connected; ${data.length} active games available.`);
}
verifySupabaseConnection();

const initialListings = [
  { id: 1, name: "Umbreon VMAX — Alt Art", game: "Pokémon", category: "Pokémon", price: 289.9, condition: "NM", badge: "Collector's pick", seller: "rita.collects", rating: "★ 4.9", emoji: "☾", art: "art-pokemon", visual: "visual-violet", mode: "buy", note: "English · Evolving Skies" },
  { id: 2, name: "The One Ring — Showcase", game: "Magic", category: "Magic", price: 74.5, condition: "NM", badge: "Foil", seller: "mana_vault", rating: "★ 5.0", emoji: "◉", art: "art-magic", visual: "visual-gold", mode: "trade", note: "English · Tales of Middle-earth" },
  { id: 3, name: "Monkey D. Luffy — Manga Rare", game: "One Piece", category: "One Piece", price: 395, condition: "NM", badge: "Manga rare", seller: "pirateking.pt", rating: "★ 4.8", emoji: "☠", art: "art-pirate", visual: "visual-pink", mode: "buy", note: "Japanese · OP05" },
  { id: 4, name: "Blue-Eyes White Dragon", game: "Yu-Gi-Oh!", category: "Yu-Gi-Oh!", price: 48, condition: "LP", badge: "1st edition", seller: "duelist_den", rating: "★ 4.9", emoji: "♢", art: "art-dragon", visual: "visual-blue", mode: "both", note: "English · SDK-001" },
  { id: 5, name: "Gengar VMAX — Alt Art", game: "Pokémon", category: "Pokémon", price: 168, condition: "NM", badge: "Popular", seller: "eeveelutions", rating: "★ 5.0", emoji: "👾", art: "art-pokemon", visual: "visual-pink", mode: "trade", note: "English · Fusion Strike" },
  { id: 6, name: "Booster Box — Prismatic Evolutions", game: "Sealed", category: "Sealed", price: 139.9, condition: "sealed", badge: "Factory sealed", seller: "thepokecorner", rating: "★ 4.9", emoji: "✦", art: "art-sealed", visual: "visual-blue", mode: "buy", note: "Factory sealed · EN" },
  { id: 7, name: "Charizard ex — Special Illustration", game: "Pokémon", category: "Pokémon", price: 102.5, condition: "NM", badge: "Sleeved", seller: "cardboard.pt", rating: "★ 4.7", emoji: "🔥", art: "art-fire", visual: "visual-gold", mode: "both", note: "Portuguese · 223/197" },
  { id: 8, name: "Collector Booster — Tarkir", game: "Sealed", category: "Sealed", price: 31.9, condition: "sealed", badge: "New arrival", seller: "mtg_alfama", rating: "★ 5.0", emoji: "✧", art: "art-box", visual: "visual-violet", mode: "buy", note: "Factory sealed · EN" },
];

const state = {
  listings: [...initialListings],
  cart: new Map(),
  favorites: new Set(),
  category: "all",
  mode: "all",
  search: "",
  condition: "all",
  maxPrice: 500,
  sort: "featured",
  favoritesOnly: false,
};


const STORAGE_KEY = "cardpedia-prototype-v1";

function restoreSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || saved.version !== 1) return;

    if (Array.isArray(saved.listings)) {
      const validListings = saved.listings.filter((item) =>
        item && Number.isFinite(Number(item.id)) &&
        typeof item.name === "string" && typeof item.game === "string" &&
        Number.isFinite(Number(item.price)) && Number(item.price) >= 0
      );
      state.listings = validListings;
    }

    if (Array.isArray(saved.favorites)) {
      state.favorites = new Set(saved.favorites.map(Number).filter(Number.isFinite));
    }

    if (Array.isArray(saved.cart)) {
      state.cart = new Map();
      saved.cart.forEach(({ id, quantity }) => {
        const item = state.listings.find((listing) => Number(listing.id) === Number(id));
        const count = Math.floor(Number(quantity));
        if (item && count > 0) state.cart.set(item.id, { item, quantity: count });
      });
    }
  } catch {
    // If browser storage is unavailable or corrupted, keep the in-memory prototype usable.
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      listings: state.listings,
      favorites: [...state.favorites],
      cart: [...state.cart.values()].map(({ item, quantity }) => ({ id: item.id, quantity })),
    }));
  } catch {
    showToast("Browser storage is unavailable. Changes may not survive a refresh.");
  }
}

restoreSavedState();

const grid = document.querySelector("#product-grid");
const overlay = document.querySelector("#overlay");
const drawer = document.querySelector("#cart-drawer");
const modal = document.querySelector("#listing-modal");
const toast = document.querySelector("#toast");
let toastTimeout;

const euro = (amount) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);

function visibleListings() {
  let items = state.listings.filter((item) => {
    const matchesCategory = state.category === "all" || item.category === state.category;
    const matchesMode = state.mode === "all" || item.mode === state.mode || item.mode === "both";
    const matchesSearch = `${item.name} ${item.game} ${item.seller} ${item.note}`.toLocaleLowerCase("en-GB").includes(state.search.toLocaleLowerCase("en-GB"));
    const matchesCondition = state.condition === "all" || item.condition === state.condition;
    const matchesPrice = item.price <= state.maxPrice;
    const matchesFavorite = !state.favoritesOnly || state.favorites.has(item.id);
    return matchesCategory && matchesMode && matchesSearch && matchesCondition && matchesPrice && matchesFavorite;
  });

  if (state.sort === "price-low") items = items.sort((a, b) => a.price - b.price);
  if (state.sort === "price-high") items = items.sort((a, b) => b.price - a.price);
  return items;
}

function productMarkup(item) {
  const favorite = state.favorites.has(item.id);
  const conditionLabel = item.condition === "NM" ? "Near Mint" : item.condition === "LP" ? "Lightly Played" : "Sealed";
  const gameClass = item.game === "Yu-Gi-Oh!" ? "yu-gi-oh" : item.game.toLowerCase().replace(/[^a-z]+/g, "-");
  return `
    <article class="product-card">
      <div class="product-visual ${item.visual}">
        <span class="product-badge">${escapeHtml(item.badge)}</span>
        <button class="favorite-button ${favorite ? "is-favorite" : ""}" data-favorite="${item.id}" aria-label="${favorite ? "Remove from favourites" : "Add to favourites"}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10a4.8 4.8 0 0 1 8.8-2.6 4.8 4.8 0 0 1 8.8 2.6Z" /></svg>
        </button>
        <div class="product-art ${item.art}"><div class="product-art-inner"><span class="product-art-name">${escapeHtml(item.name)}</span><span class="product-art-emoji">${escapeHtml(item.emoji)}</span><span class="product-art-meta">CARDPEDIA · ${String(item.id).padStart(3, "0")}</span></div></div>
      </div>
      <div class="product-info">
        <div class="product-game"><span class="game-dot game-${gameClass}"></span>${escapeHtml(item.game)}</div>
        <h4>${escapeHtml(item.name)}</h4>
        <div class="product-meta"><span>${conditionLabel}</span><span class="meta-divider"></span><span>${escapeHtml(item.note)}</span></div>
        <div class="seller-line"><span class="seller"><span class="seller-avatar">${escapeHtml(item.seller.charAt(0).toUpperCase())}</span>${escapeHtml(item.seller)}</span><span class="seller-rating">${item.rating}</span></div>
        <div class="product-price">
          <strong>${euro(item.price)} <small>+ shipping</small></strong>
          <div class="product-actions">
            ${item.mode !== "trade" ? `<button class="add-cart" data-add="${item.id}" aria-label="Add ${escapeHtml(item.name)} to basket">+</button>` : ""}
            ${item.mode !== "buy" ? `<button class="add-cart trade-listing-action" data-trade="${item.id}" aria-label="Propose a trade for ${escapeHtml(item.name)}">⇄</button>` : ""}
          </div>
        </div>
      </div>
    </article>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function renderListings() {
  const items = visibleListings();
  grid.innerHTML = items.map(productMarkup).join("");
  document.querySelector("#listing-count").textContent = `(${items.length})`;
  document.querySelector("#empty-state").hidden = items.length > 0;
  grid.hidden = items.length === 0;
  document.querySelector("#load-more").hidden = items.length === 0;
  document.querySelector("#filter-indicator").hidden = state.condition === "all" && state.maxPrice === 500;
}

function renderCounts() {
  const cartCount = [...state.cart.values()].reduce((total, entry) => total + entry.quantity, 0);
  document.querySelector("#cart-count").textContent = cartCount || "";
  document.querySelector("#favorites-count").textContent = state.favorites.size || "";
}

function renderCart() {
  const entries = [...state.cart.values()];
  const cartItems = document.querySelector("#cart-items");
  cartItems.innerHTML = entries.map(({ item, quantity }) => `
    <div class="cart-row">
      <div class="cart-thumb">${escapeHtml(item.emoji)}</div>
      <div><h4>${escapeHtml(item.name)}${quantity > 1 ? ` × ${quantity}` : ""}</h4><p>${escapeHtml(item.game)} · ${escapeHtml(item.seller)}</p><button class="remove-cart" data-remove="${item.id}">Remove</button></div>
      <strong>${euro(item.price * quantity)}</strong>
    </div>`).join("");
  const total = entries.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  document.querySelector("#cart-total").textContent = euro(total);
  document.querySelector("#drawer-count").textContent = `(${entries.reduce((sum, entry) => sum + entry.quantity, 0)})`;
  document.querySelector("#cart-empty").hidden = entries.length > 0;
  document.querySelector("#cart-footer").hidden = entries.length === 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2500);
}

function openLayer(layer) {
  overlay.hidden = false;
  layer.hidden = false;
  layer.classList.add("open");
  if (layer === drawer) layer.setAttribute("aria-hidden", "false");
  if (layer === modal) modal.hidden = false;
  document.body.classList.add("modal-open");
  const closeButton = layer.querySelector("[data-close]");
  closeButton?.focus();
}

function closeLayers() {
  overlay.hidden = true;
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  modal.hidden = true;
  document.querySelector("#transaction-modal").hidden = true;
  document.querySelector("#auth-modal")?.setAttribute("hidden", "");
  document.body.classList.remove("modal-open");
}

let activeTransaction = { type: "guide", items: [] };

function openTransactionModal(type, items = []) {
  closeLayers();
  activeTransaction = { type, items };
  const content = document.querySelector("#transaction-content");
  const itemSummary = items.length
    ? `<div class="transaction-items">${items.map(({ item, quantity = 1 }) => `
        <div class="transaction-item"><span>${escapeHtml(item.name)}${quantity > 1 ? ` × ${quantity}` : ""}</span><strong>${euro(item.price * quantity)}</strong></div>`).join("")}</div>`
    : "";
  const total = items.reduce((sum, entry) => sum + entry.item.price * (entry.quantity || 1), 0);

  if (type === "case") {
    content.innerHTML = `
      <p class="modal-intro">Tell us what happened. This demo will not send or store a support request.</p>
      <form class="transaction-form" id="case-form">
        <label>Transaction type<select name="transactionType"><option>Purchase</option><option>Trade</option></select></label>
        <label>What went wrong?<select name="issue"><option>Item not as described</option><option>Item has not arrived</option><option>Trade partner is unresponsive</option><option>Other concern</option></select></label>
        <label>What happened?<textarea name="details" rows="3" maxlength="400" required placeholder="Share the key details. Do not include payment or personal information."></textarea></label>
        <button class="button button-primary modal-submit" type="submit">Preview a support request <span>→</span></button>
      </form>
      <div class="transaction-feedback" id="transaction-feedback" aria-live="polite"></div>
      <p class="transaction-disclaimer">Demo only — no case will be submitted and no mediator is currently available.</p>`;
  } else if (type === "trade") {
    const item = items[0];
    content.innerHTML = `
      <p class="modal-intro">Propose what you would offer for <strong>${escapeHtml(item.name)}</strong> from <strong>${escapeHtml(item.seller)}</strong>.</p>
      <form class="transaction-form" id="trade-form">
        <label>Your offer<input name="offer" maxlength="100" required placeholder="Card name, set and condition" /></label>
        <label>Message (optional)<textarea name="message" rows="2" maxlength="240" placeholder="Add language, photos to share, or shipping preferences"></textarea></label>
        <button class="button button-primary modal-submit" type="submit">Preview trade proposal <span>→</span></button>
      </form>
      <div class="transaction-feedback" id="transaction-feedback" aria-live="polite"></div>
      <div class="transaction-steps"><h3>Before either of you ships</h3><ol><li>Agree on both cards, condition and any value difference.</li><li>Exchange tracked shipping details and proof of postage.</li><li>Confirm both cards have arrived before considering the swap complete.</li></ol></div>
      <p class="transaction-disclaimer">Demo only — this proposal is not sent to the seller. Cardpedia does not hold cards or payments.</p>`;
  } else {
    const steps = `
      <div class="transaction-steps"><h3>${type === "guide" ? "Sale and trade checklist" : "How a community-supported sale should work"}</h3>
        <ol>
          <li><strong>Agree first.</strong> Confirm the exact item, condition, total cost and shipping terms with the other collector.</li>
          <li><strong>Use tracked delivery.</strong> Keep postage receipts and share tracking details. For swaps, both sides should ship with tracking.</li>
          <li><strong>Check before confirming.</strong> Compare the item with the listing and keep packaging until everything is resolved.</li>
          <li><strong>Raise concerns promptly.</strong> Keep relevant messages and delivery evidence for a fair review.</li>
        </ol>
      </div>`;
    content.innerHTML = `
      <p class="modal-intro">${type === "guide" ? "A practical checklist for peer-to-peer sales and swaps." : "Review the items and the steps before you continue."}</p>
      ${itemSummary}
      ${items.length ? `<div class="transaction-total"><span>Item total</span><strong>${euro(total)}</strong></div>` : ""}
      ${steps}
      ${type === "purchase" ? `<button class="button button-primary modal-submit" id="preview-request">Preview purchase request <span>→</span></button>` : ""}
      <div class="transaction-feedback" id="transaction-feedback" aria-live="polite"></div>
      <p class="transaction-disclaimer"><strong>No escrow:</strong> Cardpedia does not hold or release money, contact sellers, or currently handle disputes. Payment between users is not protected by this prototype. Do not send money based on this demo.</p>`;
  }
  openLayer(document.querySelector("#transaction-modal"));
}

document.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const id = Number(favoriteButton.dataset.favorite);
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveState();
    renderListings();
    renderCounts();
    showToast(state.favorites.has(id) ? "Added to your favourites." : "Removed from your favourites.");
  }

  const addButton = event.target.closest("[data-add]");
  if (addButton) {
    const item = state.listings.find((listing) => listing.id === Number(addButton.dataset.add));
    const current = state.cart.get(item.id);
    state.cart.set(item.id, { item, quantity: (current?.quantity || 0) + 1 });
    saveState();
    renderCounts();
    renderCart();
    showToast("Added to your basket.");
  }

  const tradeButton = event.target.closest("[data-trade]");
  if (tradeButton) {
    const item = state.listings.find((listing) => listing.id === Number(tradeButton.dataset.trade));
    openTransactionModal("trade", [{ item }]);
  }

  if (event.target.closest("#preview-request")) {
    document.querySelector("#transaction-feedback").innerHTML = "<strong>Preview only.</strong> Nothing has been sent to the seller and no payment has been taken.";
  }

  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    state.cart.delete(Number(removeButton.dataset.remove));
    saveState();
    renderCounts();
    renderCart();
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    document.querySelectorAll(".category-chip").forEach((button) => button.classList.toggle("selected", button === categoryButton));
    renderListings();
  }

  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) {
    state.mode = modeButton.dataset.mode;
    document.querySelectorAll(".toggle-option").forEach((button) => {
      const selected = button === modeButton;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderListings();
  }

  if (event.target.closest("[data-close]") || event.target === overlay) closeLayers();
});

document.querySelector("#search-input").addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  renderListings();
});
document.querySelector("#sort-select").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderListings();
});
document.querySelector("#condition-filter").addEventListener("change", (event) => {
  state.condition = event.target.value;
  renderListings();
});
document.querySelector("#price-filter").addEventListener("input", (event) => {
  state.maxPrice = Number(event.target.value);
  document.querySelector("#price-filter-value").textContent = euro(state.maxPrice);
  renderListings();
});

document.querySelector("#filter-button").addEventListener("click", () => {
  const panel = document.querySelector("#filters-panel");
  panel.hidden = !panel.hidden;
});
function resetFilters() {
  state.search = "";
  state.category = "all";
  state.mode = "all";
  state.condition = "all";
  state.maxPrice = 500;
  state.favoritesOnly = false;
  document.querySelector("#search-input").value = "";
  document.querySelector("#condition-filter").value = "all";
  document.querySelector("#price-filter").value = "500";
  document.querySelector("#price-filter-value").textContent = "€500";
  document.querySelectorAll(".category-chip").forEach((button) => button.classList.toggle("selected", button.dataset.category === "all"));
  document.querySelectorAll(".toggle-option").forEach((button) => {
    const selected = button.dataset.mode === "all";
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  renderListings();
}
document.querySelector("#clear-filters").addEventListener("click", resetFilters);
document.querySelector("#empty-reset").addEventListener("click", resetFilters);
document.querySelector("#load-more").addEventListener("click", () => showToast("You're viewing all available listings."));

document.querySelector("#cart-button").addEventListener("click", () => {
  renderCart();
  openLayer(drawer);
});
document.querySelector("#favorites-button").addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  if (state.favoritesOnly) {
    document.querySelector("#mercado").scrollIntoView({ behavior: "smooth" });
    showToast(state.favorites.size ? "Showing your favourites." : "You haven't saved any favourites yet.");
  } else {
    showToast("Showing all listings.");
  }
  renderListings();
});

function openListingModal() {
  closeLayers();
  openLayer(modal);
}
["#sell-button", "#hero-sell-button", "#banner-sell-button"].forEach((selector) => {
  document.querySelector(selector).addEventListener("click", openListingModal);
});
const listingForm = document.querySelector("#listing-form");
const listingFeedback = document.querySelector("#listing-form-feedback");
const listingSubmit = document.querySelector("#listing-submit");
const defectCheckbox = listingForm.querySelector("[name='has_defects']");
const conditionInput = listingForm.querySelector("[name='condition']");
const priceInput = listingForm.querySelector("[name='price']");
const frontInput = listingForm.querySelector("[name='photo_front']");
const backInput = listingForm.querySelector("[name='photo_back']");
const defectPhotosInput = listingForm.querySelector("[name='photo_defects']");
function updatePhotoRequirements() {
  const condition = conditionInput.value;
  const price = Number(priceInput.value);
  const eligibleCondition = condition === "M" || condition === "NM";
  const frontBackRequired = eligibleCondition && Number.isFinite(price) && price > 5;
  frontInput.required = frontBackRequired;
  backInput.required = frontBackRequired;
  defectPhotosInput.required = eligibleCondition && defectCheckbox.checked;
  document.querySelector("#defect-photos-wrap").hidden = !defectCheckbox.checked;
  const notice = document.querySelector("#photo-rule-notice");
  notice.textContent = eligibleCondition
    ? (frontBackRequired
      ? "For M / NM cards priced above €5, front and back photos are mandatory. If you report imperfections, add photos showing them."
      : "For M / NM cards priced at €5 or less, photos are optional. If you report imperfections, add photos showing them.")
    : "Photos are optional for this condition. You can still add them to show the item's actual state.";
}
[conditionInput, priceInput, defectCheckbox].forEach((input) => input.addEventListener("input", updatePhotoRequirements));
defectCheckbox.addEventListener("change", updatePhotoRequirements);
updatePhotoRequirements();
function validPhoto(file) {
  return file && ["image/jpeg","image/png","image/webp"].includes(file.type) && file.size <= 8 * 1024 * 1024;
}
listingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  listingFeedback.textContent = "";
  const session = window.cardpediaSession;
  if (!session?.user) {
    listingFeedback.textContent = "Please sign in before creating a listing.";
    return;
  }
  const form = new FormData(listingForm);
  const front = form.get("photo_front");
  const back = form.get("photo_back");
  const details = [...listingForm.querySelector("[name='photo_details']").files];
  const defects = [...listingForm.querySelector("[name='photo_defects']").files];
  const rarity = String(form.get("rarity"));
  const condition = String(form.get("condition"));
  const eligibleCondition = condition === "M" || condition === "NM";
  const frontBackRequired = eligibleCondition && Number(form.get("price")) > 5;
  const validOptionalPhoto = (file) => !file || file.size === 0 || validPhoto(file);
  if (!validOptionalPhoto(front) || !validOptionalPhoto(back) || details.some(file => !validPhoto(file)) || defects.some(file => !validPhoto(file))) {
    listingFeedback.textContent = "Use JPG, PNG or WebP photos, each up to 8 MB.";
    return;
  }
  if (frontBackRequired && (!validPhoto(front) || !validPhoto(back))) {
    listingFeedback.textContent = "Cards in M / NM condition priced above €5 require front and back photos.";
    return;
  }
  if (eligibleCondition && defectCheckbox.checked && defects.length === 0) {
    listingFeedback.textContent = "Add photos showing every reported damage or imperfection.";
    return;
  }
  if (!supabaseClient) {
    listingFeedback.textContent = "The listing service is currently unavailable.";
    return;
  }
  const gameNames = {
    "Pokémon":"pokemon", "Magic":"mtg", "One Piece":"onepiece",
    "Yu-Gi-Oh!":"yugioh", "Lorcana":"lorcana", "Riftbound":"riftbound", "Sealed":"sealed"
  };
  const modeMap = {buy:"sale",trade:"trade",both:"sale_or_trade"};
  const conditionMap = {M:"mint",NM:"near_mint",LP:"lightly_played",MP:"moderately_played",HP:"heavily_played",DMG:"damaged",sealed:"sealed"};
  listingSubmit.disabled = true;
  listingFeedback.textContent = "Saving your draft and uploading photos…";
  let listingId = null;
  const uploadedPaths = [];
  try {
    const { data: draft, error: draftError } = await supabaseClient.from("listings").insert({
      seller_id: session.user.id,
      game_id: gameNames[form.get("game")],
      title: String(form.get("name")).trim(),
      description: String(form.get("notes") || "").trim(),
      listing_type: modeMap[form.get("mode")],
      condition: conditionMap[form.get("condition")],
      language: form.get("language"),
      rarity,
      has_defects: defectCheckbox.checked,
      price_amount: Number(form.get("price")),
      status: "draft"
    }).select("id").single();
    if (draftError) throw draftError;
    listingId = draft.id;
    const uploads = [
      ...(front && front.size ? [{file:front,type:"front"}] : []),
      ...(back && back.size ? [{file:back,type:"back"}] : []),
      ...details.map(file=>({file,type:"detail"})),
      ...defects.map(file=>({file,type:"defect"}))
    ];
    const metadata = [];
    for (let index=0; index<uploads.length; index++) {
      const entry=uploads[index];
      const extension=entry.file.type==="image/png"?"png":entry.file.type==="image/webp"?"webp":"jpg";
      const path = session.user.id + "/" + listingId + "/" + entry.type + "-" + index + "-" + crypto.randomUUID() + "." + extension;
      const {error:uploadError}=await supabaseClient.storage.from("Cardpedia-listings").upload(path,entry.file,{contentType:entry.file.type,upsert:false});
      if(uploadError) throw uploadError;
      uploadedPaths.push(path);
      metadata.push({listing_id:listingId,storage_path:path,image_type:entry.type,sort_order:index});
    }
    const {error:imageError}=await supabaseClient.from("listing_images").insert(metadata);
    if(imageError) throw imageError;
    const {error:publishError}=await supabaseClient.from("listings").update({status:"active"}).eq("id",listingId).eq("seller_id",session.user.id);
    if(publishError) throw publishError;
    const game=form.get("game"), modeValue=form.get("mode");
    const item={
      id:Date.now(),name:String(form.get("name")).trim(),game,category:game,
      price:Number(form.get("price")),condition:form.get("condition"),
      badge:modeValue==="trade"?"For trade":"New listing",seller:session.user.user_metadata?.username||session.user.email.split("@")[0],
      rating:"★ new",emoji:game==="Pokémon"?"✦":game==="Magic"?"◈":game==="One Piece"?"☠":game==="Lorcana"?"✧":game==="Riftbound"?"◈":"♢",
      art:game==="Sealed"?"art-sealed":game==="Magic"?"art-magic":game==="One Piece"?"art-pirate":game==="Yu-Gi-Oh!"?"art-dragon":game==="Lorcana"?"art-gold":game==="Riftbound"?"art-magic":"art-pokemon",
      visual:"visual-gold",mode:modeValue,note:String(form.get("notes")||"").trim()||rarity
    };
    state.listings.unshift(item);
    saveState();
    if(state.category!=="all"&&state.category!==item.category) resetFilters();
    closeLayers();
    listingForm.reset();
    updatePhotoRequirements();
    renderListings();
    document.querySelector("#mercado").scrollIntoView({behavior:"smooth"});
    showToast("Your listing and photos are published.");
  } catch(error) {
    console.error("Cardpedia listing publication failed:",error);
    listingFeedback.textContent = error.message || "The listing could not be published. Your draft may be saved; contact support before retrying.";
    if(listingId && uploadedPaths.length===0) {
      // Keep the draft for recovery; never silently delete a seller's work.
    }
  } finally {
    listingSubmit.disabled=false;
  }
});

document.querySelector("#checkout-button").addEventListener("click", () => {
  const items = [...state.cart.values()];
  closeLayers();
  openTransactionModal("purchase", items);
});
document.querySelector("#protection-preview").addEventListener("click", () => openTransactionModal("guide"));
document.querySelector("#report-issue").addEventListener("click", () => openTransactionModal("case"));
document.querySelector("#transaction-content").addEventListener("submit", (event) => {
  if (event.target.id === "trade-form") {
    event.preventDefault();
    const offer = new FormData(event.target).get("offer").trim();
    document.querySelector("#transaction-feedback").innerHTML = `<strong>Trade preview ready.</strong> Your offer for “${escapeHtml(offer)}” stays in this browser; the seller has not been contacted.`;
  }
  if (event.target.id === "case-form") {
    event.preventDefault();
    document.querySelector("#transaction-feedback").innerHTML = "<strong>Support request preview ready.</strong> This information has not been sent or saved. No mediator is currently connected.";
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#search-input").focus();
    document.querySelector("#mercado").scrollIntoView({ behavior: "smooth" });
  }
  if (event.key === "Escape") closeLayers();
});
renderListings();
renderCounts();
renderCart();


const authModal = document.querySelector("#auth-modal");
const authForm = document.querySelector("#auth-form");
let authMode = "login";

function updateAccountButton(session) {
  const button = document.querySelector("#account-button");
  if (!button) return;
  const email = session?.user?.email;
  button.textContent = email ? "My account" : "Account";
  button.dataset.signedIn = email ? "true" : "false";
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  document.querySelector("#auth-title").textContent = signup ? "Create your account" : "Welcome back";
  document.querySelector("#auth-description").textContent = signup
    ? "Join Cardpedia to manage your collection and publish listings."
    : "Sign in to manage your collection and listings.";
  document.querySelector("#auth-name-wrap").hidden = !signup;
  document.querySelector("#auth-form [name='username']").required = signup;
  document.querySelector("#auth-form [name='password']").autocomplete = signup ? "new-password" : "current-password";
  document.querySelector("#auth-submit").innerHTML = signup ? "Create account <span>→</span>" : "Sign in <span>→</span>";
  document.querySelector("#auth-switch").innerHTML = signup
    ? 'Already registered? <button type="button" id="auth-toggle">Sign in</button>'
    : 'New to Cardpedia? <button type="button" id="auth-toggle">Create an account</button>';
  document.querySelector("#auth-feedback").textContent = "";
}

async function openAuthModal() {
  closeLayers();
  setAuthMode("login");
  document.querySelector("#auth-feedback").textContent = "";
  document.querySelector("#auth-signout").hidden = !window.cardpediaSession;
  if (window.cardpediaSession?.user?.email) {
    document.querySelector("#auth-title").textContent = "Your account";
    document.querySelector("#auth-description").textContent = window.cardpediaSession.user.email;
    const accountUser = window.cardpediaSession.user;
    const { data: profile } = await supabaseClient.from("profiles").select("username").eq("id", accountUser.id).maybeSingle();
    const username = profile?.username || accountUser.user_metadata?.username || accountUser.email?.split("@")[0] || "collector";
    document.querySelector("#account-username").textContent = "@" + username;
    document.querySelector("#account-identity").hidden = false;
    document.querySelector("#auth-form").hidden = true;
    document.querySelector("#auth-switch").hidden = true;
    document.querySelector("#auth-signout").hidden = false;
  } else {
    document.querySelector("#account-identity").hidden = true;
    document.querySelector("#auth-form").hidden = false;
    document.querySelector("#auth-switch").hidden = false;
  }
  openLayer(authModal);
}

document.querySelector("#account-button")?.addEventListener("click", openAuthModal);
document.querySelector("#auth-switch")?.addEventListener("click", (event) => {
  if (event.target.closest("#auth-toggle")) setAuthMode(authMode === "login" ? "signup" : "login");
});

document.querySelector("#auth-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const feedback = document.querySelector("#auth-feedback");
  const submit = document.querySelector("#auth-submit");
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email")).trim();
  const password = String(form.get("password"));
  submit.disabled = true;
  feedback.textContent = authMode === "signup" ? "Creating your account…" : "Signing in…";
  try {
    let result;
    if (authMode === "signup") {
      const username = String(form.get("username")).trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) { feedback.textContent = "Username must be 3–24 characters and use only letters, numbers or underscores."; submit.disabled = false; return; }
      result = await supabaseClient.auth.signUp({
        email, password,
        options: {
          data: { username },
          emailRedirectTo: "https://legendsandrelicspt.github.io/cardpedia/"
        }
      });
      if (!result.error && !result.data.session) {
        feedback.textContent = "Account created. Check your email and confirm your address before signing in.";
      }
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (!result.error) {
        feedback.textContent = "Signed in successfully.";
        setTimeout(closeLayers, 700);
      }
    }
    if (result.error) feedback.textContent = result.error.message;
  } catch (error) {
    feedback.textContent = error.message || "Authentication could not be completed.";
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#auth-signout")?.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  document.querySelector("#auth-feedback").textContent = error ? error.message : "You have signed out.";
  if (!error) {
    document.querySelector("#auth-form").hidden = false;
    document.querySelector("#auth-switch").hidden = false;
    document.querySelector("#auth-signout").hidden = true;
    setAuthMode("login");
  }
});

if (supabaseClient) {
  supabaseClient.auth.getSession().then(({ data }) => {
    window.cardpediaSession = data.session;
    updateAccountButton(data.session);
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.cardpediaSession = session;
    updateAccountButton(session);
    if (session?.user) {
      supabaseClient.from("profiles").upsert({
        id: session.user.id,
        username: session.user.user_metadata?.username || session.user.email?.split("@")[0]?.replace(/[^A-Za-z0-9_]/g, "").slice(0, 24) || "collector",
        display_name: session.user.user_metadata?.username || session.user.email?.split("@")[0]
      }, { onConflict: "id" }).then(({ error }) => {
        if (error) console.warn("Cardpedia: profile sync could not be completed.", error.message);
      });
    }
  });
}
