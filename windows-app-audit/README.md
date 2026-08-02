# Openshop Windows Application Audit

Black-box audit of the live Adobe Photoshop CS6 64-bit desktop application on XRAY-PC,
captured 2026-08-01. Scope: visible shell, menus, docked panels, toolbar/tool flyouts,
window identity, safe navigation, accessibility surface, and reconstruction needs.

The target had no open document. Document-dependent editing, file I/O, clipboard,
printing, filters, destructive actions, and persistent settings were not exercised.
Screenshots are audit evidence only, not replacement UI assets. No Openshop
implementation was started.

Classifications used throughout: CONFIRMED, STRONG_INFERENCE, POSSIBLE, UNKNOWN,
UNTESTED. Tool statuses follow the supplied audit brief.