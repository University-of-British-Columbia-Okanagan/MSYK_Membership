# Stripe Product Sync — Implementation Plan

**Last Updated:** 2026-03-05

## The Problem

Right now, Stripe discount codes in the portal apply to everything — workshops, memberships, and equipment — because Stripe has no way to tell them apart. All payments are processed using anonymous inline pricing, with no connection to actual named Stripe Products.

Stripe's coupon restriction feature (limiting a code to only workshops, or only a specific membership plan) only works when a payment line item is linked to a Stripe Product. Currently, none of the checkout flows in the portal create or reference Stripe Products.

---

## The Solution

Automatically create a **Stripe Product** for every workshop, membership plan, and equipment item in the portal. Once each item is linked to a Stripe Product, coupons can be created in the Stripe dashboard and restricted to specific products.

**Examples of what becomes possible:**
- Coupon `SUMMER25` → restricted to "Intro to Laser Cutting" workshop → only applies at that workshop's checkout
- Coupon `MEMBER10` → restricted to "Standard Membership" plan → only works for that membership
- Coupon `LASER10` → restricted to "Laser Cutter" equipment → only applies when booking that machine

Pricing and GST calculations stay exactly as they are — only the product association changes.

---

## What We'll Build

### 1. Database Changes

Add a `stripeProductId` field to the `Workshop`, `MembershipPlan`, and `Equipment` database models. This stores the Stripe Product ID so the system always knows which Stripe Product corresponds to which item.

```
Workshop        → stripeProductId (optional string)
MembershipPlan  → stripeProductId (optional string)
Equipment       → stripeProductId (optional string)
```

### 2. Stripe Sync Service (`app/services/stripe-sync.server.ts`)

A new server-side service with the following functions:

- `syncWorkshopToStripe(workshopId)` — Creates or updates a Stripe Product for a workshop
- `syncMembershipPlanToStripe(planId)` — Creates or updates a Stripe Product for a membership plan
- `syncEquipmentToStripe(equipmentId)` — Creates or updates a Stripe Product for an equipment item
- `archiveStripeProduct(stripeProductId)` — Marks a Stripe Product as inactive (for deleted items — see edge cases)
- `bulkSyncToStripe()` — Syncs all three categories in one pass (for existing data — see below)

Logic per sync function:
- If the item has no `stripeProductId` → create a new Stripe Product, save the returned ID to the database
- If the item already has a `stripeProductId` → update the existing Stripe Product's name/description to stay in sync
- All Stripe calls are wrapped in try/catch so a failure never blocks the core operation
- Each Stripe Product is created with metadata identifying its source, e.g. `{ portal_type: "workshop", portal_id: "42" }` — this makes products identifiable in the Stripe dashboard when browsing to create or restrict coupons

### 3. Auto-Sync on Create/Edit/Delete

Hooks into the existing model functions so Stripe Products are created, updated, or archived automatically.

| Portal Action | Function | Stripe Action |
|---|---|---|
| Create workshop | `addWorkshop()` | Create Stripe Product |
| Edit workshop | `updateWorkshopWithOccurrences()` | Update Stripe Product name/description |
| Delete workshop | workshop delete function | Archive Stripe Product (`active: false`) |
| Create membership plan | `addMembershipPlan()` | Create Stripe Product |
| Edit membership plan | `updateMembershipPlan()` | Update Stripe Product |
| Delete membership plan | membership plan delete function | Archive Stripe Product |
| Create equipment | equipment create function | Create Stripe Product |
| Edit equipment | equipment update function | Update Stripe Product |
| Delete equipment | equipment delete function | Archive Stripe Product |

**Why archive instead of delete?** Stripe does not allow deleting Products that have prior payment history. Archiving (`active: false`) removes them from the Stripe dashboard and prevents new discounts from being applied, without losing any historical data.

### 4. Update Checkout Sessions

