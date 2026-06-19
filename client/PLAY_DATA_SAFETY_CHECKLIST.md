# Play Data Safety Technical Review Checklist

This is a technical review checklist for the product owner, privacy reviewer,
and release owner. It is not legal advice and is not a completed Play Console
declaration.

Use this inventory before every Play release that changes data collection,
sharing, SDKs, consent timing, retention, or deletion behavior.

| Data type | Collector/recipient | Purpose | Required or optional | Retention/deletion behavior | Collected | Shared | Owner confirmation | Play Console answer reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GoodOne account data | GoodOne backend | Account creation, login, marketplace identity | Required for accounts | Subject to account deletion flow and backend retention policy | Needs owner review | Needs owner review | Pending | Pending |
| Email, name, phone, authentication data | GoodOne backend | Login, vendor/customer contact, account support | Required where account/vendor features need it | Account deletion route exists; retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Vendor profile data | GoodOne backend | Seller profile, marketplace trust, admin review | Required for vendors | Deletion/retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Product listings | GoodOne backend and controlled WebView/app UI | Marketplace listing display, search, vendor sales flow | Required for sellers | Listing expiry exists; deletion/retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Photos and videos | GoodOne backend, device picker/camera, controlled WebView/app UI | Product listing media, vendor verification, marketplace display | Required for listing media features | Deletion/retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Chat messages | GoodOne backend and app UI | Buyer/seller messaging and support | Optional unless user uses chat | Deletion/retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Reports and blocks | GoodOne backend | Safety, moderation, abuse prevention | Optional user action | Retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| App interactions | GoodOne app/backend, Meta App Events, AdMob/Firebase as configured | App measurement, attribution, campaign effectiveness, product operation | Required for app operation/measurement as configured | SDK/backend retention varies; needs owner/privacy review | Needs owner review | Needs owner review | Pending | Pending |
| AdMob data | Google Mobile Ads SDK / Google | Ads, ad measurement, fraud prevention, mediation behavior | Required when ads are enabled | Governed by Google SDK/publisher settings and app privacy choices | Needs owner review | Needs owner review | Pending | Pending |
| Firebase and push notification data | Firebase/Google and GoodOne backend | Push delivery, device registration, notification routing | Optional by device permission and feature use | Token retention/deletion needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Meta App Events | Meta SDK / Meta | App measurement, attribution, campaign effectiveness | Required by current app configuration unless release owner changes flags | Governed by Meta SDK/dashboard settings and applicable privacy choices | Needs owner review | Needs owner review | Pending | Pending |
| Diagnostics | GoodOne app/backend, Android platform, SDK providers | Crash/debug diagnostics, app reliability, fraud prevention | Required for troubleshooting and SDK operation | Retention varies by collector; needs owner review | Needs owner review | Needs owner review | Pending | Pending |
| Device or advertising identifiers where enabled | Android platform, AdMob, Meta, Firebase/Google as configured | Ads, attribution, analytics, fraud prevention, push routing | Depends on SDK configuration and user/device privacy choices | SDK/dashboard retention varies; needs owner/privacy review | Needs owner review | Needs owner review | Pending | Pending |
| Backend API request data | GoodOne backend and hosting provider | App functionality, security, fraud prevention, operational logs | Required for app features | Server log/data retention needs owner confirmation | Needs owner review | Needs owner review | Pending | Pending |
| Controlled WebView behavior | GoodOne Capacitor app and GoodOne frontend | Render marketplace app in native wrapper | Required for app shell | Data follows frontend/backend/SDK flows above | Needs owner review | Needs owner review | Pending | Pending |

## Owner Review Notes

- Confirm whether any data is shared under Google Play's definition of sharing.
- Confirm whether each data type is optional or required for the relevant user
  role.
- Confirm retention and deletion timing for account deletion, listing removal,
  media removal, chat history, reports, device tokens, and logs.
- Confirm Meta automatic logging remains appropriate with
  `META_AUTO_LOG_APP_EVENTS_ENABLED=true` and
  `META_ADVERTISER_ID_COLLECTION_ENABLED=false`.
- Confirm whether automatic event logging must be delayed until consent in any
  target market.
- Confirm no custom Meta events are added without written event specifications
  and privacy/Data Safety review.
