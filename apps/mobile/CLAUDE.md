# ReturnFlow Mobile — Claude Instructions

> Applies to `apps/mobile`. Read the root `CLAUDE.md` first.

## Purpose and stack

This React Native + Expo application is the driver interface for ReturnFlow.

Use TypeScript strict mode, an Expo-compatible navigation setup, Expo SecureStore for sensitive session data, camera/photo-library access, and touch signature capture.

The driver experience must be faster and clearer than the paper form.

## Required screens

1. Splash/session restore
2. Login
3. My Returns
4. New Return
5. Return Details/Edit
6. Customer Signature
7. Photo capture/selection
8. Read-only status state

Keep navigation simple.

## Driver permissions

The driver can see only their own returns, create a return, edit/add/remove media while `WAITING_WAREHOUSE`, and view read-only records afterward.

The driver cannot cancel, delete, see warehouse fields, see other drivers' data, select tenant/driver/route, generate PDF, or manage configuration.

## Return form

Required fields:

- Customer name
- Product description
- Quantity
- Unit: EA or CTN
- Reason
- Reason details when Other
- Driver observation, optional
- Up to five photos, optional
- Customer representative name
- Customer signature

Use one return per screen/form. Do not reproduce a paper grid. Use large touch targets and a clear save flow.

## Reason behavior

Load active reasons from the API. When `OTHER` is selected, show and require details. The driver never creates a permanent reason.

`CUSTOMER_CHARGE_REQUIRED` remains a normal reason label supplied by the API.

## Quantity and unit

Quantity is a positive integer with a numeric keyboard. Units are only EA and CTN.

## Route

Display the authenticated driver's route when useful, but do not allow route selection. The API remains authoritative.

## Photos

Maximum five. Handle camera/library permissions, resize/compress large images, show thumbnails, allow removal while waiting, show upload progress or clear pending states, and never report success before backend confirmation.

Avoid memory-heavy base64 handling. Offline queues are outside V1.

## Customer signature

Provide a comfortable touch drawing area, clear/reset, confirm, preview, and required validation. Representative name is separate and required. Do not persist base64 signature data locally.

## Save and edit behavior

The API creates `WAITING_WAREHOUSE` returns. While waiting, fields/media are editable. When review starts, refresh to read-only and explain that warehouse review has started.

Never falsely present unsaved local data as saved.

## My Returns

Show return number, customer, product, reason, status, and date/time. Keep the initial list simple; do not add analytics.

## Authentication

Use email/password, secure token storage, session restoration, expiry handling, logout, and cache clearing. Do not use social login, magic links, or AsyncStorage for sensitive tokens when SecureStore is appropriate.

## Network behavior

V1 requires connectivity. Handle loading, timeout, no connection, validation, unauthorized, status conflict, server failure, and upload failure.

Do not implement offline sync. Retry only safely designed operations.

## State management

Prefer a small approach: a server-state query library where helpful, a form library, and local screen state. No Redux by default. The backend owns lifecycle rules.

## Accessibility and usability

Use large touch targets, readable text, labels, nearby errors, screen-reader labels where practical, permission explanations, and textual status labels.

## Testing priorities

Test login, required fields, positive integer quantity, EA/CTN, Other details, five-photo limit, signature requirement, read-only state after review, network failures, and stale-update conflicts.

## Do not

Do not add offline mode, push notifications, admin screens, route selection, product catalog, barcode scanning, multiple products per return, finance fields, shared UI with web, persistent base64 images, complex global state, or client-invented transitions.

## First mobile milestone

The first milestone only establishes a buildable Expo TypeScript project, navigation-ready structure, environment configuration, lint/typecheck/test scripts, and a placeholder screen.
