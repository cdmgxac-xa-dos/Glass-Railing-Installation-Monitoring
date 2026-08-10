-- ---------------------------------------------------------------------------
-- Phase 3 of the Field Installation Monitoring expansion (owner's v1.2 plan,
-- Section 13): seeds the Doors & Windows checklist and QC templates, so any
-- location tagged scope = 'DOORS_WINDOWS' gets its own 12-step checklist and
-- QC list instead of the Railing one.
--
-- Purely additive - inserts two new template rows on top of the
-- installation_scopes/checklist_templates/qc_templates tables added in
-- 05_scope_foundation.sql. Nothing about the RAILING template or any
-- existing gr_* data changes. Still zero visible effect for anyone on a
-- Railings-only project (every project today) - these rows only get read
-- once a location's gr_locations.scope is actually 'DOORS_WINDOWS'.
--
-- One shared 12-step checklist / QC list covers both door and window
-- items rather than branching into separate templates per item type - the
-- plan's item-specific extra checkpoints (water test, sliding/awning/fix
-- operation test, lock & handle test, door operation test) are folded into
-- "Testing Completed" (checklist) and "Operation smoothness" / "Lock and
-- handle function" / "Water test result" (QC) rather than built as
-- conditional per-item-type templates. Revisit if the field team needs
-- door vs. window to diverge more than that.
-- ---------------------------------------------------------------------------

insert into checklist_templates (scope, name, stages) values (
  'DOORS_WINDOWS',
  'Doors & Windows Installation Checklist',
  '[
    {"key": "openingReleased", "label": "Opening Released"},
    {"key": "openingDimensionChecked", "label": "Opening Dimension Checked"},
    {"key": "frameDelivered", "label": "Frame Delivered"},
    {"key": "frameInstalled", "label": "Frame Installed"},
    {"key": "frameAlignmentChecked", "label": "Frame Alignment Checked"},
    {"key": "glassInstalled", "label": "Glass Installed"},
    {"key": "hardwareInstalled", "label": "Hardware Installed"},
    {"key": "adjustmentCompleted", "label": "Adjustment Completed"},
    {"key": "sealantCompleted", "label": "Sealant Completed"},
    {"key": "testingCompleted", "label": "Testing Completed"},
    {"key": "qcInspectionPassed", "label": "QC Inspection Passed"},
    {"key": "completed", "label": "Completed"}
  ]'::jsonb
) on conflict (scope) do nothing;

insert into qc_templates (scope, name, items) values (
  'DOORS_WINDOWS',
  'Doors & Windows QC Checklist',
  '[
    {"key": "openingDimensionAccuracy", "label": "Opening dimension accuracy"},
    {"key": "frameCondition", "label": "Frame condition (no dents or scratches)"},
    {"key": "frameAlignment", "label": "Frame alignment (level and plumb)"},
    {"key": "frameAnchoring", "label": "Frame anchoring and fastening"},
    {"key": "glassCondition", "label": "Glass panel condition"},
    {"key": "hardwareInstallation", "label": "Hardware installation"},
    {"key": "operationSmoothness", "label": "Operation smoothness"},
    {"key": "lockHandleFunction", "label": "Lock and handle function"},
    {"key": "sealantQuality", "label": "Sealant and weatherproofing quality"},
    {"key": "waterTightness", "label": "Water test result"},
    {"key": "gapClearance", "label": "Gap and clearance consistency"},
    {"key": "missingAccessories", "label": "Missing accessories"}
  ]'::jsonb
) on conflict (scope) do nothing;
