import os
import datetime
import re
import hmac
from difflib import SequenceMatcher
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# 1. Load environment variables from .env file inside backend folder
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, '.env')
load_dotenv(dotenv_path)

# Initialize Flask App
app = Flask(__name__)

# Enable Cross-Origin Resource Sharing (CORS) so frontend can communicate with backend
CORS(app)

# 2. Retrieve Supabase credentials and administrative secrets from environment
SUPABASE_URL = os.getenv('SUPABASE_URL', '').strip()
SUPABASE_KEY = os.getenv('SUPABASE_KEY', '').strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '').strip()
ADMIN_API_KEY = os.getenv('ADMIN_API_KEY', '').strip()

# 3. Initialize Public Supabase Client (Standard Anon Client for public browsing and submission)
supabase = None
supabase_configured = False

if SUPABASE_URL and SUPABASE_KEY and SUPABASE_KEY != 'YOUR_PUBLISHABLE_KEY':
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        supabase_configured = True
        print("✓ Supabase public client initialized successfully.")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize Supabase public client: {e}")
else:
    print("ℹ Note: Supabase public credentials are placeholder or not yet set.")

# 4. Initialize Administrative Service-Role Client (Used strictly on server for claims & admin RPCs)
supabase_service = None
supabase_service_configured = False

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE_KEY != 'YOUR_SERVICE_ROLE_KEY':
    try:
        from supabase import create_client, Client
        supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        supabase_service_configured = True
        print("✓ Supabase service-role client initialized successfully.")
    except Exception as e:
        print(f"⚠ Warning: Could not initialize Supabase service-role client: {e}")
else:
    print("ℹ Note: SUPABASE_SERVICE_ROLE_KEY is not configured yet. Claim and admin actions will return HTTP 503 until set.")

def verify_admin_key() -> bool:
    """
    Verifies the administrator authentication key.
    Uses hmac.compare_digest for constant-time comparison to prevent timing attacks.
    Checks X-Admin-Key header and Authorization: Bearer <key>.
    """
    if not ADMIN_API_KEY:
        return False
    provided = request.headers.get('X-Admin-Key', '')
    if not provided:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            provided = auth_header[7:].strip()
    return hmac.compare_digest(provided, ADMIN_API_KEY)

