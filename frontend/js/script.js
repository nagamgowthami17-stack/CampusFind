/**
 * Campus Lost & Found System - Homepage Script
 * Technology: Pure Vanilla JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. Sample Data (College Lost & Found Items)
  // ==========================================
  const sampleItems = [
    {
      id: 1,
      type: 'lost',
      title: 'Hydro Flask Water Bottle',
      category: 'Personal Belongings',
      location: 'Central Library, 2nd Floor Study Area',
      date: 'Today, 10:15 AM',
      description: 'Navy blue 32oz bottle with stickers (NASA and GitHub). Last seen near cubicle #14.',
      icon: '🍶'
    },
    {
      id: 2,
      type: 'found',
      title: 'Texas Instruments TI-84 Plus',
      category: 'Electronics',
      location: 'Science Block B, Room 204',
      date: 'Yesterday, 3:45 PM',
      description: 'Black graphing calculator with a slight scratch on the screen protector. Kept with lab assistant.',
      icon: '🧮'
    },
    {
      id: 3,
      type: 'found',
      title: 'Student ID Card - Emily Chen',
      category: 'IDs & Cards',
      location: 'Campus Dining Hall / Cafeteria',
      date: 'Yesterday, 1:20 PM',
      description: 'Found on tray return counter. Belongs to Computer Science Dept (Batch 2024-2028).',
      icon: '🪪'
    },
    {
      id: 4,
      type: 'lost',
      title: 'Dell 65W USB-C Laptop Charger',
      category: 'Electronics',
      location: 'Main Auditorium, Row G',
      date: '2 days ago',
      description: 'Black Dell power adapter with a Velcro wire wrap and gray label on the connector.',
      icon: '🔌'
    },
    {
      id: 5,
      type: 'lost',
      title: 'North Face Backpack (Heather Gray)',
      category: 'Bags & Luggage',
      location: 'Sports Complex / Gymnasium',
      date: '3 days ago',
      description: 'Contains lecture notebooks and a red pencil case. Urgent for semester exams preparation.',
      icon: '🎒'
    },
    {
      id: 6,
      type: 'found',
      title: 'Dorm Room Key with Blue Lanyard',
      category: 'Keys',
      location: 'West Gate Parking Lot',
      date: '3 days ago',
      description: 'Brass Yale key on an official University blue fabric lanyard with clip.',
      icon: '🔑'
    }
  ];

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const itemsGrid = document.getElementById('itemsGrid');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterPills = document.querySelectorAll('.filter-pill');
  const itemCountBadge = document.getElementById('itemCount');
  const noResults = document.getElementById('noResults');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // Modal elements
  const actionModal = document.getElementById('actionModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalOkBtn = document.getElementById('modalOkBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalIcon = document.getElementById('modalIcon');

  // Mobile menu
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');

  // Backend API
  const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

  // State
  let currentFilter = 'all';
  let searchQuery = '';
  let allItems = [...sampleItems];

  function getCategoryIcon(category) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('elect')) return '💻';
    if (cat.includes('card') || cat.includes('id') || cat.includes('wallet')) return '🪪';
    if (cat.includes('bag') || cat.includes('pack')) return '🎒';
    if (cat.includes('key')) return '🔑';
    if (cat.includes('book') || cat.includes('note')) return '📚';
    if (cat.includes('cloth') || cat.includes('shoe')) return '👕';
    if (cat.includes('water') || cat.includes('bottle')) return '🍶';
    return '📦';
  }

  // ==========================================
  // 3. Rendering Function
  // ==========================================
  function renderItems() {
    // Filter items based on active pill and search query
    const filtered = allItems.filter(item => {
      const matchesType = (currentFilter === 'all') || (item.type === currentFilter);
      const query = searchQuery.trim().toLowerCase();
      
      const matchesSearch = query === '' ||
        (item.title || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query) ||
        (item.location || '').toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });

    // Update count badge
    itemCountBadge.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`;

    // Handle empty state
    if (filtered.length === 0) {
      itemsGrid.innerHTML = '';
      noResults.style.display = 'block';
      return;
    }

    noResults.style.display = 'none';

    // Render cards into the grid
    itemsGrid.innerHTML = filtered.map(item => `
      <article class="item-card" data-id="${item.id}">
        <div class="card-image-box">
          <span>${item.icon}</span>
          <span class="card-type-badge ${item.type}">${item.type.toUpperCase()}</span>
          <span class="card-category-tag">${escapeHTML(item.category)}</span>
        </div>

        <div class="card-body">
          <h3 class="card-title">${escapeHTML(item.title)}</h3>
          <p class="card-description">${escapeHTML(item.description)}</p>

          <div class="card-meta">
            <div class="meta-row">
              <span class="meta-icon">📍</span>
              <span>${escapeHTML(item.location)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-icon">🕒</span>
              <span>${escapeHTML(item.date)}</span>
            </div>
          </div>
        </div>

        <div class="card-footer">
           <button class="btn-card" data-action="details" data-id="${item.id}">
              View Details & Matches →
                 </button>

               ${item.type === 'found' ? `
              <button class="btn-card" data-action="claim" data-id="${item.id}">
               Claim This Item
                 </button>
                     ` : ''}
                </div>
      </article>
    `).join('');

    // Attach click events to card buttons
    attachCardListeners();
  }

  // ==========================================
  // 4. Event Listeners & Interaction
  // ==========================================

  // Real-time Search Input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    renderItems();
  });

  // Clear Search Button
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderItems();
  });

  // Filter Pills (All / Lost / Found)
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      renderItems();
    });
  });

  // Reset Filters from Empty State
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    currentFilter = 'all';
    filterPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-filter') === 'all'));
    renderItems();
  });

  // Mobile Navigation Toggle
  mobileMenuBtn.addEventListener('click', () => {
    navMenu.classList.toggle('open');
  });

  // Close mobile nav when clicking a link
  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  });

  // ==========================================
  // 5. Action Dialog / Modal Handlers & AI Matching
  // ==========================================
  function showModal(title, contentHtml, icon = 'ℹ️') {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    modalIcon.textContent = icon;
    actionModal.classList.add('active');
  }

  function closeModal() {
    actionModal.classList.remove('active');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalOkBtn.addEventListener('click', closeModal);
  actionModal.addEventListener('click', (e) => {
    if (e.target === actionModal) closeModal();
  });

  // Card "View Details & Matches" click handler
  function attachCardListeners() {
    const detailButtons = itemsGrid.querySelectorAll('button[data-action="details"]');
    detailButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = btn.getAttribute('data-id');
        const item = allItems.find(i => String(i.id) === String(itemId));
        if (!item) return;

        const initialHtml = `
          <div style="margin-bottom: 1rem; font-size: 0.95rem; line-height: 1.6;">
            <div><strong>Category:</strong> ${escapeHTML(item.category)}</div>
            <div><strong>Location:</strong> 📍 ${escapeHTML(item.location)}</div>
            <div><strong>Date:</strong> 📅 ${escapeHTML(item.date)}</div>
            ${item.custody ? `<div><strong>Claim Custody:</strong> 🏢 ${escapeHTML(item.custody)}</div>` : ''}
            <div style="margin-top: 0.5rem; color: var(--text-main);"><strong>Description:</strong> ${escapeHTML(item.description)}</div>
          </div>

          <div id="aiMatchSection" style="margin-top: 1.25rem; padding: 1rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <strong style="color: #2563eb; font-size: 0.9rem;">🤖 AI Object Match Engine</strong>
              <span style="font-size: 0.7rem; color: #1e40af; background: #dbeafe; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Text-Based NLP</span>
            </div>
            <div id="aiMatchStatus" style="font-size: 0.85rem; color: #64748b;">Scanning database for candidate matches...</div>
            <div id="aiMatchList" style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
          </div>
        `;

        showModal(`${item.title} (${item.type.toUpperCase()})`, initialHtml, item.icon);

        // Fetch live matches from backend AI endpoint
        try {
          const matchRes = await fetch(`${API_BASE_URL}/api/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              item: {
                item_name: item.title,
                category: item.category,
                color: item.color || '',
                description: item.description
              },
              type: item.type
            })
          });

          if (matchRes.ok) {
            const matchData = await matchRes.json();
            const statusEl = document.getElementById('aiMatchStatus');
            const listEl = document.getElementById('aiMatchList');

            if (!statusEl || !listEl) return;

            if (matchData.matches && matchData.matches.length > 0) {
              statusEl.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ Found ${matchData.matches.length} candidate match(es):</span>`;
              listEl.innerHTML = matchData.matches.slice(0, 3).map(m => `
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.6rem; font-size: 0.85rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                    <strong style="color: #0f172a;">${escapeHTML(m.candidate_title)}</strong>
                    <span style="background: ${m.similarity_score >= 70 ? '#dcfce7; color: #15803d' : '#fef9c3; color: #854d0e'}; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">
                      🎯 ${m.similarity_score}% Match
                    </span>
                  </div>
                  <div style="color: #64748b; font-size: 0.8rem;">
                    <span>📍 ${escapeHTML(m.location || 'Campus')}</span> | 
                    <span>Type: ${escapeHTML(m.candidate_type.toUpperCase())}</span>
                  </div>
                </div>
              `).join('');
            } else {
              statusEl.textContent = 'ℹ️ No potential matching reports found in database yet. Matches will appear as reports are added.';
            }
          }
        } catch (err) {
          const statusEl = document.getElementById('aiMatchStatus');
          if (statusEl) {
            statusEl.textContent = 'ℹ️ Backend AI matching engine is ready. Connect server to view live database matches.';
          }
        }
      });
    });
        // Handle Claim This Item buttons
    const claimButtons = itemsGrid.querySelectorAll('button[data-action="claim"]');

    claimButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-id');
       const item = allItems.find(
  i => String(i.id) === String(itemId) && i.type === 'found'
);

        if (!item || item.type !== 'found') return;

        const formHtml = `
          <form id="claimForm">
            <p style="margin-bottom: 15px;">
              Submit your details to claim: <strong>${escapeHTML(item.title)}</strong>
            </p>

            <input name="claimant_name" placeholder="Your full name" required
              maxlength="100" style="width:100%;padding:10px;margin-bottom:10px;">

            <input name="claimant_email" type="email" placeholder="Your email"
              required maxlength="254" style="width:100%;padding:10px;margin-bottom:10px;">

            <input name="claimant_phone" type="tel" placeholder="Your phone number"
              required maxlength="20" style="width:100%;padding:10px;margin-bottom:10px;">

            <textarea name="proof_details" placeholder="Describe proof that this item belongs to you"
              required maxlength="1000" style="width:100%;padding:10px;margin-bottom:10px;"></textarea>

            <button type="submit" class="btn btn-primary" style="width:100%;">
              Submit Claim
            </button>

            <p id="claimMessage" style="margin-top:10px;"></p>
          </form>
        `;

        showModal('Claim Found Item', formHtml, '📝');

        const claimForm = document.getElementById('claimForm');

        claimForm.addEventListener('submit', async (event) => {
          event.preventDefault();

          const submitButton = claimForm.querySelector('button[type="submit"]');
          const message = document.getElementById('claimMessage');

          submitButton.disabled = true;
          submitButton.textContent = 'Submitting...';

          const formData = new FormData(claimForm);

          try {
            const response = await fetch(`${API_BASE_URL}/api/claims`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                found_item_id: Number(item.id),
                claimant_name: formData.get('claimant_name'),
                claimant_email: formData.get('claimant_email'),
                claimant_phone: formData.get('claimant_phone'),
                proof_details: formData.get('proof_details')
              })
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.message || result.error || 'Claim submission failed.');
            }

            message.style.color = 'green';
            message.textContent = 'Claim submitted successfully! Waiting for staff approval.';
            claimForm.reset();

          } catch (error) {
            message.style.color = 'red';
            message.textContent = error.message;
          } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Claim';
          }
        });
      });
    });
  }

  // ==========================================
  // 6. Live Database Items Loader (Task 2)
  // ==========================================
  async function loadLiveItems() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/items`);
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const formattedLiveItems = data.items.map((item, index) => ({
            ...item,
            id: item.id || `live-${index}`,
            icon: getCategoryIcon(item.category)
          }));
          // Prepend live database items to the browse list
          allItems = formattedLiveItems;
          renderItems();
        }
      }
    } catch (e) {
      console.log('Using sample items for offline preview.');
    }
  }

  // ==========================================
  // 6. Utility Functions
  // ==========================================
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // 7. Initial Render & Live Sync
  // ==========================================
  renderItems();
  loadLiveItems();
});
