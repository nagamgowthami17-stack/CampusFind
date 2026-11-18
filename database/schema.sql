-- =============================================================================
-- CampusFind: AI-Based Lost Object Matching System
-- Database Schema for Supabase (PostgreSQL)
-- =============================================================================

-- =============================================================================
-- 1. Table: lost_items
-- Purpose: Stores items reported as lost by campus students/staff.
-- Safe Creation: IF NOT EXISTS ensures existing tables and data are never dropped.
-- =============================================================================
CREATE TABLE IF NOT EXISTS lost_items (
    -- Unique identifier for each lost report (automatically increments: 1, 2, 3...)
    id BIGSERIAL PRIMARY KEY,

    -- Basic Item Information
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    color VARCHAR(80),
    
    -- Location & Date
    lost_location VARCHAR(255) NOT NULL,
    date_lost DATE NOT NULL,

    -- Detailed Description for AI text matching (embeddings/similarity)
    description TEXT NOT NULL,

    -- Optional photo URL (stored in Supabase Storage bucket)
    image_url TEXT,

    -- Reporter / Contact Information
    contact_name VARCHAR(100),
    contact_email VARCHAR(150),
    contact_phone VARCHAR(20),

    -- Status tracking: 'open' (still searching), 'matched' (AI found match), 'resolved' (reunited)
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'matched', 'resolved', 'closed')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. Table: found_items
-- Purpose: Stores items discovered and turned in across campus.
-- =============================================================================
CREATE TABLE IF NOT EXISTS found_items (
    -- Unique identifier for each found item
    id BIGSERIAL PRIMARY KEY,

    -- Basic Item Information
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    color VARCHAR(80),

    -- Location & Date
    found_location VARCHAR(255) NOT NULL,
    date_found DATE NOT NULL,

    -- Where the item is safely stored for collection (e.g., "Library Front Desk")
    item_custody VARCHAR(255) NOT NULL,

    -- Detailed Description for AI comparison
    description TEXT NOT NULL,

    -- Optional photo URL of the found item
    image_url TEXT,

    -- Founder Information
    founder_name VARCHAR(100),
    founder_email VARCHAR(150),

    -- Status tracking: 'available' (unclaimed), 'claimed' (returned to owner), 'closed'
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'closed')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. Table: claims
-- Purpose: Handles claims when a user asserts ownership over a found item.
-- =============================================================================
CREATE TABLE IF NOT EXISTS claims (
    -- Unique identifier for each claim
    id BIGSERIAL PRIMARY KEY,

    -- Foreign Key: Which found item is being claimed?
    -- If the found item is deleted, all related claims are automatically removed (CASCADE).
    found_item_id BIGINT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,

    -- Optional Foreign Key: Linked lost report (if match originated from a lost report)
    lost_item_id BIGINT REFERENCES lost_items(id) ON DELETE SET NULL,

    -- Claimant Information
    claimant_name VARCHAR(100) NOT NULL,
    claimant_email VARCHAR(150) NOT NULL,
    claimant_phone VARCHAR(20),

    -- Safe proof of ownership: distinctive non-sensitive marks, stickers, engravings,
    -- purchase receipt details, or unique item characteristics.
    -- SECURITY NOTE: Never ask users for passwords, PINs, or device unlock codes.
    proof_details TEXT NOT NULL,

    -- Optional proof photo (e.g., store receipt, warranty card, or photo of the item before loss)
    proof_image_url TEXT,

    -- Claim status: 'pending' (under review), 'approved' (ownership verified), 'rejected'
    claim_status VARCHAR(20) DEFAULT 'pending' CHECK (claim_status IN ('pending', 'approved', 'rejected', 'cancelled')),

    -- Administrative verification notes
    admin_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. Indexes for Fast Query Performance
-- Speeds up search, category filtering, and AI matching lookups
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_lost_items_category ON lost_items(category);
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_created_at ON lost_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_found_items_category ON found_items(category);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_items_created_at ON found_items(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claims_found_item_id ON claims(found_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(claim_status);

-- =============================================================================
-- 5. Automatic Timestamp Update Triggers
-- Keeps updated_at synchronized automatically whenever an existing record changes
-- =============================================================================

-- Reusable trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for lost_items
DROP TRIGGER IF EXISTS trigger_lost_items_updated_at ON lost_items;
CREATE TRIGGER trigger_lost_items_updated_at
    BEFORE UPDATE ON lost_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for found_items
DROP TRIGGER IF EXISTS trigger_found_items_updated_at ON found_items;
CREATE TRIGGER trigger_found_items_updated_at
    BEFORE UPDATE ON found_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for claims
DROP TRIGGER IF EXISTS trigger_claims_updated_at ON claims;
CREATE TRIGGER trigger_claims_updated_at
    BEFORE UPDATE ON claims
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. Row Level Security (RLS)
-- Enables strict row-level protection across all three tables.
-- IMPORTANT:
-- By enabling RLS without default permissive policies, all direct client access
-- is blocked by default until specific, fine-grained access policies are defined.
-- This ensures sensitive data (e.g., student contact information and claim details)
-- cannot be accessed or manipulated by unauthorized users.
-- =============================================================================
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
