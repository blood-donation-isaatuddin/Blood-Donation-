/*
  IBDS Admin Panel
  Firebase + Cloudinary
  Firebase Web SDK: v12.18.0
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// =========================
// Firebase configuration
// =========================

const firebaseConfig = {
  apiKey: "AIzaSyD3NUCRDFUVOVcCcCrVRCYPEePmBFcrcfw",
  authDomain: "ibds-5fa75.firebaseapp.com",
  projectId: "ibds-5fa75",
  storageBucket: "ibds-5fa75.firebasestorage.app",
  messagingSenderId: "97426509689",
  appId: "1:97426509689:web:0b6b9396db56347bac69a8"
};

// =========================
// Cloudinary configuration
// =========================

const CLOUDINARY_CLOUD_NAME = "fsrqmjzj";
const CLOUDINARY_UPLOAD_PRESET = "ibds_donors";
const CLOUDINARY_UPLOAD_URL =
  `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =========================
// DOM helpers
// =========================

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const appView = $("appView");
const loginForm = $("loginForm");
const loginEmail = $("loginEmail");
const loginPassword = $("loginPassword");
const loginBtn = $("loginBtn");
const loginMessage = $("loginMessage");
const logoutBtn = $("logoutBtn");

const totalDonors = $("totalDonors");
const availableDonors = $("availableDonors");
const unavailableDonors = $("unavailableDonors");
const totalDonations = $("totalDonations");
const donorCountLabel = $("donorCountLabel");

const donorSearch = $("donorSearch");
const bloodFilter = $("bloodFilter");
const statusFilter = $("statusFilter");
const loadingState = $("loadingState");
const emptyState = $("emptyState");
const donorTableWrap = $("donorTableWrap");
const donorTableBody = $("donorTableBody");

const donorModal = $("donorModal");
const modalTitle = $("modalTitle");
const donorForm = $("donorForm");
const donorId = $("donorId");
const donorPhoto = $("donorPhoto");
const photoPreview = $("photoPreview");
const photoHint = $("photoHint");
const uploadStatus = $("uploadStatus");
const donorName = $("donorName");
const donorBloodGroup = $("donorBloodGroup");
const donorPhone = $("donorPhone");
const donorLocation = $("donorLocation");
const donorTotalDonate = $("donorTotalDonate");
const donorAvailability = $("donorAvailability");
const unavailableFields = $("unavailableFields");
const lastDonationDate = $("lastDonationDate");
const availableFrom = $("availableFrom");
const formMessage = $("formMessage");
const saveDonorBtn = $("saveDonorBtn");

const confirmModal = $("confirmModal");
const confirmIcon = $("confirmIcon");
const confirmTitle = $("confirmTitle");
const confirmText = $("confirmText");
const confirmCancelBtn = $("confirmCancelBtn");
const confirmOkBtn = $("confirmOkBtn");

const toast = $("toast");

let donors = [];
let selectedPhotoFile = null;
let currentPhotoUrl = "";
let confirmAction = null;

// =========================
// Authentication
// =========================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
    return;
  }

  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  await loadDonors();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) return;

  loginMessage.textContent = "";
  setBusy(loginBtn, true, "Logging in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (error) {
    console.error(error);
    loginMessage.textContent = getAuthErrorMessage(error);
  } finally {
    setBusy(loginBtn, false, "Login");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showToast("Logged out");
  } catch (error) {
    console.error(error);
    showToast("Logout failed");
  }
});

function getAuthErrorMessage(error) {
  const code = error?.code || "";

  if (code.includes("invalid-credential")) {
    return "Email বা password সঠিক নয়।";
  }

  if (code.includes("invalid-email")) {
    return "সঠিক email দিন।";
  }

  if (code.includes("too-many-requests")) {
    return "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
  }

  if (code.includes("network-request-failed")) {
    return "Internet connection check করুন।";
  }

  return "Login করা যায়নি। আবার চেষ্টা করুন।";
}

// =========================
// Firestore
// =========================

async function loadDonors() {
  setTableState("loading");

  try {
    const donorsQuery = query(
      collection(db, "donors"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(donorsQuery);

    donors = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    await refreshExpiredDonors();

    updateStats();
    renderDonors();
  } catch (error) {
    console.error(error);
    setTableState("error");
  }
}

async function refreshExpiredDonors() {
  const now = new Date();

  const expired = donors.filter((donor) => {
    const date = toDate(donor.availableFrom);

    return donor.isAvailable === false && date && date <= now;
  });

  for (const donor of expired) {
    try {
      await updateDoc(doc(db, "donors", donor.id), {
        isAvailable: true,
        updatedAt: serverTimestamp()
      });

      donor.isAvailable = true;
    } catch (error) {
      console.error("Auto-enable failed:", donor.id, error);
    }
  }
}

async function saveDonor() {
  formMessage.textContent = "";

  const name = donorName.value.trim();
  const bloodGroup = donorBloodGroup.value;
  const phone = donorPhone.value.trim();
  const location = donorLocation.value.trim();
  const totalDonate = Number(donorTotalDonate.value);
  const isAvailable = donorAvailability.value === "true";

  if (!name || !bloodGroup || !phone || !location) {
    formMessage.textContent = "সব required field পূরণ করুন।";
    return;
  }

  if (!Number.isInteger(totalDonate) || totalDonate < 0) {
    formMessage.textContent = "Total Donate সঠিক সংখ্যা দিন।";
    return;
  }

  setBusy(saveDonorBtn, true, "Saving...");

  try {
    let photoUrl = currentPhotoUrl;

    if (selectedPhotoFile) {
      uploadStatus.textContent = "Cloudinary-তে photo upload হচ্ছে...";
      photoUrl = await uploadToCloudinary(selectedPhotoFile);
      uploadStatus.textContent = "Photo uploaded ✓";
    }

    const data = {
      name,
      photo: photoUrl || "",
      bloodGroup,
      phone,
      location,
      totalDonate,
      isAvailable,
      updatedAt: serverTimestamp()
    };

    if (isAvailable) {
      data.lastDonationDate = null;
      data.availableFrom = null;
    } else {
      const lastDate = lastDonationDate.value
        ? parseLocalDate(lastDonationDate.value)
        : new Date();

      const availableDate = availableFrom.value
        ? parseLocalDate(availableFrom.value)
        : addCalendarMonths(lastDate, 3);

      data.lastDonationDate = Timestamp.fromDate(lastDate);
      data.availableFrom = Timestamp.fromDate(availableDate);
    }

    if (donorId.value) {
      await updateDoc(doc(db, "donors", donorId.value), data);
      showToast("Donor updated successfully");
    } else {
      await addDoc(collection(db, "donors"), {
        ...data,
        createdAt: serverTimestamp()
      });
      showToast("Donor added successfully");
    }

    closeDonorModal();
    await loadDonors();
  } catch (error) {
    console.error(error);
    formMessage.textContent =
      "Donor save করা যায়নি। Firestore Rules এবং connection check করুন।";
  } finally {
    setBusy(saveDonorBtn, false, donorId.value ? "Save Changes" : "Save Donor");
  }
}

async function uploadToCloudinary(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "donors");

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }

  return data.secure_url;
}

// =========================
// Rendering
// =========================

function updateStats() {
  const total = donors.length;
  const available = donors.filter((d) => d.isAvailable !== false).length;
  const unavailable = total - available;

  const donations = donors.reduce((sum, donor) => {
    const value = Number(donor.totalDonate);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  totalDonors.textContent = formatNumber(total);
  availableDonors.textContent = formatNumber(available);
  unavailableDonors.textContent = formatNumber(unavailable);
  totalDonations.textContent = formatNumber(donations);
}

function renderDonors() {
  const filtered = getFilteredDonors();

  donorCountLabel.textContent =
    `${formatNumber(filtered.length)} donor${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    setTableState("empty");
    return;
  }

  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  donorTableWrap.classList.remove("hidden");

  donorTableBody.innerHTML = filtered.map(renderDonorRow).join("");
}

function renderDonorRow(donor) {
  const isAvailable = donor.isAvailable !== false;

  const avatar = donor.photo
    ? `<img class="donor-avatar" src="${escapeAttr(donor.photo)}" alt="" loading="lazy">`
    : `<div class="donor-avatar">🩸</div>`;

  return `
    <tr>
      <td>
        <div class="donor-cell">
          ${avatar}
          <div>
            <div class="donor-name">${escapeHtml(donor.name || "Unnamed")}</div>
            <div class="donor-phone">${escapeHtml(donor.phone || "")}</div>
          </div>
        </div>
      </td>

      <td>
        <span class="blood-pill">${escapeHtml(donor.bloodGroup || "—")}</span>
      </td>

      <td>${escapeHtml(donor.location || "—")}</td>

      <td>${formatNumber(Number(donor.totalDonate) || 0)}</td>

      <td>
        <span class="status-pill ${
          isAvailable ? "status-available" : "status-unavailable"
        }">
          ${isAvailable ? "Available" : "Unavailable"}
        </span>
      </td>

      <td>${isAvailable ? "—" : escapeHtml(formatDate(donor.availableFrom))}</td>

      <td>
        <div class="action-group">
          <button class="action-btn" data-action="edit" data-id="${escapeAttr(donor.id)}">Edit</button>
          <button class="action-btn" data-action="toggle" data-id="${escapeAttr(donor.id)}">
            ${isAvailable ? "Disable" : "Enable"}
          </button>
          <button class="action-btn" data-action="delete" data-id="${escapeAttr(donor.id)}">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function getFilteredDonors() {
  const search = donorSearch.value.trim().toLowerCase();
  const blood = bloodFilter.value;
  const status = statusFilter.value;

  return donors.filter((donor) => {
    const matchesSearch =
      !search ||
      String(donor.name || "").toLowerCase().includes(search) ||
      String(donor.location || "").toLowerCase().includes(search) ||
      String(donor.phone || "").toLowerCase().includes(search);

    const matchesBlood =
      !blood || donor.bloodGroup === blood;

    const available = donor.isAvailable !== false;

    const matchesStatus =
      !status ||
      (status === "available" && available) ||
      (status === "unavailable" && !available);

    return matchesSearch && matchesBlood && matchesStatus;
  });
}

function setTableState(state) {
  loadingState.classList.add("hidden");
  emptyState.classList.add("hidden");
  donorTableWrap.classList.add("hidden");

  if (state === "loading") {
    loadingState.classList.remove("hidden");
    return;
  }

  if (state === "empty") {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <div class="empty-icon">🩸</div>
      <strong>No donors found</strong>
      <span>নতুন donor যোগ করতে “Add Donor” চাপুন।</span>
    `;
    return;
  }

  if (state === "error") {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <div class="empty-icon">⚠️</div>
      <strong>Could not load donors</strong>
      <span>Firebase connection বা Firestore Rules check করুন।</span>
    `;
  }
}

// =========================
// Donor Modal
// =========================

$("addDonorBtn").addEventListener("click", openAddDonor);
$("closeModalBtn").addEventListener("click", closeDonorModal);
$("cancelModalBtn").addEventListener("click", closeDonorModal);

donorModal.addEventListener("click", (event) => {
  if (event.target === donorModal) closeDonorModal();
});

donorAvailability.addEventListener("change", updateAvailabilityFields);
donorPhoto.addEventListener("change", handlePhotoSelect);

donorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveDonor();
});

function openAddDonor() {
  donorForm.reset();

  donorId.value = "";
  currentPhotoUrl = "";
  selectedPhotoFile = null;

  modalTitle.textContent = "Add Donor";
  saveDonorBtn.textContent = "Save Donor";

  photoPreview.innerHTML = "🩸";
  photoHint.textContent = "JPG, PNG বা WEBP. সর্বোচ্চ 5MB.";
  uploadStatus.textContent = "";
  formMessage.textContent = "";

  donorTotalDonate.value = "0";
  donorAvailability.value = "true";
  lastDonationDate.value = "";
  availableFrom.value = "";

  updateAvailabilityFields();

  donorModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  donorName.focus();
}

function openEditDonor(donor) {
  donorForm.reset();

  donorId.value = donor.id;
  currentPhotoUrl = donor.photo || "";
  selectedPhotoFile = null;

  modalTitle.textContent = "Edit Donor";
  saveDonorBtn.textContent = "Save Changes";

  formMessage.textContent = "";
  uploadStatus.textContent = "";

  donorName.value = donor.name || "";
  donorBloodGroup.value = donor.bloodGroup || "";
  donorPhone.value = donor.phone || "";
  donorLocation.value = donor.location || "";
  donorTotalDonate.value = Number(donor.totalDonate) || 0;
  donorAvailability.value = donor.isAvailable === false ? "false" : "true";

  lastDonationDate.value = inputDateValue(donor.lastDonationDate);
  availableFrom.value = inputDateValue(donor.availableFrom);

  photoPreview.innerHTML = currentPhotoUrl
    ? `<img src="${escapeAttr(currentPhotoUrl)}" alt="Current donor photo">`
    : "🩸";

  photoHint.textContent = currentPhotoUrl
    ? "নতুন ছবি দিলে নতুন URL save হবে।"
    : "JPG, PNG বা WEBP. সর্বোচ্চ 5MB.";

  updateAvailabilityFields();

  donorModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeDonorModal() {
  donorModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function updateAvailabilityFields() {
  const isAvailable = donorAvailability.value === "true";
  unavailableFields.classList.toggle("hidden", isAvailable);
}

async function handlePhotoSelect() {
  const file = donorPhoto.files?.[0];

  selectedPhotoFile = null;
  uploadStatus.textContent = "";

  if (!file) return;

  const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  if (!allowedTypes.has(file.type)) {
    donorPhoto.value = "";
    uploadStatus.textContent = "শুধু JPG, PNG বা WEBP ব্যবহার করুন।";
    uploadStatus.style.color = "#b91c1c";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    donorPhoto.value = "";
    uploadStatus.textContent = "ছবির size 5MB-এর বেশি হতে পারবে না।";
    uploadStatus.style.color = "#b91c1c";
    return;
  }

  uploadStatus.style.color = "";
  selectedPhotoFile = file;

  const reader = new FileReader();

  reader.onload = () => {
    photoPreview.innerHTML =
      `<img src="${escapeAttr(reader.result)}" alt="Selected donor photo">`;
  };

  reader.readAsDataURL(file);
  uploadStatus.textContent = "Photo selected. Save করলে upload হবে।";
}

// =========================
// Donor actions
// =========================

donorTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const donor = donors.find((item) => item.id === button.dataset.id);
  if (!donor) return;

  switch (button.dataset.action) {
    case "edit":
      openEditDonor(donor);
      break;
    case "toggle":
      openToggleConfirm(donor);
      break;
    case "delete":
      openDeleteConfirm(donor);
      break;
    default:
      break;
  }
});

function openToggleConfirm(donor) {
  const currentlyAvailable = donor.isAvailable !== false;

  confirmIcon.textContent = currentlyAvailable ? "🔴" : "🟢";
  confirmTitle.textContent = currentlyAvailable
    ? "Disable donor?"
    : "Enable donor?";

  confirmText.textContent = currentlyAvailable
    ? `${donor.name || "এই donor"}-কে unavailable করা হবে। আজকের date থেকে 3 calendar months পরে available হবে।`
    : `${donor.name || "এই donor"}-কে আবার available করা হবে।`;

  confirmAction = async () => {
    if (currentlyAvailable) {
      await disableDonor(donor);
    } else {
      await enableDonor(donor);
    }
  };

  confirmModal.classList.remove("hidden");
}

async function disableDonor(donor) {
  const donationDate = new Date();
  const availableDate = addCalendarMonths(donationDate, 3);

  await updateDoc(doc(db, "donors", donor.id), {
    isAvailable: false,
    lastDonationDate: Timestamp.fromDate(donationDate),
    availableFrom: Timestamp.fromDate(availableDate),
    updatedAt: serverTimestamp()
  });

  showToast(`${donor.name} disabled`);
  await loadDonors();
}

async function enableDonor(donor) {
  await updateDoc(doc(db, "donors", donor.id), {
    isAvailable: true,
    updatedAt: serverTimestamp()
  });

  showToast(`${donor.name} enabled`);
  await loadDonors();
}

function openDeleteConfirm(donor) {
  confirmIcon.textContent = "🗑️";
  confirmTitle.textContent = "Delete donor?";
  confirmText.textContent =
    `${donor.name || "এই donor"}-এর record permanently delete হবে।`;

  confirmAction = async () => {
    await deleteDoc(doc(db, "donors", donor.id));
    showToast("Donor deleted");
    await loadDonors();
  };

  confirmModal.classList.remove("hidden");
}

confirmCancelBtn.addEventListener("click", closeConfirmModal);

confirmOkBtn.addEventListener("click", async () => {
  if (!confirmAction) return;

  setBusy(confirmOkBtn, true, "Working...");

  try {
    await confirmAction();
    closeConfirmModal();
  } catch (error) {
    console.error(error);
    showToast("Action failed. Firestore Rules/connection check করুন।");
  } finally {
    setBusy(confirmOkBtn, false, "Confirm");
    confirmAction = null;
  }
});

confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) closeConfirmModal();
});

function closeConfirmModal() {
  confirmModal.classList.add("hidden");
  confirmAction = null;
}

// =========================
// Search / filters
// =========================

[donorSearch, bloodFilter, statusFilter].forEach((element) => {
  element.addEventListener("input", renderDonors);
  element.addEventListener("change", renderDonors);
});

// =========================
// Helpers
// =========================

function setBusy(button, busy, text) {
  button.disabled = busy;
  button.textContent = text;
  button.style.opacity = busy ? "0.72" : "1";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function addCalendarMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));

  return result;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function inputDateValue(value) {
  const date = toDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "string") {
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  return null;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
