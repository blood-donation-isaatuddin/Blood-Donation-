import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const donorCollection = collection(db, "donors");
const donorGrid = document.getElementById("donorGrid");
const bloodFilter = document.getElementById("bloodFilter");
const locationSearch = document.getElementById("locationSearch");
const statDonors = document.getElementById("statDonors");
const statAvailable = document.getElementById("statAvailable");
const statDonations = document.getElementById("statDonations");
const menuBtn = document.getElementById("menuBtn");
const mobileNav = document.getElementById("mobileNav");

let donors = [];

loadDonors();

async function loadDonors() {
  try {
    const snapshot = await getDocs(donorCollection);
    donors = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    donors.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
    updateStats();
    renderDonors();
  } catch (error) {
    console.error("IBDS donor load error:", error);
    donorGrid.innerHTML = "";
  }
}

function isCurrentlyAvailable(donor) {
  if (donor.isAvailable !== false) return true;
  const availableFrom = toDate(donor.availableFrom);
  return Boolean(availableFrom && availableFrom.getTime() <= Date.now());
}

function updateStats() {
  statDonors.textContent = formatNumber(donors.length);
  statAvailable.textContent = formatNumber(donors.filter(isCurrentlyAvailable).length);
  statDonations.textContent = formatNumber(donors.reduce((sum, donor) => {
    const value = Number(donor.totalDonate);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0));
}

function getFilteredDonors() {
  const blood = bloodFilter.value;
  const search = locationSearch.value.trim().toLowerCase();

  // Inactive/unavailable donors are never displayed publicly.
  return donors.filter(donor => {
    if (!isCurrentlyAvailable(donor)) return false;
    const matchesBlood = !blood || String(donor.bloodGroup || "") === blood;
    const searchable = [donor.name, donor.location, donor.bloodGroup]
      .filter(Boolean).join(" ").toLowerCase();
    return matchesBlood && (!search || searchable.includes(search));
  });
}

function renderDonors() {
  donorGrid.innerHTML = "";
  const filtered = getFilteredDonors();
  const fragment = document.createDocumentFragment();
  filtered.forEach(donor => fragment.appendChild(createDonorCard(donor)));
  donorGrid.appendChild(fragment);
}

function createDonorCard(donor) {
  const card = document.createElement("article");
  card.className = "donor-card";

  const photoWrap = document.createElement("div");
  photoWrap.className = "donor-photo";

  if (donor.photo) {
    const img = document.createElement("img");
    img.src = donor.photo;
    img.alt = `${donor.name || "রক্তদাতা"}-এর ছবি`;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => {
      photoWrap.innerHTML = "";
      photoWrap.appendChild(createPlaceholder());
    }, { once: true });
    photoWrap.appendChild(img);
  } else {
    photoWrap.appendChild(createPlaceholder());
  }

  const body = document.createElement("div");
  body.className = "donor-body";

  const head = document.createElement("div");
  head.className = "donor-head";

  const identity = document.createElement("div");
  const name = document.createElement("h3");
  name.textContent = donor.name || "নাম নেই";
  const location = document.createElement("p");
  location.className = "donor-location";
  location.textContent = donor.location ? `📍 ${donor.location}` : "📍 লোকেশন নেই";
  identity.append(name, location);

  const blood = document.createElement("span");
  blood.className = "blood-badge";
  blood.textContent = donor.bloodGroup || "—";
  head.append(identity, blood);

  const info = document.createElement("div");
  info.className = "donor-info";

  const donations = document.createElement("span");
  donations.textContent = `❤️ মোট রক্তদান: ${formatNumber(Number(donor.totalDonate) || 0)} বার`;

  const status = document.createElement("span");
  status.className = "status";
  const dot = document.createElement("i");
  dot.className = "status-dot";
  const label = document.createElement("span");
  label.textContent = "Available";
  status.append(dot, label);

  info.append(donations, status);
  body.append(head, info);

  if (donor.phone) {
    const call = document.createElement("a");
    call.className = "call-btn";
    call.href = `tel:${normalizePhone(donor.phone)}`;
    call.textContent = "📞 কল করুন";
    call.setAttribute("aria-label", `${donor.name || "Donor"}-কে ফোন করুন`);
    body.appendChild(call);
  }

  card.append(photoWrap, body);
  return card;
}

function createPlaceholder() {
  const div = document.createElement("div");
  div.className = "photo-placeholder";
  div.textContent = "🩸";
  return div;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizePhone(phone) {
  const value = String(phone || "").trim();
  if (value.startsWith("+")) return value.replace(/[^\d+]/g, "");
  if (/^01\d{9}$/.test(value)) return `+880${value.slice(1)}`;
  return value.replace(/[^\d+]/g, "");
}

[bloodFilter, locationSearch].forEach(element => {
  element.addEventListener("input", renderDonors);
  element.addEventListener("change", renderDonors);
});

menuBtn?.addEventListener("click", () => {
  const open = menuBtn.getAttribute("aria-expanded") === "true";
  menuBtn.setAttribute("aria-expanded", String(!open));
  mobileNav.hidden = open;
  menuBtn.textContent = open ? "☰" : "✕";
});

mobileNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mobileNav.hidden = true;
    menuBtn?.setAttribute("aria-expanded", "false");
    if (menuBtn) menuBtn.textContent = "☰";
  });
});
