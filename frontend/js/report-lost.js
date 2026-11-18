/**
 * Campus Lost & Found System - Report Lost Item Script
 * Technology: Pure Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. DOM Elements
  // ==========================================
  const form = document.getElementById('lostItemForm');
  const formCard = document.getElementById('formCard');
  const successCard = document.getElementById('successCard');
  const summaryGrid = document.getElementById('summaryGrid');
  const reportAnotherBtn = document.getElementById('reportAnotherBtn');

  // Input fields
  const itemNameInput = document.getElementById('itemName');
  const itemCategorySelect = document.getElementById('itemCategory');
  const itemColorInput = document.getElementById('itemColor');
  const lostLocationInput = document.getElementById('lostLocation');
  const dateLostInput = document.getElementById('dateLost');
  const itemDescriptionInput = document.getElementById('itemDescription');
  const itemPhotoInput = document.getElementById('itemPhoto');

  // Error message elements
  const itemNameError = document.getElementById('itemNameError');
  const itemCategoryError = document.getElementById('itemCategoryError');
  const lostLocationError = document.getElementById('lostLocationError');
  const dateLostError = document.getElementById('dateLostError');
  const itemDescriptionError = document.getElementById('itemDescriptionError');
  const itemPhotoError = document.getElementById('itemPhotoError');

  // Photo upload and preview elements
  const uploadDropzone = document.getElementById('uploadDropzone');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const previewBox = document.getElementById('previewBox');
  const previewImg = document.getElementById('previewImg');
  const previewFileName = document.getElementById('previewFileName');
  const previewFileSize = document.getElementById('previewFileSize');
  const removePhotoBtn = document.getElementById('removePhotoBtn');

  // Mobile navigation elements
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  // Submit button & error elements
  const submitBtn = document.getElementById('submitBtn');
  const submitGeneralError = document.getElementById('submitGeneralError');

  // Backend API Base URL

  const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

  // Store photo data URL for demo preview
  let selectedPhotoDataUrl = null;
  let selectedPhotoFile = null;

  // ==========================================
  // 2. Initialize Constraints (Date restrictions)
  // ==========================================
  // Prevent selecting future dates for lost items
  const today = new Date().toISOString().split('T')[0];
  dateLostInput.setAttribute('max', today);

  // Mobile menu toggle
  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  // ==========================================
  // 3. Photo Upload & Preview Logic
  // ==========================================

  function handleFileSelect(file) {
    clearError(itemPhotoError, uploadDropzone);

    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showError(itemPhotoError, 'Please select a valid image file (PNG, JPG, or WEBP).', uploadDropzone);
      resetPhotoInput();
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showError(itemPhotoError, 'Image size exceeds 5MB. Please choose a smaller photo.', uploadDropzone);
      resetPhotoInput();
      return;
    }

    selectedPhotoFile = file;

    // Read and display preview
    const reader = new FileReader();
    reader.onload = (e) => {
      selectedPhotoDataUrl = e.target.result;
      previewImg.src = selectedPhotoDataUrl;
      previewFileName.textContent = file.name;
      previewFileSize.textContent = formatBytes(file.size);

      dropzonePrompt.style.display = 'none';
      previewBox.style.display = 'flex';
    };
    reader.readAsDataURL(file);
  }

  function resetPhotoInput() {
    itemPhotoInput.value = '';
    selectedPhotoDataUrl = null;
    selectedPhotoFile = null;
    previewImg.src = '';
    previewBox.style.display = 'none';
    dropzonePrompt.style.display = 'block';
  }

  // File change event
  itemPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  });

  // Remove photo button
  removePhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPhotoInput();
  });

  // Drag & drop support
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove('dragover');
    });
  });

  uploadDropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  });

  // ==========================================
  // 4. Form Validation Logic
  // ==========================================

  function showError(errorElement, message, inputElement = null) {
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
    }
    if (inputElement) {
      inputElement.classList.add('is-invalid');
    }
  }

  function clearError(errorElement, inputElement = null) {
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('show');
    }
    if (inputElement) {
      inputElement.classList.remove('is-invalid');
    }
  }

  // Live error clearing as user types
  itemNameInput.addEventListener('input', () => clearError(itemNameError, itemNameInput));
  itemCategorySelect.addEventListener('change', () => clearError(itemCategoryError, itemCategorySelect));
  lostLocationInput.addEventListener('input', () => clearError(lostLocationError, lostLocationInput));
  dateLostInput.addEventListener('change', () => clearError(dateLostError, dateLostInput));
  itemDescriptionInput.addEventListener('input', () => clearError(itemDescriptionError, itemDescriptionInput));

  function validateForm() {
    let isValid = true;
    let firstInvalidField = null;

    // 1. Validate Item Name
    const nameVal = itemNameInput.value.trim();
    if (!nameVal) {
      showError(itemNameError, 'Please enter the item name.', itemNameInput);
      isValid = false;
      firstInvalidField = firstInvalidField || itemNameInput;
    } else if (nameVal.length < 2) {
      showError(itemNameError, 'Item name must be at least 2 characters.', itemNameInput);
      isValid = false;
      firstInvalidField = firstInvalidField || itemNameInput;
    } else {
      clearError(itemNameError, itemNameInput);
    }

    // 2. Validate Category
    const categoryVal = itemCategorySelect.value;
    if (!categoryVal) {
      showError(itemCategoryError, 'Please select an item category.', itemCategorySelect);
      isValid = false;
      firstInvalidField = firstInvalidField || itemCategorySelect;
    } else {
      clearError(itemCategoryError, itemCategorySelect);
    }

    // 3. Validate Location
    const locationVal = lostLocationInput.value.trim();
    if (!locationVal) {
      showError(lostLocationError, 'Please state where you lost or last saw the item.', lostLocationInput);
      isValid = false;
      firstInvalidField = firstInvalidField || lostLocationInput;
    } else if (locationVal.length < 3) {
      showError(lostLocationError, 'Location details must be at least 3 characters.', lostLocationInput);
      isValid = false;
      firstInvalidField = firstInvalidField || lostLocationInput;
    } else {
      clearError(lostLocationError, lostLocationInput);
    }

    // 4. Validate Date Lost
    const dateVal = dateLostInput.value;
    if (!dateVal) {
      showError(dateLostError, 'Please select the approximate date the item was lost.', dateLostInput);
      isValid = false;
      firstInvalidField = firstInvalidField || dateLostInput;
    } else if (dateVal > today) {
      showError(dateLostError, 'Lost date cannot be in the future.', dateLostInput);
      isValid = false;
      firstInvalidField = firstInvalidField || dateLostInput;
    } else {
      clearError(dateLostError, dateLostInput);
    }

    // 5. Validate Description
    const descVal = itemDescriptionInput.value.trim();
    if (!descVal) {
      showError(itemDescriptionError, 'Please provide a description of the item.', itemDescriptionInput);
      isValid = false;
      firstInvalidField = firstInvalidField || itemDescriptionInput;
    } else if (descVal.length < 10) {
      showError(itemDescriptionError, 'Please enter a more descriptive explanation (at least 10 characters) for AI matching.', itemDescriptionInput);
      isValid = false;
      firstInvalidField = firstInvalidField || itemDescriptionInput;
    } else {
      clearError(itemDescriptionError, itemDescriptionInput);
    }

    // Auto-focus first invalid field for better accessibility
    if (firstInvalidField) {
      firstInvalidField.focus();
    }

    return isValid;
  }

  // ==========================================
  // 5. Form Submission Handling (API Integration)
  // ==========================================

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (submitGeneralError) {
      submitGeneralError.textContent = '';
      submitGeneralError.classList.remove('show');
    }

    // Disable button and show loading state
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Submitting to Database...';

    // Construct API payload
    const payload = {
      item_name: itemNameInput.value.trim(),
      category: itemCategorySelect.value,
      color: itemColorInput.value.trim() || null,
      lost_location: lostLocationInput.value.trim(),
      date_lost: dateLostInput.value,
      description: itemDescriptionInput.value.trim(),
      image_url: null
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/lost-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorDetails = result.details
          ? (Array.isArray(result.details) ? result.details.join(' ') : result.details)
          : (result.error || 'Failed to submit report. Please check backend.');
        throw new Error(errorDetails);
      }

      const savedItem = result.data || payload;

      // Render summary with database record details
      summaryGrid.innerHTML = `
        <div class="summary-item" style="grid-column: 1 / -1; background: #ecfdf5; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #a7f3d0;">
          <span class="summary-label" style="color: #047857;">Submission Status</span>
          <span class="summary-value" style="color: #059669; font-size: 1.05rem; font-weight: 700;">✓ Successfully Recorded in Database</span>
        </div>

        <div class="summary-item">
          <span class="summary-label">Item Name</span>
          <span class="summary-value">${escapeHTML(savedItem.item_name || payload.item_name)}</span>
        </div>

        <div class="summary-item">
          <span class="summary-label">Category</span>
          <span class="summary-value">${escapeHTML(savedItem.category || payload.category)}</span>
        </div>

        <div class="summary-item">
          <span class="summary-label">Colour / Appearance</span>
          <span class="summary-value">${escapeHTML(savedItem.color || 'Not specified')}</span>
        </div>

        <div class="summary-item">
          <span class="summary-label">Lost Location</span>
          <span class="summary-value">📍 ${escapeHTML(savedItem.lost_location || payload.lost_location)}</span>
        </div>

        <div class="summary-item">
          <span class="summary-label">Date Lost</span>
          <span class="summary-value">📅 ${escapeHTML(formatDate(savedItem.date_lost || payload.date_lost))}</span>
        </div>

        <div class="summary-item" style="grid-column: 1 / -1;">
          <span class="summary-label">Description</span>
          <span class="summary-value">${escapeHTML(savedItem.description || payload.description)}</span>
        </div>

        <div class="summary-item" style="grid-column: 1 / -1;">
          <span class="summary-label">Attached Photo</span>
          ${selectedPhotoDataUrl
            ? `<img src="${selectedPhotoDataUrl}" alt="Submitted photo" class="summary-thumbnail">`
            : `<span class="summary-value" style="color: var(--text-muted); font-weight: normal;">No photo attached</span>`
          }
        </div>
      `;

      // Switch views smoothly
      formCard.style.display = 'none';
      successCard.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('Submission error:', error);
      if (submitGeneralError) {
        submitGeneralError.textContent = `⚠️ Error: ${error.message}`;
        submitGeneralError.classList.add('show');
      } else {
        alert(`Error: ${error.message}`);
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // "Report Another Item" Button Handler
  reportAnotherBtn.addEventListener('click', () => {
    // Reset all form inputs
    form.reset();
    resetPhotoInput();

    if (submitGeneralError) {
      submitGeneralError.textContent = '';
      submitGeneralError.classList.remove('show');
    }

    // Reset error styling
    [itemNameInput, itemCategorySelect, lostLocationInput, dateLostInput, itemDescriptionInput].forEach(input => {
      input.classList.remove('is-invalid');
    });

    [itemNameError, itemCategoryError, lostLocationError, dateLostError, itemDescriptionError, itemPhotoError].forEach(el => {
      el.textContent = '';
      el.classList.remove('show');
    });

    // Toggle back to form view
    successCard.style.display = 'none';
    formCard.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    itemNameInput.focus();
  });

  // ==========================================
  // 6. Utility Functions
  // ==========================================

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}/${month}/${year}`;
    }
    return dateString;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
