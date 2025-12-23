# Electricity Prepaid Meter - Testing Checklist

## Feature Overview
The electricity prepaid meter tracking allows caretakers/managers to:
- Enter daily electricity balance readings
- Set minimum balance thresholds per property
- Receive automatic alerts when balance falls below threshold
- View reading history

## Testing Checklist

### 1. Basic Functionality ✅
- [ ] Navigate to a property detail page
- [ ] Verify "Electricity Meter" card is visible
- [ ] Check that current balance displays correctly (if readings exist)
- [ ] Verify "No readings yet" message shows when no readings exist

### 2. Adding Readings ✅
- [ ] Click "Add Reading" button (should only be visible to Admin/Manager)
- [ ] Enter a valid balance (e.g., 50.00)
- [ ] Add optional notes
- [ ] Submit and verify reading is saved
- [ ] Check that reading appears in "Recent Readings" table
- [ ] Verify "Last Reading" date updates
- [ ] Try entering negative balance (should show error)
- [ ] Try entering invalid characters (should be prevented)

### 3. Settings & Threshold ✅
- [ ] Click "Settings" button (Admin/Manager only)
- [ ] Set minimum balance threshold (e.g., 20.00)
- [ ] Change unit (GHS/USD)
- [ ] Save settings
- [ ] Verify threshold displays in the meter card
- [ ] Try clearing threshold (set to empty) - should disable alerts

### 4. Alert System ⚠️
- [ ] Set a threshold (e.g., 30.00)
- [ ] Add a reading below threshold (e.g., 15.00)
- [ ] Verify red alert banner appears
- [ ] Check that alert message shows current balance and threshold
- [ ] Verify notification is sent to:
  - Property owner
  - Property manager (if assigned)
  - Admin users
- [ ] Check notification channels (WhatsApp/SMS/Email)
- [ ] Verify alert appears in alerts list

### 5. Alert Resolution ✅
- [ ] With an active alert, add a new reading above threshold (e.g., 50.00)
- [ ] Verify alert banner disappears
- [ ] Check that alert is marked as resolved in database
- [ ] Verify no duplicate alerts are created

### 6. Reading History ✅
- [ ] Add multiple readings over several days
- [ ] Verify readings appear in "Recent Readings" table
- [ ] Check that readings are sorted by date (newest first)
- [ ] Verify "Entered By" column shows correct user
- [ ] Check that only last 5 readings are shown (or verify pagination if implemented)

### 7. Permissions & Access Control ✅
- [ ] As Admin: Verify can add readings and set thresholds
- [ ] As Manager: Verify can add readings for assigned properties only
- [ ] As Manager: Verify cannot add readings for non-assigned properties
- [ ] As Operations: Verify can add readings
- [ ] As Owner: Verify can view readings but cannot edit
- [ ] As Owner: Verify cannot see "Add Reading" or "Settings" buttons

### 8. Data Validation ✅
- [ ] Try submitting empty balance (should show error)
- [ ] Try submitting balance with letters (should be prevented)
- [ ] Try submitting very large numbers (should handle gracefully)
- [ ] Try submitting decimal values (e.g., 25.50) - should work
- [ ] Verify date is automatically set to current date/time

### 9. UI/UX ✅
- [ ] Verify meter card is responsive on mobile
- [ ] Check that alert banner is clearly visible
- [ ] Verify currency formatting is correct (GHS/USD)
- [ ] Check that loading states work correctly
- [ ] Verify error messages are user-friendly
- [ ] Check that success toasts appear after actions

### 10. Edge Cases ⚠️
- [ ] Add reading exactly at threshold (should not trigger alert)
- [ ] Add reading just below threshold (should trigger alert)
- [ ] Add reading just above threshold (should resolve alert)
- [ ] Set threshold to 0 (should work but may trigger alerts immediately)
- [ ] Add multiple readings on same day (should all be saved)
- [ ] Try accessing readings for non-existent property (should show error)

### 11. Integration Points ⚠️
- [ ] Verify property detail page loads electricity meter component
- [ ] Check that property data includes threshold and unit
- [ ] Verify notifications are sent via correct channels
- [ ] Check that alert records are created in database
- [ ] Verify reading history persists after page refresh

### 12. Dashboard Integration (To Be Implemented) ⚠️
- [ ] Add electricity alerts widget to admin dashboard
- [ ] Show count of properties with low balance
- [ ] Add quick link to properties with alerts
- [ ] Show recent low balance alerts

## Known Issues / To Fix
- [ ] Dashboard widget for electricity alerts (not yet implemented)
- [ ] Alert resolution UI (currently auto-resolves, but no manual resolve button in UI)
- [ ] Reading history pagination (currently shows only 5)
- [ ] Chart/graph for balance trends over time

## Test Data Suggestions
1. Create a test property
2. Set threshold to 30.00 GHS
3. Add readings:
   - Day 1: 50.00 (above threshold)
   - Day 2: 25.00 (below threshold - should trigger alert)
   - Day 3: 15.00 (still below - should not create duplicate alert)
   - Day 4: 40.00 (above threshold - should resolve alert)

## API Endpoints to Test
- `GET /api/properties/[id]/electricity-readings` - List readings
- `POST /api/properties/[id]/electricity-readings` - Add reading
- `PATCH /api/properties/[id]/electricity-threshold` - Set threshold
- `GET /api/properties/[id]/electricity-alerts` - List alerts
- `POST /api/properties/[id]/electricity-alerts/[alertId]/resolve` - Resolve alert