# =============================================================================
# API Endpoints
# =============================================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify backend status and live Supabase database connectivity.
    """
    database_connected = False
    database_message = ""

    if not supabase_configured or supabase is None:
        database_message = "Supabase client is not configured. Check backend/.env credentials."
    else:
        try:
            # Perform safe, read-only query to verify live database connectivity
            response = supabase.table('lost_items').select('id').limit(1).execute()
            database_connected = True
            database_message = "Successfully connected to Supabase database."
        except Exception as e:
            database_connected = False
            # Sanitize error message to prevent accidental exposure of keys or secrets
            err_msg = str(e)
            for k in [SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY]:
                if k and k in err_msg:
                    err_msg = err_msg.replace(k, "[REDACTED]")
            database_message = f"Database query failed: {err_msg}"

    response_payload = {
        "status": "healthy" if database_connected else "degraded",
        "service": "CampusFind Backend API",
        "supabase_configured": supabase_configured,
        "supabase_service_configured": supabase_service_configured,
        "database_connected": database_connected,
        "database_message": database_message,
        "supabase_url": SUPABASE_URL if SUPABASE_URL else "Not configured"
    }

    status_code = 200 if database_connected else 503
    return jsonify(response_payload), status_code

@app.route('/api/lost-items', methods=['POST'])
def report_lost_item():
    """
    Receives lost item report data, validates required fields,
    and inserts the record into the Supabase lost_items table.
    """
    if not supabase_configured or supabase is None:
        return jsonify({
            "success": False,
            "error": "Database service is not configured. Check backend/.env."
        }), 503

    data = request.get_json()
    if not data:
        return jsonify({
            "success": False,
            "error": "Invalid request body. Expected JSON data."
        }), 400

    # 1. Extract inputs safely
    item_name = str(data.get('item_name', '')).strip()
    category = str(data.get('category', '')).strip()
    color = str(data.get('color', '')).strip() if data.get('color') else None
    lost_location = str(data.get('lost_location', '')).strip()
    date_lost = str(data.get('date_lost', '')).strip()
    description = str(data.get('description', '')).strip()
    image_url = data.get('image_url')
    contact_name = str(data.get('contact_name', '')).strip() if data.get('contact_name') else None
    contact_email = str(data.get('contact_email', '')).strip() if data.get('contact_email') else None
    contact_phone = str(data.get('contact_phone', '')).strip() if data.get('contact_phone') else None

    # 2. Server-side validation
    errors = []
    if not item_name or len(item_name) < 2:
        errors.append("item_name is required and must be at least 2 characters.")
    if not category:
        errors.append("category is required.")
    if not lost_location or len(lost_location) < 3:
        errors.append("lost_location is required and must be at least 3 characters.")
    if not date_lost:
        errors.append("date_lost is required.")
    else:
        try:
            lost_date_obj = datetime.date.fromisoformat(date_lost)
            if lost_date_obj > datetime.date.today():
                errors.append("date_lost cannot be in the future.")
        except ValueError:
            errors.append("date_lost must be in YYYY-MM-DD format.")
    if not description or len(description) < 10:
        errors.append("description is required and must be at least 10 characters.")

    if errors:
        return jsonify({
            "success": False,
            "error": "Validation failed",
            "details": errors
        }), 400

    # 3. Construct record for Supabase
    new_lost_item = {
        "item_name": item_name,
        "category": category,
        "color": color,
        "lost_location": lost_location,
        "date_lost": date_lost,
        "description": description,
        "image_url": image_url,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
        "status": "open"
    }

    # 4. Insert into Supabase database (using returning='minimal' to respect RLS without requiring a SELECT policy)
    try:
        supabase.table('lost_items').insert(new_lost_item, returning='minimal').execute()
        return jsonify({
            "success": True,
            "message": "Lost item report submitted successfully.",
            "data": new_lost_item
        }), 201
    except Exception as e:
        err_msg = str(e)
        if SUPABASE_KEY and SUPABASE_KEY in err_msg:
            err_msg = err_msg.replace(SUPABASE_KEY, "[REDACTED]")
        return jsonify({
            "success": False,
            "error": "Failed to save lost item to database.",
            "details": err_msg
        }), 500

# =============================================================================
# TASK 1: Report Found Item Endpoint
# =============================================================================
@app.route('/api/found-items', methods=['POST'])
def report_found_item():
    """
    Receives found item report data, validates required fields,
    and inserts the record into the Supabase found_items table.
    Uses returning='minimal' to respect RLS without requiring a SELECT policy.
    """
    if not supabase_configured or supabase is None:
        return jsonify({
            "success": False,
            "error": "Database service is not configured. Check backend/.env."
        }), 503

    data = request.get_json()
    if not data:
        return jsonify({
            "success": False,
            "error": "Invalid request body. Expected JSON data."
        }), 400

    # 1. Extract inputs safely
    item_name = str(data.get('item_name', '')).strip()
    category = str(data.get('category', '')).strip()
    color = str(data.get('color', '')).strip() if data.get('color') else None
    found_location = str(data.get('found_location', '')).strip()
    date_found = str(data.get('date_found', '')).strip()
    item_custody = str(data.get('item_custody', '')).strip()
    description = str(data.get('description', '')).strip()
    image_url = data.get('image_url')
    founder_name = str(data.get('founder_name', '')).strip() if data.get('founder_name') else None
    founder_email = str(data.get('founder_email', '')).strip() if data.get('founder_email') else None

    # 2. Server-side validation
    errors = []
    if not item_name or len(item_name) < 2:
        errors.append("item_name is required and must be at least 2 characters.")
    if not category:
        errors.append("category is required.")
    if not found_location or len(found_location) < 3:
        errors.append("found_location is required and must be at least 3 characters.")
    if not date_found:
        errors.append("date_found is required.")
    else:
        try:
            found_date_obj = datetime.date.fromisoformat(date_found)
            if found_date_obj > datetime.date.today():
                errors.append("date_found cannot be in the future.")
        except ValueError:
            errors.append("date_found must be in YYYY-MM-DD format.")
    if not item_custody or len(item_custody) < 3:
        errors.append("item_custody is required and must be at least 3 characters.")
    if not description or len(description) < 10:
        errors.append("description is required and must be at least 10 characters.")

    if errors:
        return jsonify({
            "success": False,
            "error": "Validation failed",
            "details": errors
        }), 400

    # 3. Construct record for Supabase
    new_found_item = {
        "item_name": item_name,
        "category": category,
        "color": color,
        "found_location": found_location,
        "date_found": date_found,
        "item_custody": item_custody,
        "description": description,
        "image_url": image_url,
        "founder_name": founder_name,
        "founder_email": founder_email,
        "status": "available"
    }

    # 4. Insert into Supabase database (using returning='minimal' to respect RLS)
    try:
        supabase.table('found_items').insert(new_found_item, returning='minimal').execute()
        return jsonify({
            "success": True,
            "message": "Found item report submitted successfully.",
            "data": new_found_item
        }), 201
    except Exception as e:
        err_msg = str(e)
        if SUPABASE_KEY and SUPABASE_KEY in err_msg:
            err_msg = err_msg.replace(SUPABASE_KEY, "[REDACTED]")
        return jsonify({
            "success": False,
            "error": "Failed to save found item to database.",
            "details": err_msg
        }), 500

# =============================================================================
# TASK 2: Browse Items Endpoint (Safe Public View)
# =============================================================================
@app.route('/api/items', methods=['GET'])
def get_browse_items():
    """
    Retrieves public items for browsing.
    Safely filters out all private contact information (names, emails, phones).
    """
    items = []
    db_connected = False

    if supabase_configured and supabase is not None:
        try:
            # 1. Fetch public fields from public_lost_items secure view (only active 'open' items)
            lost_res = supabase.table('public_lost_items') \
                .select('id, item_name, category, color, lost_location, date_lost, description, image_url, status, created_at') \
                .eq('status', 'open') \
                .order('created_at', desc=True) \
                .limit(20) \
                .execute()
            
            for item in (lost_res.data or []):
                items.append({
                    "id": item.get('id'),
                    "type": "lost",
                    "title": item.get('item_name'),
                    "category": item.get('category'),
                    "color": item.get('color'),
                    "location": item.get('lost_location'),
                    "date": str(item.get('date_lost')) if item.get('date_lost') else "",
                    "description": item.get('description'),
                    "status": item.get('status', 'open'),
                    "image_url": item.get('image_url')
                })

            # 2. Fetch public fields from public_found_items secure view (only active 'available' items)
            found_res = supabase.table('public_found_items') \
                .select('id, item_name, category, color, found_location, date_found, description, image_url, status, created_at') \
                .eq('status', 'available') \
                .order('created_at', desc=True) \
                .limit(20) \
                .execute()

            for item in (found_res.data or []):
                items.append({
                    "id": item.get('id'),
                    "type": "found",
                    "title": item.get('item_name'),
                    "category": item.get('category'),
                    "color": item.get('color'),
                    "location": item.get('found_location'),
                    "date": str(item.get('date_found')) if item.get('date_found') else "",
                    "custody": item.get('item_custody'),
                    "description": item.get('description'),
                    "status": item.get('status', 'available'),
                    "image_url": item.get('image_url')
                })

            db_connected = True
        except Exception as e:
            # If public SELECT policy is missing on Supabase, catch gracefully
            print(f"Notice during /api/items fetch: {e}")
            db_connected = False

    return jsonify({
        "success": True,
        "count": len(items),
        "db_connected": db_connected,
        "items": items,
        "note": "Private contact details are filtered on the backend for privacy."
    }), 200

# =============================================================================
# TASK 3: Basic Explainable AI Matching
# =============================================================================
def calculate_similarity(lost_item, found_item):
    """
    Explainable text-based object matching algorithm.
    Calculates a similarity score (0% to 100%) based on:
    1. Category Match (Weight: 35%)
    2. Item Title / Name Word Similarity (Weight: 35%)
    3. Description Keyword Overlap (Weight: 20%)
    4. Color Match (Weight: 10%)
    """
    score = 0.0

    # 1. Category Matching (Exact or normalized match)
    lost_cat = str(lost_item.get('category', '')).strip().lower()
    found_cat = str(found_item.get('category', '')).strip().lower()
    if lost_cat and found_cat:
        if lost_cat == found_cat:
            score += 35.0
        elif lost_cat in found_cat or found_cat in lost_cat:
            score += 20.0

    # 2. Title / Name Similarity (SequenceMatcher + Token overlap)
    lost_title = str(lost_item.get('item_name', lost_item.get('title', ''))).strip().lower()
    found_title = str(found_item.get('item_name', found_item.get('title', ''))).strip().lower()
    if lost_title and found_title:
        seq_ratio = SequenceMatcher(None, lost_title, found_title).ratio()
        
        lost_words = set(re.findall(r'\b[a-z0-9]{2,}\b', lost_title))
        found_words = set(re.findall(r'\b[a-z0-9]{2,}\b', found_title))
        jaccard = (len(lost_words & found_words) / len(lost_words | found_words)) if (lost_words | found_words) else 0.0
        
        title_score = max(seq_ratio, jaccard)
        score += title_score * 35.0

    # 3. Description Keyword Overlap
    lost_desc = str(lost_item.get('description', '')).strip().lower()
    found_desc = str(found_item.get('description', '')).strip().lower()
    if lost_desc and found_desc:
        stop_words = {'the', 'and', 'with', 'for', 'this', 'that', 'near', 'from', 'have', 'lost', 'found', 'item', 'was', 'has', 'in', 'on', 'at'}
        desc_lost_words = set(re.findall(r'\b[a-z0-9]{3,}\b', lost_desc)) - stop_words
        desc_found_words = set(re.findall(r'\b[a-z0-9]{3,}\b', found_desc)) - stop_words
        
        if desc_lost_words and desc_found_words:
            overlap = len(desc_lost_words & desc_found_words)
            overlap_ratio = min(overlap / min(len(desc_lost_words), 5), 1.0)
            score += overlap_ratio * 20.0

    # 4. Color Match
    lost_color = str(lost_item.get('color', '')).strip().lower()
    found_color = str(found_item.get('color', '')).strip().lower()
    if lost_color and found_color and lost_color != 'not specified' and found_color != 'not specified':
        color_lost_words = set(re.findall(r'\b[a-z]{3,}\b', lost_color))
        color_found_words = set(re.findall(r'\b[a-z]{3,}\b', found_color))
        if color_lost_words & color_found_words:
            score += 10.0

    return min(round(score, 1), 100.0)

@app.route('/api/matches', methods=['GET', 'POST'])
def get_ai_matches():
    """
    Basic Explainable AI / NLP Object Matching Endpoint.
    Compares reported lost items against reported found items using text similarity.
    Can also accept a custom item payload via POST to find immediate matches.
    """
    lost_list = []
    found_list = []

    # If POST, caller supplied a target item to match against
    custom_target = None
    target_type = 'lost'
    if request.method == 'POST':
        body = request.get_json() or {}
        custom_target = body.get('item')
        target_type = body.get('type', 'lost')

    if supabase_configured and supabase is not None:
        try:
            lost_res = supabase.table('public_lost_items').select('*').eq('status', 'open').limit(30).execute()
            lost_list = lost_res.data or []
            found_res = supabase.table('public_found_items').select('*').eq('status', 'available').limit(30).execute()
            found_list = found_res.data or []
        except Exception as e:
            print(f"Notice during match fetch: {e}")

    matches = []

    if custom_target:
        # Match custom target against database items
        pool = found_list if target_type == 'lost' else lost_list
        for candidate in pool:
            sim = calculate_similarity(
                custom_target if target_type == 'lost' else candidate,
                candidate if target_type == 'lost' else custom_target
            )
            if sim >= 30.0:
                matches.append({
                    "target_title": custom_target.get('item_name') or custom_target.get('title'),
                    "candidate_id": candidate.get('id'),
                    "candidate_title": candidate.get('item_name'),
                    "candidate_type": "found" if target_type == 'lost' else "lost",
                    "category": candidate.get('category'),
                    "location": candidate.get('found_location') if target_type == 'lost' else candidate.get('lost_location'),
                    "similarity_score": sim,
                    "confidence": "High" if sim >= 70 else ("Medium" if sim >= 50 else "Moderate"),
                    "algorithm": "Basic Explainable Text-Based Matcher"
                })
    else:
        # Cross-match all lost vs found
        for lost in lost_list:
            for found in found_list:
                sim = calculate_similarity(lost, found)
                if sim >= 30.0:
                    matches.append({
                        "lost_id": lost.get('id'),
                        "lost_title": lost.get('item_name'),
                        "found_id": found.get('id'),
                        "found_title": found.get('item_name'),
                        "category": lost.get('category'),
                        "lost_location": lost.get('lost_location'),
                        "found_location": found.get('found_location'),
                        "similarity_score": sim,
                        "confidence": "High" if sim >= 70 else ("Medium" if sim >= 50 else "Moderate"),
                        "algorithm": "Basic Explainable Text-Based Matcher"
                    })

    # Sort matches by similarity descending
    matches.sort(key=lambda x: x['similarity_score'], reverse=True)

    return jsonify({
        "success": True,
        "count": len(matches),
        "matches": matches,
        "matching_engine": {
            "type": "Basic Explainable Text-Based Matcher (Rule/NLP)",
            "features": ["Category Match (35%)", "Title Similarity (35%)", "Description Keywords (20%)", "Color (10%)"]
        }
    }), 200

# =============================================================================
# TASK 4: Ownership Claims & Resolution Endpoints (Server-Mediated)
# =============================================================================

@app.route('/api/claims', methods=['POST'])
def submit_claim():
    """
    Submits a new ownership claim for a found item.
    Mediated by the Flask server using the Supabase service-role client.
    Validates required fields, positive integer IDs, item availability, and prevents duplicate pending claims.
    """
    if not supabase_service_configured or supabase_service is None:
        return jsonify({
            "success": False,
            "error": "Claim service is currently unavailable. Supabase service-role key is not configured in backend/.env."
        }), 503

    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "Invalid request body. Expected a JSON object."
        }), 400

    # 1. Validate found_item_id (must be a positive integer)
    raw_found_id = data.get('found_item_id')
    try:
        found_item_id = int(raw_found_id)
        if found_item_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "found_item_id is required and must be a positive integer."
        }), 400

    # 2. Validate optional lost_item_id (must be a positive integer if provided)
    lost_item_id = None
    raw_lost_id = data.get('lost_item_id')
    if raw_lost_id not in (None, '', 0, '0'):
        try:
            lost_item_id = int(raw_lost_id)
            if lost_item_id <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": "lost_item_id must be a positive integer when provided."
            }), 400

    # 3. Validate claimant details and enforce reasonable maximum input lengths
    claimant_name = str(data.get('claimant_name', '')).strip()
    claimant_email = str(data.get('claimant_email', '')).strip().lower()
    claimant_phone = str(data.get('claimant_phone', '')).strip() if data.get('claimant_phone') else None
    proof_details = str(data.get('proof_details', '')).strip()
    proof_image_url = data.get('proof_image_url')
    if proof_image_url and isinstance(proof_image_url, str):
        proof_image_url = proof_image_url.strip()[:2048]
    else:
        proof_image_url = None

    errors = []
    if not claimant_name or len(claimant_name) < 2:
        errors.append("claimant_name is required and must be at least 2 characters.")
    elif len(claimant_name) > 100:
        errors.append("claimant_name must not exceed 100 characters.")

    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not claimant_email:
        errors.append("claimant_email is required.")
    elif not re.match(email_regex, claimant_email):
        errors.append("claimant_email is not a valid email address.")
    elif len(claimant_email) > 150:
        errors.append("claimant_email must not exceed 150 characters.")

    if claimant_phone and len(claimant_phone) > 20:
        errors.append("claimant_phone must not exceed 20 characters.")

    if not proof_details or len(proof_details) < 10:
        errors.append("proof_details is required and must be at least 10 characters (describe distinguishing marks, serial numbers, receipt details).")
    elif len(proof_details) > 3000:
        errors.append("proof_details must not exceed 3000 characters.")

    if errors:
        return jsonify({
            "success": False,
            "error": "Validation failed",
            "details": errors
        }), 400

    try:
        # 4. Verify referenced found item exists and status is 'available'
        found_res = supabase_service.table('found_items').select('id, status').eq('id', found_item_id).execute()
        if not found_res.data:
            return jsonify({
                "success": False,
                "error": f"Referenced found item with ID {found_item_id} was not found."
            }), 404
        found_item = found_res.data[0]
        if found_item.get('status') != 'available':
            return jsonify({
                "success": False,
                "error": f"Found item {found_item_id} has status '{found_item.get('status')}'; only 'available' items can be claimed."
            }), 400

        # 5. If lost_item_id is supplied, verify it exists and status is 'open'
        if lost_item_id is not None:
            lost_res = supabase_service.table('lost_items').select('id, status').eq('id', lost_item_id).execute()
            if not lost_res.data:
                return jsonify({
                    "success": False,
                    "error": f"Referenced lost item with ID {lost_item_id} was not found."
                }), 404
            lost_item = lost_res.data[0]
            if lost_item.get('status') != 'open':
                return jsonify({
                    "success": False,
                    "error": f"Lost item {lost_item_id} has status '{lost_item.get('status')}'; only 'open' lost items can be linked to a claim."
                }), 400

        # 6. Check for duplicate pending claims before insert
        dup_claimant = supabase_service.table('claims') \
            .select('id') \
            .eq('found_item_id', found_item_id) \
            .eq('claimant_email', claimant_email) \
            .eq('claim_status', 'pending') \
            .execute()
        if dup_claimant.data:
            return jsonify({
                "success": False,
                "error": "A pending claim for this item has already been submitted with your email address."
            }), 409

        if lost_item_id is not None:
            dup_pair = supabase_service.table('claims') \
                .select('id') \
                .eq('found_item_id', found_item_id) \
                .eq('lost_item_id', lost_item_id) \
                .eq('claim_status', 'pending') \
                .execute()
            if dup_pair.data:
                return jsonify({
                    "success": False,
                    "error": "A pending claim linking this found item and lost item is already under review."
                }), 409

        # 7. Construct and insert new claim record using service-role client
        new_claim = {
            "found_item_id": found_item_id,
            "lost_item_id": lost_item_id,
            "claimant_name": claimant_name,
            "claimant_email": claimant_email,
            "claimant_phone": claimant_phone,
            "proof_details": proof_details,
            "proof_image_url": proof_image_url,
            "claim_status": "pending",
            "admin_notes": None
        }

        supabase_service.table('claims').insert(new_claim, returning='minimal').execute()

        return jsonify({
            "success": True,
            "message": "Ownership claim submitted successfully and is pending administrative review.",
            "claim": {
                "found_item_id": found_item_id,
                "lost_item_id": lost_item_id,
                "claim_status": "pending"
            }
        }), 201

    except Exception as e:
        err_msg = str(e)
        # Check for PostgreSQL unique-constraint violation (23505)
        if '23505' in err_msg or 'idx_unique_pending_claim' in err_msg or 'duplicate key value' in err_msg:
            return jsonify({
                "success": False,
                "error": "A duplicate pending claim already exists for this item under review."
            }), 409

        # Redact sensitive keys from database error messages
        for k in [SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY]:
            if k and k in err_msg:
                err_msg = err_msg.replace(k, "[REDACTED]")

        return jsonify({
            "success": False,
            "error": "Failed to submit claim due to a database error.",
            "details": err_msg
        }), 500


# =============================================================================
# TASK 5: Administrative Claims Review & Resolution Endpoints
# =============================================================================

@app.route('/api/admin/claims', methods=['GET'])
def get_admin_claims():
    """
    Admin-only endpoint to retrieve submitted claims for review.
    Protected by X-Admin-Key header using constant-time comparison.
    """
    if not verify_admin_key():
        return jsonify({
            "success": False,
            "error": "Unauthorized: Invalid or missing admin API key. Supply X-Admin-Key header."
        }), 401

    if not supabase_service_configured or supabase_service is None:
        return jsonify({
            "success": False,
            "error": "Service client is not configured in backend/.env."
        }), 503

    status_filter = request.args.get('status', 'all').strip().lower()

    try:
        query = supabase_service.table('claims').select('*').order('created_at', desc=True)
        if status_filter != 'all':
            query = query.eq('claim_status', status_filter)
        
        res = query.execute()
        claims_list = res.data or []

        return jsonify({
            "success": True,
            "count": len(claims_list),
            "claims": claims_list
        }), 200

    except Exception as e:
        err_msg = str(e)
        for k in [SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY]:
            if k and k in err_msg:
                err_msg = err_msg.replace(k, "[REDACTED]")
        return jsonify({
            "success": False,
            "error": "Failed to fetch claims from database.",
            "details": err_msg
        }), 500


@app.route('/api/admin/claims/<int:claim_id>/approve', methods=['POST'])
def approve_admin_claim(claim_id):
    """
    Admin-only endpoint to approve a pending claim.
    Executes the approve_claim() stored procedure atomically.
    Protected by X-Admin-Key header.
    """
    if not verify_admin_key():
        return jsonify({
            "success": False,
            "error": "Unauthorized: Invalid or missing admin API key."
        }), 401

    if not supabase_service_configured or supabase_service is None:
        return jsonify({
            "success": False,
            "error": "Service client is not configured in backend/.env."
        }), 503

    if claim_id <= 0:
        return jsonify({"success": False, "error": "Invalid claim ID. Must be a positive integer."}), 400

    data = request.get_json(silent=True) or {}
    admin_notes = data.get('admin_notes')
    if admin_notes is not None:
        admin_notes = str(admin_notes).strip()[:1000]

    try:
        rpc_res = supabase_service.rpc('approve_claim', {
            'p_claim_id': claim_id,
            'p_admin_notes': admin_notes
        }).execute()

        result = rpc_res.data
        if isinstance(result, dict) and not result.get('success'):
            code = result.get('code', '')
            status_code = 404 if code == 'NOT_FOUND' else 409
            return jsonify(result), status_code

        return jsonify({
            "success": True,
            "message": "Claim approved successfully and item statuses resolved.",
            "data": result
        }), 200

    except Exception as e:
        err_msg = str(e)
        for k in [SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY]:
            if k and k in err_msg:
                err_msg = err_msg.replace(k, "[REDACTED]")
        
        status_code = 500
        if 'not found' in err_msg.lower() or 'P0002' in err_msg:
            status_code = 404
        elif 'already' in err_msg.lower() or '40001' in err_msg or '22023' in err_msg:
            status_code = 409

        return jsonify({
            "success": False,
            "error": "Failed to approve claim.",
            "details": err_msg
        }), status_code


@app.route('/api/admin/claims/<int:claim_id>/reject', methods=['POST'])
def reject_admin_claim(claim_id):
    """
    Admin-only endpoint to reject a pending claim.
    Executes the reject_claim() stored procedure without modifying item statuses.
    Protected by X-Admin-Key header.
    """
    if not verify_admin_key():
        return jsonify({
            "success": False,
            "error": "Unauthorized: Invalid or missing admin API key."
        }), 401

    if not supabase_service_configured or supabase_service is None:
        return jsonify({
            "success": False,
            "error": "Service client is not configured in backend/.env."
        }), 503

    if claim_id <= 0:
        return jsonify({"success": False, "error": "Invalid claim ID. Must be a positive integer."}), 400

    data = request.get_json(silent=True) or {}
    admin_notes = data.get('admin_notes')
    if admin_notes is not None:
        admin_notes = str(admin_notes).strip()[:1000]

    try:
        rpc_res = supabase_service.rpc('reject_claim', {
            'p_claim_id': claim_id,
            'p_admin_notes': admin_notes
        }).execute()

        result = rpc_res.data
        if isinstance(result, dict) and not result.get('success'):
            code = result.get('code', '')
            status_code = 404 if code == 'NOT_FOUND' else 409
            return jsonify(result), status_code

        return jsonify({
            "success": True,
            "message": "Claim rejected. Item statuses were not modified.",
            "data": result
        }), 200

    except Exception as e:
        err_msg = str(e)
        for k in [SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY]:
            if k and k in err_msg:
                err_msg = err_msg.replace(k, "[REDACTED]")
        
        status_code = 500
        if 'not found' in err_msg.lower() or 'P0002' in err_msg:
            status_code = 404
        elif 'already' in err_msg.lower() or '40001' in err_msg or '22023' in err_msg:
            status_code = 409

        return jsonify({
            "success": False,
            "error": "Failed to reject claim.",
            "details": err_msg
        }), status_code


# =============================================================================
# Entry Point
# =============================================================================
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    print(f"🚀 Starting CampusFind API server on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
