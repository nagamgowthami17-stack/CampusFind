
const API_BASE_URL = window.APP_CONFIG.API_BASE_URL;

const adminKeyInput = document.getElementById('adminKey');
const loadClaimsBtn = document.getElementById('loadClaimsBtn');
const adminMessage = document.getElementById('adminMessage');
const claimsList = document.getElementById('claimsList');
const statusFilter = document.getElementById('statusFilter');

let adminKey = '';

function showMessage(message, isError = false) {
  adminMessage.textContent = message;
  adminMessage.style.color = isError ? 'red' : 'green';
}

async function loadClaims() {
  adminKey = adminKeyInput.value.trim();

  if (!adminKey) {
    showMessage('Please enter your admin key.', true);
    return;
  }

  showMessage('Loading claims...');
  claimsList.textContent = 'Please wait...';

  try {
    const status = statusFilter.value;

    const response = await fetch(
      `${API_BASE_URL}/api/admin/claims?status=${status}`,
      {
        headers: {
          'X-Admin-Key': adminKey
        }
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Unable to load claims.');
    }

    displayClaims(result.claims || []);
    showMessage(`Successfully loaded ${result.count} claim(s).`);

  } catch (error) {
    claimsList.textContent = 'Could not load claims.';
    showMessage(error.message, true);
  }
}

function displayClaims(claims) {
  claimsList.replaceChildren();

  if (claims.length === 0) {
    claimsList.textContent = 'No claims found.';
    return;
  }

  claims.forEach(claim => {
    const card = document.createElement('article');
    card.style.cssText =
      'border:1px solid #ddd;border-radius:10px;padding:20px;margin-bottom:20px;';

    const heading = document.createElement('h3');
    heading.textContent = `Claim #${claim.id}`;

    const details = document.createElement('p');
    details.textContent =
      `Found Item ID: ${claim.found_item_id} | Lost Item ID: ${claim.lost_item_id ?? 'Not linked'}`;

    const name = document.createElement('p');
    name.textContent = `Claimant: ${claim.claimant_name}`;

    const email = document.createElement('p');
    email.textContent = `Email: ${claim.claimant_email}`;

    const phone = document.createElement('p');
    phone.textContent = `Phone: ${claim.claimant_phone || 'Not provided'}`;

    const proof = document.createElement('p');
    proof.textContent = `Proof: ${claim.proof_details}`;

    const status = document.createElement('p');
    status.textContent = `Status: ${claim.claim_status}`;

    const notes = document.createElement('textarea');
    notes.placeholder = 'Optional staff notes';
    notes.maxLength = 1000;
    notes.style.cssText = 'width:100%;padding:10px;margin:10px 0;';

    card.append(
      heading, details, name, email, phone, proof, status, notes
    );

    if (claim.claim_status === 'pending') {
      const approveBtn = document.createElement('button');
      approveBtn.textContent = 'Approve';
      approveBtn.className = 'btn btn-primary';
      approveBtn.style.marginRight = '10px';

      approveBtn.addEventListener('click', () => {
        updateClaim(claim.id, 'approve', notes.value);
      });

      const rejectBtn = document.createElement('button');
      rejectBtn.textContent = 'Reject';
      rejectBtn.className = 'btn btn-primary';

      rejectBtn.addEventListener('click', () => {
        updateClaim(claim.id, 'reject', notes.value);
      });

      card.append(approveBtn, rejectBtn);
    }

    claimsList.appendChild(card);
  });
}

async function updateClaim(claimId, action, adminNotes) {
  const confirmed = window.confirm(
    `Are you sure you want to ${action} claim #${claimId}?`
  );

  if (!confirmed) return;

  showMessage(`Processing ${action} request...`);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/admin/claims/${claimId}/${action}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({
          admin_notes: adminNotes
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Could not ${action} claim.`);
    }

    showMessage(result.message || `Claim ${action}d successfully.`);
    await loadClaims();

  } catch (error) {
    showMessage(error.message, true);
  }
}

loadClaimsBtn.addEventListener('click', loadClaims);
statusFilter.addEventListener('change', loadClaims);