Modify the payment checkout flow to reference the Stripe Product ID in the line item. This is the change that makes coupon restrictions enforceable by Stripe.

Current approach (anonymous inline product):
```
price_data: { product_data: { name: "Workshop Name" }, unit_amount: 5000 }
```

New approach (linked to Stripe Product):
```
price_data: { product: "prod_xxxx", unit_amount: 5000 }
```

The `unit_amount` (including dynamic GST) is still calculated on our side — nothing changes for the user at checkout.

Files to update:
- `app/models/payment.server.ts` — membership, workshop (single + multi-day), and equipment checkout branches
- `app/routes/dashboard/payment.tsx` — duplicate checkout logic that also needs updating

If an item does not yet have a `stripeProductId` (e.g. bulk sync hasn't been run yet), the checkout falls back to the current `product_data` inline approach so nothing breaks.

The same fallback applies if a `stripeProductId` is set but the product has been manually archived or deleted from the Stripe dashboard directly (outside the portal). The checkout will catch the Stripe error, fall back to inline `product_data`, and log a warning so the admin knows the ID is stale. The admin can re-sync to regenerate a valid product.

### 5. Bulk Sync for Existing Data

> **This is important:** The portal already has workshops, membership plans, and equipment items that predate this feature. None of them have a Stripe Product yet.

A new admin API endpoint (`app/routes/api/stripe-sync.tsx`) and a UI button in Admin Settings will allow an admin to run a one-time bulk sync that:

1. Loops through all existing workshops → creates a Stripe Product for each
2. Loops through all existing membership plans → creates a Stripe Product for each
3. Loops through all existing equipment items → creates a Stripe Product for each
4. Stores all returned Stripe Product IDs in the database

After running this once, all existing items are connected to Stripe. From that point forward, newly created or edited items are synced automatically. The bulk sync is safe to re-run — it skips items that already have a `stripeProductId`.

> **Stripe environment note:** `stripeProductId` values are account-specific. A product created with a test key (`sk_test_...`) is invalid against a live key (`sk_live_...`) and vice versa. If the Stripe keys in `.env` are ever changed to a different account or switched between test and live, all stored `stripeProductId` values must be cleared from the database and the bulk sync must be re-run. The Admin Settings UI will include a "Clear & Re-sync" option for this purpose.

### 6. Admin Settings UI

A new "Stripe Products" section added to the Admin Settings page showing:

- A description of what this does
- A "Sync All to Stripe" button
- On success: count of workshops, membership plans, and equipment items synced
- On error: list of any items that failed to sync

---

## Edge Cases Addressed

### Workshops

| Case | Handling |
|---|---|
| **Workshop type: orientation** | Same `Workshop` model as regular workshops. Orientations that charge a fee get a Stripe Product like any other workshop. |
| **Workshop type: multi-day** | Multi-day occurrences share the same `Workshop` record (linked via `connectId` on occurrences). One Stripe Product per workshop — no special handling needed. |
| **Workshop has price variations** | `WorkshopPriceVariation` records belong to a Workshop. All variations (e.g. "Student", "Early Bird") are grouped under the same Workshop's Stripe Product. This means a coupon can target the whole workshop but not a specific price tier — that is a known limitation. The variation name (e.g. "Student") will move to the checkout description rather than the product name. |
| **Workshop duplicated** | `duplicateWorkshop()` exists. When a workshop is duplicated, the new record must have `stripeProductId: null` — it must **not** inherit the original's ID, as that would cause two DB records pointing to one Stripe Product. A new sync is triggered automatically after the duplicate is created. |
| **`offerWorkshopAgain()`** | This creates a new set of occurrences for an *existing* Workshop record. The `stripeProductId` is already set on the Workshop — no action needed. |
| **Workshop with no `status` field** | `Workshop` has no status field; "past/active" is determined by its occurrence dates. The Workshop record itself persists regardless. Stripe Product remains active as long as the Workshop record exists. |
| **Occurrence statuses (open, closed, cancelled)** | These live on `WorkshopOccurrence`, not `Workshop`. No impact on Stripe Product. |
| **Workshop deleted** | Archive the Stripe Product (`active: false`). Cannot hard-delete in Stripe if prior payments exist. |
| **Free workshop (`price: 0`)** | Checkout bypasses Stripe entirely for free registrations. The Stripe Product is still created but never referenced in a checkout session. Harmless. |

### Equipment

| Case | Handling |
|---|---|
| **`availability: false`** | Portal blocks booking before checkout. Stripe Product remains active — no need to archive unavailable equipment since availability can change back. |
| **Equipment duplicated** | `duplicateEquipment()` exists. Same as workshop duplicate — new record must have `stripeProductId: null`, not a copy of the original's ID. New sync triggered after creation. |
| **Role-restricted equipment (Level 3/4)** | Portal enforces role checks before checkout. Stripe doesn't need to know about role levels. |
| **Equipment price is per-slot (multiple slots)** | Checkout uses the total price (price × slot count + GST) as `unit_amount`. The Stripe Product is still just the equipment item. This is correct. |
| **Checkout currently shows `"Equipment Booking (ID: X)"`** | Switching to `price_data.product` will show the actual equipment name from Stripe — this is an improvement over the current anonymous label. |
| **Equipment deleted** | Archive the Stripe Product. |
| **Free equipment (`price: 0`)** | Bypasses Stripe checkout. Stripe Product created but never used in a session. |

### Memberships

| Case | Handling |
|---|---|
| **Multiple billing cycles (monthly, quarterly, semi-annual, yearly)** | All cycles belong to the same `MembershipPlan` record. One Stripe Product per plan — billing cycle is passed as metadata, not a separate product. A coupon restricted to "Standard Membership" applies regardless of which billing cycle the user selects. |
| **Membership upgrade (prorated charge)** | Checkout creates a line item using the calculated proration fee, not the plan's base price. `price_data.product` still references the plan's Stripe Product correctly. |
| **`UserMembership` status (active, ending, cancelled, inactive, revoked)** | These are statuses on the user's subscription, not the plan itself. `MembershipPlan` has no status field. The Stripe Product is tied to the plan, not individual subscriptions. No impact. |
| **`needAdminPermission` plan (Level 4)** | Portal restricts access before checkout. Stripe doesn't need to know. |
| **Membership plan deleted** | Archive the Stripe Product. |

---

## Files Modified / Created

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `stripeProductId` to `Workshop`, `MembershipPlan`, `Equipment` |
| `app/services/stripe-sync.server.ts` | **New** — all Stripe sync/archive logic |
| `app/models/workshop.server.ts` | Call sync on create/update, archive on delete |
| `app/models/membership.server.ts` | Call sync on create/update, archive on delete |
| `app/models/equipment.server.ts` | Call sync on create/update, archive on delete |
| `app/models/payment.server.ts` | Use `price_data.product` when available, fall back to `product_data` |
| `app/routes/dashboard/payment.tsx` | Same checkout session update |
| `app/routes/api/stripe-sync.tsx` | **New** — admin bulk sync API endpoint |
| `app/routes/dashboard/adminsettings.tsx` | Add Stripe Products sync UI section |

---

## Handling Existing Data

The portal currently has existing workshops, equipment, and membership plans that have never been linked to Stripe Products. Here is the migration approach:

1. **Schema migration** — Run `npx prisma migrate dev` to add the `stripeProductId` columns. All existing rows will have `null` for this field initially.
2. **One-time bulk sync** — Admin logs into the portal → Admin Settings → clicks "Sync All to Stripe". The system creates a Stripe Product for every existing workshop, membership plan, and equipment item and saves the IDs.
3. **Graceful fallback** — Until the bulk sync is run, checkout sessions fall back to the current `product_data` inline approach. No payments are broken during the transition window.
4. **Ongoing** — All future creates/edits auto-sync; no manual action needed. Deletions archive the Stripe Product automatically.

The bulk sync skips items that already have a `stripeProductId`, so it is safe to run multiple times with no duplicates created in Stripe.

---

## Known Limitations

- **Per-variation coupon targeting is not supported.** A coupon can target a specific workshop but not a specific price tier (e.g. "Student only"). All variations of a workshop share one Stripe Product. Supporting per-variation targeting would require separate Stripe Products per variation and is a significant increase in complexity.
- **Quick checkout (saved card, PaymentIntent path) does not support promotion codes.** This is a Stripe limitation — promotion codes only work through the Stripe Checkout hosted page. Users paying with a saved card bypass this entirely.
- **`stripeProductId` values are environment-specific.** If the Stripe keys are ever changed (e.g. switching from test to live, or to a different Stripe account), all stored IDs must be cleared and a fresh bulk sync run. The Admin Settings UI will include a "Clear & Re-sync" option for this.
- **Manually archiving a product in Stripe breaks the link.** If a Stripe Product is archived directly in the Stripe dashboard (not via the portal's delete flow), that item's checkout will fall back to anonymous inline pricing until re-synced. No payment is blocked, but the coupon restriction is lost until the admin re-syncs.

---

## Manual Testing Steps

> Run all tests against the **Stripe test environment** (`sk_test_...` key). Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.

---

### 1. Bulk Sync (Existing Data)

**Setup:** Deploy the update. Do not run the bulk sync yet.

1. Go to Admin Settings → Stripe Products section
2. Before clicking sync, open the Stripe dashboard → Products tab → confirm none of the portal's workshops, membership plans, or equipment items appear as products
3. Click "Sync All to Stripe"
4. Confirm the UI shows a success message with counts (e.g. "5 workshops, 2 membership plans, 3 equipment items synced")
5. In the Stripe dashboard → Products, confirm a product exists for each workshop, each membership plan, and each equipment item
6. For one product, click into it and confirm the metadata shows `portal_type` and `portal_id` matching the correct item
7. Click "Sync All to Stripe" again — confirm the counts show 0 new items synced (all already had IDs, no duplicates created)

---

### 2. Workshop — Auto-Sync on Create

1. Admin creates a new workshop (any type: regular, orientation, or multi-day)
2. Immediately after saving, go to Stripe dashboard → Products
3. Confirm a new product exists with the workshop's exact name
4. Confirm the product metadata contains `portal_type: "workshop"` and the correct `portal_id`

**For a workshop with price variations:**
1. Create a workshop with price variations enabled (e.g. "Student", "Early Bird")
2. Confirm only **one** Stripe Product is created (not one per variation)

---

### 3. Workshop — Auto-Sync on Edit

1. Edit an existing workshop and change its name
2. Save the change
3. In the Stripe dashboard, confirm the corresponding product's name has updated to match
4. Confirm no duplicate product was created (still only one product for that workshop)

---

### 4. Workshop — Archive on Delete

1. Note the Stripe Product ID for a workshop (visible in the Stripe dashboard URL or product detail)
2. Delete the workshop from the admin portal
3. In the Stripe dashboard, search for that product by ID
4. Confirm it still exists but is marked as **archived** (inactive) — it should not appear in the active products list

---

### 5. Workshop — Duplicate

1. Duplicate an existing workshop
2. Confirm the duplicate appears in the portal as a separate workshop
3. In the Stripe dashboard, confirm a **new, separate** product was created for the duplicate (not the same product ID as the original)
4. Confirm the original workshop's product is unchanged

---

### 6. Equipment — Auto-Sync on Create, Edit, Delete

Repeat the same steps as Workshop tests 2–4 above but for equipment items.

**Additional check for equipment edit:**
- Confirm the checkout page now shows the equipment's actual name (e.g. "Laser Cutter") instead of the old `"Equipment Booking (ID: X)"` label

---

### 7. Membership Plan — Auto-Sync on Create, Edit, Delete

Repeat the same steps as Workshop tests 2–4 above but for membership plans.

**Additional check for billing cycles:**
- Create a membership plan with multiple billing cycles (monthly, quarterly, yearly)
- Confirm only **one** Stripe Product is created (not one per billing cycle)

---

### 8. Core Feature — Coupon Restricted to a Specific Workshop

This is the main thing the feature is built for.

**Setup in Stripe dashboard:**
1. Go to Stripe dashboard → Coupons → Create coupon
2. Set a discount (e.g. 20% off)
3. Under "Apply to specific products", select only **one** workshop's product (e.g. "Intro to Laser Cutting")
4. Set a coupon code (e.g. `LASER20`)
5. Save the coupon

**Test — code applies correctly:**
1. Log into the portal as a regular user
2. Navigate to "Intro to Laser Cutting" → register → proceed to Stripe checkout
3. Enter the code `LASER20` in the promotion code field
4. Confirm the 20% discount is applied before completing payment

**Test — code rejected on a different workshop:**
1. Navigate to a **different** workshop → register → proceed to Stripe checkout
2. Enter `LASER20`
3. Confirm Stripe rejects the code (shows an error like "This promotion code is not applicable to the items in your cart")

**Test — code rejected on a membership:**
1. Navigate to Memberships → subscribe to any plan → proceed to Stripe checkout
2. Enter `LASER20`
3. Confirm Stripe rejects the code

**Test — code rejected on equipment:**
1. Navigate to a piece of equipment → book slots → proceed to Stripe checkout
2. Enter `LASER20`
3. Confirm Stripe rejects the code

---

### 9. Core Feature — Coupon Restricted to a Membership Plan

1. Create a coupon in Stripe restricted to one membership plan's product (e.g. `MEMBER10`)
2. Subscribe to that specific membership plan → apply `MEMBER10` at checkout → confirm it applies
3. Subscribe to a **different** membership plan → apply `MEMBER10` → confirm Stripe rejects it
4. Try `MEMBER10` on a workshop checkout → confirm rejected

---

### 10. Checkout Integrity — GST, Metadata, Success/Cancel URLs

For each payment type (workshop, equipment, membership), complete a full checkout with the test card and confirm:

- [ ] GST is calculated correctly and shown in the checkout total
- [ ] Payment succeeds and lands on the correct success page
- [ ] Cancel button returns to the correct page (workshops → `/dashboard/workshops`, equipment → `/dashboard/equipments`, membership → `/dashboard/memberships`)
- [ ] After payment, the registration/booking/membership is created correctly in the portal
- [ ] The Stripe payment record includes the correct metadata (workshopId, userId, etc.)

---

### 11. Fallback — Item Without a Stripe Product

1. Using Prisma Studio or a direct DB query, manually set `stripeProductId = null` on one workshop
2. Proceed to checkout for that workshop
3. Confirm checkout completes successfully (fallback to inline `product_data` — no crash)
4. Confirm a warning is logged on the server
5. Note: the coupon for that workshop will not work until re-synced

---

### 12. Fallback — Stale/Manually Archived Product

1. In the Stripe dashboard, manually archive one workshop's product
2. Proceed to checkout for that workshop
3. Confirm checkout completes successfully (fallback to inline `product_data`)
4. Confirm a warning is logged
5. In Admin Settings, click "Sync All to Stripe" — confirm a new product is created for that workshop and the `stripeProductId` in the DB is updated

---

### 13. Stripe Environment Switching

1. Note the current `stripeProductId` values in the DB for a few items (via Prisma Studio)
2. In `.env`, switch to the other test key (the commented-out one)
3. In Admin Settings, use the "Clear & Re-sync" option
4. Confirm all `stripeProductId` values in the DB are new IDs (matching the new Stripe account)
5. Confirm checkout still works correctly
6. Switch back to the original key and re-sync again to restore

